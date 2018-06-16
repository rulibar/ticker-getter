/*
scannerGdax.js
Description: A candle data compiler and saver for Gdax exchange. Periodically
cycles through the pairs in pairsGdax.json, compile candle data, and store to
the Data file. See README.md

v1.0
    v1.0.7
    /- copy over scannerBitfinex and modify header
    /- copy and modify pairsBitfinex to pairsGdax.json
    /- install gdax in npm
    /- add pairToPairId and pairIdToPair to track relationships between pairs
       and IDs used by the exchange. Set this up when opening WS
    /- complete the functionality by using the other scanners as reference

*/

// imports
var fs = require('fs'),
    Gdax = require('gdax')

const PACKAGE = JSON.parse(fs.readFileSync('package.json')),
    NAME = PACKAGE.name,
    VERSION = PACKAGE.version,
    SAVE_INTERVAL = 15, // candle size in seconds
    LOG_INTERVAL = 60*60*24, // hr output period in seconds
    TS_START = (new Date()).getTime() // starting time in ms
var GDAX = new Gdax.PublicClient(),
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

function _getSubs() {
    // update subscriptions from json file
    // - get pairs from json then newSubs from pairs
    let pairs = JSON.parse(fs.readFileSync('pairsGdax.json')),
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
            items = ["Data/", "Gdax/", `${pair}/`, `${year}/`],
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
function _setWSMethods(WS) {
    WS.on('error', (err) => {
        console.log("Error:")
        console.log(err)
    })

    WS.on('open', () => {
        console.log("Gdax WebSocket open.")
        // - startup message
        setTimeout(() => {
            console.log("Now collecting and storing candle data.")
        }, 3000)
    })

    WS.on('close', (res) => {
        console.log("Gdax WebSocket closed.")
        if (res == undefined) res = "No response from server."
        console.log(res)
        console.log("Trying to reopen the WebSocket...")
        setTimeout(() => _openWebSocket(), 1000)
    })

    WS.on('message', (msg) => {
        if (msg.type == "match") {
            let pairId = msg.product_id,
                pair = pairIdToPair[pairId]
            if (subs.indexOf(pair) > -1) {
                let amount = parseFloat(msg.size),
                    price = parseFloat(msg.price)
                trades[pair].push({
                    amount: amount,
                    price: price
                })
                priceLast[pair] = price
            }
        }
    })
}

function _openWebSocket() {
    // get a list of pairs
    GDAX = new Gdax.PublicClient()
    GDAX.getProducts((err, response, data) => {
        if (err) throw err
        // get pairs
        for (i in data) {
            let pairId = data[i].id,
                base = data[i].quote_currency,
                asset = data[i].base_currency,
                pair = asset+base
            pairToPairId[pair] = pairId
            pairIdToPair[pairId] = pair
        }
        // set up WS
        GDAX = new Gdax.WebsocketClient(Object.keys(pairIdToPair))
        _setWSMethods(GDAX)
    })
}

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
