/*
scannerPoloniex.js
Description: A candle data compiler and saver for Poloniex exchange. Periodically
cycles through the pairs in pairsPoloniex.json, compile candle data, and store to
the Data file. See README.md

v1.0
- Initial stable version
    v1.0.0
    - 
*/

// imports
var fs = require('fs'),
    Poloniex = require('poloniex-api-node')

// vars
const SAVE_INTERVAL = 15, // candle size in seconds
    LOG_INTERVAL = 60, //*60*24 // hr output period in seconds
    POLONIEX = new Poloniex(),
    TS_START = (new Date()).getTime() // starting time in ms
var tsLast = {}, // object storing last timestamp for each pair
    tsLastLog = 0, // integer storing the timestamp of the last log update
    priceLast = {}, // object storing last price for each pair
    trades = {}, // object containing lists of trades used to compile the next candles
    subs = [] // list of currency pairs that im currently subscribed too

// functions
_outLog = function () {
    let hr = "################",
        ts = (new Date()).getTime()
        timeRunning = ts - TS_START
        daysRunning = timeRunning / (1000 * 60 * 60 * 24)
        timeSinceLast = ts - tsLastLog
    // get hr
    if (tsLastLog == 0) {
        hr = `${hr} ticker getter 1 started up ${hr}`
    } else {
        hr += "##"
        if (timeSinceLast/1000 > LOG_INTERVAL) {
            hr = `${hr} days since start: ${daysRunning.toFixed(2)} ${hr}`
        } else return
    }
    // output log and update tsLastLog
    console.log(hr)
    tsLastLog = ts
}

_currencyPairToPair = function (currencyPair) {
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

_getSubs = function () {
    // update subscriptions from json file
    // - get pairs from json then newSubs from pairs
    let pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json')),
        newSubs = []
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i],
                pair = asset+base,
                currencyPair = base+"_"+asset
            if (newSubs.indexOf(currencyPair) < 0) {
                newSubs.push(currencyPair)
            }
        }
    }
    // - compare newSubs to subs
    // -- unsub outdated subs
    for (i in subs) {
        let currencyPair = subs[i],
            pair = _currencyPairToPair(currencyPair)
        if (newSubs.indexOf(currencyPair) < 0) {
            console.log(`Removing subscription to ${pair}.`)
            POLONIEX.unsubscribe(currencyPair)
            delete trades[currencyPair]
            delete tsLast[currencyPair]
            delete priceLast[currencyPair]
            subs.splice(i, 1)
        }
    }
    // -- add new subs
    for (i in newSubs) {
        let currencyPair = newSubs[i],
            pair = _currencyPairToPair(currencyPair)
        if (subs.indexOf(currencyPair) < 0) {
            console.log(`Subscribed to ${pair}.`)
            trades[currencyPair] = []
            tsLast[currencyPair] = (new Date()).getTime()
            priceLast[currencyPair] = 0
            POLONIEX.subscribe(currencyPair)
            subs.push(currencyPair)
        }
    }
}

_saveCandles = function () {
    // convert trade data to candles and save to storage
    // - backup trades, reset trades
    let tradeData = {}
    for (currencyPair in trades) {
        tradeData[currencyPair] = trades[currencyPair]
        trades[currencyPair] = []
    }
    // - cycle through subs
    for (i in subs) {
        let currencyPair = subs[i],
            // get timestamps
            ts1 = tsLast[currencyPair],
            ts2 = (new Date()).getTime(),
            // get trades for this pair only
            tradeList = tradeData[currencyPair],
            // initialize ohlc and volume
            ohlc = [0, 0, 0, 0],
            volume = 0
        tsLast[currencyPair] = ts2
        // get ohlc and volume
        if (tradeList.length == 0) {
            if (priceLast[currencyPair] == 0) continue
            let price = priceLast[currencyPair]
            ohlc = [price, price, price, price]
        } else {
            ohlc = [
                tradeList[0].price,
                tradeList[0].price,
                tradeList[0].price,
                tradeList[tradeList.length - 1].price
            ]
            for (let j in tradeList) {
                if (tradeList[j].price > ohlc[1]) {
                    ohlc[1] = tradeList[j].price
                }
                if (tradeList[j].price < ohlc[2]) {
                    ohlc[2] = tradeList[j].price
                }
                volume += tradeList[j].amount
            }
        }
        // get candle
        let candle = `${ts1},${ts2},`
        for (j in ohlc) {candle += `${ohlc[j]},`}
        candle += volume
        // get path
        let pair = _currencyPairToPair(currencyPair),
            date = new Date(ts2),
            month = date.getMonth(),
            year = date.getFullYear(),
            path = "",
            items = ["Data/", "Poloniex/", `${pair}/`, `${year}/`, `${month}/`]
        // make sure path exists one level at a time
        for (i in items) {
            path += items[i]
            if (!fs.existsSync(path)) {fs.mkdirSync(path)}
        }
        path += "data.csv"
        // append candle to path
        fs.appendFileSync(path, candle + "\n")
    }
}

// initialize websocket
POLONIEX.on('open', (msg) => {
    console.log("Poloniex WebSocket open.")
    console.log("Now collecting and storing candle data.")
})

POLONIEX.on('close', (reason) => {
    console.log("Poloniex WebSocket closed.")
})

POLONIEX.on('message', (channelName, data, seq) => {
    try {
        for (i in data) {
            if (data[i].type == "newTrade") {
                let currencyPair = channelName,
                    trade = data[i].data,
                    amount = parseFloat(trade.amount),
                    price = parseFloat(trade.rate)
                trades[currencyPair].push({
                    amount: amount,
                    price: price
                })
                priceLast[currencyPair] = price
            }
        }
    } catch (err) {console.log(err)}
})

POLONIEX.on('error', (err) => {
    console.log(`Error: '${err}'`)
    if (typeof(err) != "string") {
        err = JSON.stringify(err)
    } else {
        if (err.indexOf("statusCode: 522") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => {
                POLONIEX.openWebSocket({version: 2})
            }, 1000)
        } else if (err.indexOf("statusCode: 502") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => {
                POLONIEX.openWebSocket({version: 2})
            }, 1000)
        }
    }
})

// script
_outLog()
_getSubs()
POLONIEX.openWebSocket({version: 2})

// - messages from initializing WS will appear here
setInterval(() => {
    // save candles and refresh subscriptions every SAVE_INTERVAL
    _outLog()
    _saveCandles()
    _getSubs()
}, SAVE_INTERVAL * 1000)
