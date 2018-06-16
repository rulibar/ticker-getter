/*
scannerPoloniex.js
Description: A candle data compiler and saver for Poloniex exchange. Periodically
cycles through the pairs in pairsPoloniex.json, compile candle data, and store to
the Data file. See README.md

v1.0
/- Initial stable version
    v1.0.1
    /- Change log output to 24 hours instead of 1 minute
    /- When adding or removing subs send log once complete instead of at start
    /- Add PACKAGE var to import package.json
    /- Add NAME and VERSION vars to import name and version from PACKAGE
    /- Use NAME and VERSION in _outLog on startup
    /- remove 3 #'s from hr in _outLog to make up for adding version
    /- add 3 #'s to hr if not starting up to make up for 3 removed
    v1.0.2
    /- Change format of saves so month and day are included in filename
        /- Data/Poloniex/BTCUSD/2018/5-1.csv
        /- Add day var in _saveCandles path section
        /- Remove month from items in _saveCandles
        /- Add filename var in _saveCandles constructed with day and month
        /- Add filename to end of path instead of "data.csv"
    /- Add +1 to the month so it goes from 1-12 instead of 0-11
    /- Redo error section so non-string errors are stringified before being
       sent
    /- Other minor code improvements
    /- When WS is opened, wait 3 seconds before saying that data is being
       collected in case WS spits an error immediately after opening.
    v1.0.3
    /- Add a comma after PACKAGE declaration
    /- Add commas after var definitions in functions where necessary
    v1.0.4
    /- When the WS is closed, stringify reason and send to log, then attempt
       to reconnect to WS
       /- In case the WS is unexpectedly closed during data collection
    v1.0.5
    /- Only use currencyPair when absolutely necessary. Use pair instead because
       we can always convert currencyPair to pair but not reverse
    /- Store currencyPair to pair relations in _getSubs so I can still subscribe
       and unsubscribe properly when adding or removing pairs
    /- Use function _f = (){} instead of _f = function () to be consistent with
       var declarations
    /- Remove unnecessary let in _saveCandles
    /- Add _openWebSocket function when initializing WS
    v1.0.6
    /- Stop trying to stringify the error in case the error is circular
    /- Make sure to not add the error to a string when logging to avoid
       [Object object] response
    /- Move up the _openWebSocket function and call it whenever I need to open
       WS
    /- Handle WS 'error' after defining _openWebSocket. error -> open -> close
       -> message
    v1.0.7
    /- stop stringifying reason in poloniex close log for same reasons as in
       error section
    /- add "No response from server" check in WS close handling to be similar
       to Gdax
    /- remove msg var from WS open section since not being used and to keep
       consistent with Gdax
    v1.0.8
    /- add PAIRSFILE and EXCHANGE
    /- change POLONIEX to a var
    /- replace _getSubs, _saveCandles, and script section with Bitfinex version
    /- add _onTrade from scannerBitfinex
    /- add _startupMessage from scannerBitfinex
    /- redo WS functionality similar to others (based on Bitfinex)
    /- remove _currencyPairToPair
    /- add pairIdToPair and pairToPairId like in Gdax

*/

// imports
var fs = require('fs'),
    Poloniex = require('poloniex-api-node')

// vars
const PACKAGE = JSON.parse(fs.readFileSync('package.json')),
    NAME = PACKAGE.name,
    VERSION = PACKAGE.version,
    SAVE_INTERVAL = 15, // candle size in seconds
    LOG_INTERVAL = 60*60*24, // hr output period in seconds
    TS_START = (new Date()).getTime(), // starting time in ms
    PAIRSFILE = "pairsPoloniex.json", // name of file where pairs are stored
    EXCHANGE = "Poloniex" // exchange name
var POLONIEX = new Poloniex(),
    tsLast = {}, // object storing last timestamp for each pair
    tsLastLog = 0, // integer storing the timestamp of the last log update
    priceLast = {}, // object storing last price for each pair
    trades = {}, // object containing lists of trades used to compile the next candles
    subs = [] // list of currency pairs that im currently subscribed too
    pairToPairId = {} // converts pair to 'pair id' used by exchange
    pairIdToPair = {} // converts pair id to pair

// functions
function _outLog() {
    let hr = "#############",
        ts = (new Date()).getTime(),
        timeRunning = ts - TS_START,
        daysRunning = timeRunning / (1000 * 60 * 60 * 24),
        timeSinceLast = ts - tsLastLog
    // get hr
    if (tsLastLog == 0) {
        hr = `${hr} ${NAME} v${VERSION} started up ${hr}`
    } else {
        hr += "#####"
        if (timeSinceLast/1000 > LOG_INTERVAL) {
            hr = `${hr} days since start: ${daysRunning.toFixed(2)} ${hr}`
        } else return
    }
    // output log and update tsLastLog
    console.log(hr)
    tsLastLog = ts
}

function _startupMessage(exchange) {
    console.log(`${exchange} WebSocket open.`)
    setTimeout(() => {
        console.log("Now collecting and storing candle data.")
    }, 3000)
}

function _getSubs(filename) {
    // update subscriptions from json file
    // - get pairs from json then newSubs from pairs
    let pairs = JSON.parse(fs.readFileSync(filename)),
        newSubs = [],
        pairToCurrencyPair = {}
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i],
                currencyPair = base+"_"+asset,
                pair = asset+base
            pairToCurrencyPair[pair] = currencyPair
            if (newSubs.indexOf(pair) < 0) {
                newSubs.push(pair)
            }
        }
    }
    // - compare newSubs to subs
    // -- unsub outdated subs
    for (i in subs) {
        let pair = subs[i],
            currencyPair = pairToCurrencyPair[pair]
        if (newSubs.indexOf(pair) < 0) {
            delete trades[pair]
            delete tsLast[pair]
            delete priceLast[pair]
            subs.splice(i, 1)
            console.log(`Removed subscription to ${pair}.`)
        }
    }
    // -- add new subs
    for (i in newSubs) {
        let pair = newSubs[i],
            currencyPair = pairToCurrencyPair[pair]
        if (subs.indexOf(pair) < 0) {
            trades[pair] = []
            tsLast[pair] = (new Date()).getTime()
            priceLast[pair] = 0
            subs.push(pair)
            console.log(`Subscribed to ${pair}.`)
        }
    }
}

function _saveCandles(exchange) {
    // convert trade data to candles and save to storage
    // - backup trades, reset trades
    let tradeData = {}
    for (pair in trades) {
        tradeData[pair] = trades[pair]
        trades[pair] = []
    }
    // - cycle through subs
    for (i in subs) {
        let pair = subs[i],
            // get timestamps
            ts1 = tsLast[pair],
            ts2 = (new Date()).getTime(),
            // get trades for this pair only
            tradeList = tradeData[pair],
            // initialize ohlc and volume
            ohlc = [0, 0, 0, 0],
            volume = 0
        tsLast[pair] = ts2
        // get ohlc and volume
        if (tradeList.length == 0) {
            if (priceLast[pair] == 0) continue
            let price = priceLast[pair]
            ohlc = [price, price, price, price]
        } else {
            ohlc = [
                tradeList[0].price,
                tradeList[0].price,
                tradeList[0].price,
                tradeList[tradeList.length - 1].price
            ]
            for (j in tradeList) {
                if (tradeList[j].price > ohlc[1]) ohlc[1] = tradeList[j].price
                if (tradeList[j].price < ohlc[2]) ohlc[2] = tradeList[j].price
                volume += tradeList[j].amount
            }
        }
        // get candle
        let candle = `${ts1},${ts2},`
        for (j in ohlc) candle += `${ohlc[j]},`
        candle += volume
        // get path
        let date = new Date(ts2),
            day = date.getDate(),
            month = date.getMonth() + 1,
            year = date.getFullYear(),
            path = "",
            items = [`Data/`, `${exchange}/`, `${pair}/`, `${year}/`],
            filename = `${month}-${day}.csv`
        // make sure path exists one level at a time
        for (i in items) {
            path += items[i]
            if (!fs.existsSync(path)) fs.mkdirSync(path)
        }
        path += filename
        // append candle to path
        fs.appendFileSync(path, candle + "\n")
    }
}

// initialize websocket
function _onTrade(pair, amount, price) {
    trades[pair].push({
        amount: amount,
        price: price
    })
    priceLast[pair] = price
}

function _setWSMethods(WS) {
    WS.on('error', (err) => {
        console.log("Error:")
        console.log(err)
        if (err.indexOf("statusCode: 522") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => _openWebSocket(), 1000)
        } else if (err.indexOf("statusCode: 502") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => _openWebSocket(), 1000)
        }
    })

    WS.on('open', () => {
        _startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        console.log("Gdax WebSocket closed.")
        if (res == undefined) res = "No response from server."
        console.log(res)
        console.log("Trying to reopen the WebSocket...")
        setTimeout(() => _openWebSocket(), 1000)
    })

    WS.on('message', (channelName, data, seq) => {
        for (i in data) {
            if (data[i].type == "newTrade") {
                let pairId = channelName,
                    pair = pairIdToPair[pairId]
                if (subs.indexOf(pair) > -1) {
                    let trade = data[i].data,
                        amount = parseFloat(trade.amount),
                        price = parseFloat(trade.rate)
                    _onTrade(pair, amount, price)
                }
            }
        }
    })
}

function _openWebSocket() {
    POLONIEX = new Poloniex()
    // get a list of pairs
    POLONIEX.returnTicker((err, ticker) => {
        if (err) throw err
        let pairIds = Object.keys(ticker)
        for (i in pairIds) {
            let pairId = pairIds[i],
                pairIdArr = pairId.split('_'),
                base = pairIdArr[0],
                asset = pairIdArr[1],
                pair = asset+base
            pairToPairId[pair] = pairId
            pairIdToPair[pairId] = pair
            POLONIEX.subscribe(pairId)
        }
        _setWSMethods(POLONIEX)
        POLONIEX.openWebSocket({version: 2})
    })
}

// script
_outLog()
_getSubs(PAIRSFILE)
_openWebSocket()
// - messages from initializing WS will appear here

// - start collecting
setInterval(() => {
    // save candles and refresh subscriptions every SAVE_INTERVAL
    _outLog()
    _saveCandles(EXCHANGE)
    _getSubs(PAIRSFILE)
}, SAVE_INTERVAL * 1000)
