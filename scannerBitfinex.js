/*
scannerBitfinex.js
Description: A candle data compiler and saver for Bitfinex exchange. Periodically
cycles through the pairs in pairsBitfinex.json, compile candle data, and store to
the Data file. See README.md

v1.0
    v1.0.6
    /- creation of scannerBitfinex.js and pairsBitfinex.json
    /- add version control to scannerBinance.js header
    /- add the same pairs to pairsBitfinex as pairsBinance (USD instead of USDT)
    /- copy scannerBinance code
    /- replace Binance and BINANCE to Bitfinex and BITFINEX
    /- install bitfinex-api-node into package.
    /- import pairsBitfinex instead of pairsBinance
    /- change Binance/ to Bitfinex/ in _saveCandles
    /- clear out initialize websocket section and redo for Bitfinex similar to
       Poloneix
    /- subscribe and unsubscribe from WS trade data in _getSubs but only when
       the WS is open
    /- when WS is opened, subscribe to all pairs in subs to make up for not
       doing so in _getSubs
    v1.0.7
    /- when logging an error do the same format as poloniex
    /- when the websocket is closed, do a timeout to reopen after 1 second
    /- when WS is closed, use same response format as Gdax and Poloniex
    v1.0.8
    /- add PAIRSFILE and EXCHANGE
    /- add _startupMessage and use when WS open
    /- use PAIRSFILE in _getSubs
    /- copy _saveCandles from scannerBinance and start sending EXCHANGE to it
    /- copy _onTrade from scannerGdax and call in onTradeEntry
    /- redo the WS programming to function like Binance and Gdax rather than
       Poloniex (see notesRyan)

*/

// imports
var fs = require('fs'),
    Bitfinex = require('bitfinex-api-node')

const PACKAGE = JSON.parse(fs.readFileSync('package.json')),
    NAME = PACKAGE.name,
    VERSION = PACKAGE.version,
    SAVE_INTERVAL = 15, // candle size in seconds
    LOG_INTERVAL = 60*60*24, // hr output period in seconds
    TS_START = (new Date()).getTime(), // starting time in ms
    PAIRSFILE = "pairsBitfinex.json", // name of file where pairs are stored
    EXCHANGE = "Bitfinex" // exchange name
var BITFINEX = new Bitfinex(),
    tsLast = {}, // object storing last timestamp for each pair
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

    WS.onTradeEntry({}, (data, info) => {
        let pair = info.pair
        if (subs.indexOf(pair) > -1) {
            let trade = data[0],
                amount = Math.abs(trade[2]),
                price = trade[3]
            _onTrade(pair, amount, price)
        }
    })
}

function _openWebSocket() {
    BITFINEX = (new Bitfinex()).rest()
    // get a list of pairs
    BITFINEX.symbols((err, symbols) => {
        if (err) throw err
        for (i in symbols) symbols[i] = symbols[i].toUpperCase()
        // set up WS
        BITFINEX = (new Bitfinex()).ws()
        _setWSMethods(BITFINEX)
        BITFINEX.on('open', () => {
            for (i in symbols) BITFINEX.subscribeTrades(symbols[i])
        })
        BITFINEX.open()
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
