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
    POLONIEX = new Poloniex(),
    TS_START = (new Date()).getTime() // starting time in ms
var tsLast = {}, // object storing last timestamp for each pair
    tsLastLog = 0, // integer storing the timestamp of the last log update
    priceLast = {}, // object storing last price for each pair
    trades = {}, // object containing lists of trades used to compile the next candles
    subs = [] // list of currency pairs that im currently subscribed too

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

function _currencyPairToPair(currencyPair) {
    let currencyPairArr = currencyPair.split("_"),
        pair = ""
    // make sure pair arr has 2 elements
    if (currencyPairArr.length != 2) {
        let err = "Error in _currencyPairToPair: "
        err += `currencyPair not recognized '${currencyPair}'`
        console.log(err)
        return pair
    }
    // return pair
    pair += currencyPairArr[1] + currencyPairArr[0]
    return pair
}

function _getSubs() {
    // update subscriptions from json file
    // - get pairs from json then newSubs from pairs
    let pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json')),
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
            POLONIEX.unsubscribe(currencyPair)
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
            POLONIEX.subscribe(currencyPair)
            subs.push(pair)
            console.log(`Subscribed to ${pair}.`)
        }
    }
}

function _saveCandles() {
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
            items = ["Data/", "Poloniex/", `${pair}/`, `${year}/`],
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
function _openWebSocket() {
    POLONIEX.openWebSocket({version: 2})
}

POLONIEX.on('error', (err) => {
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

POLONIEX.on('open', (msg) => {
    console.log("Poloniex WebSocket open.")
    // - startup message
    setTimeout(() => {
        console.log("Now collecting and storing candle data.")
    }, 3000)
})

POLONIEX.on('close', (reason) => {
    console.log("Poloniex WebSocket closed.")
    console.log(JSON.stringify(reason))
    console.log("Trying to reopen the WebSocket...")
    setTimeout(() => _openWebSocket(), 1000)
})

POLONIEX.on('message', (channelName, data, seq) => {
    try {
        for (i in data) {
            if (data[i].type == "newTrade") {
                let currencyPair = channelName,
                    pair = _currencyPairToPair(currencyPair)
                    trade = data[i].data,
                    amount = parseFloat(trade.amount),
                    price = parseFloat(trade.rate)
                trades[pair].push({
                    amount: amount,
                    price: price
                })
                priceLast[pair] = price
            }
        }
    } catch (err) {console.log(err)}
})

// script
_outLog()
_getSubs()
_openWebSocket()
// - messages from initializing WS will appear here

// - start collecting
setInterval(() => {
    // save candles and refresh subscriptions every SAVE_INTERVAL
    _outLog()
    _saveCandles()
    _getSubs()
}, SAVE_INTERVAL * 1000)
