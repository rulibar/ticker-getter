/*
tgLib.js
Description: Store common vars and functions from TG

v1.0
    v1.0.9
    /- set up header and labels
    /- import fs, add PACKAGE, NAME, PACKAGE, TS_START
    /- add _outLog as outLog
    /- move over tsLastLog var
    /- add _startupMessage as startupMessage
    /- add pairToPairId and pairIdToPair vars
    /- add SAVE_INTERVAL and LOG_INTERVAL, export SAVE_INTERVAL
    /- add _getSubs as getSubs
    /- remove currencyPairToPair from _getSubs
    /- stop defining currencyPair in _getSubs
    /- add subs and export as subs
    /- add _saveCandles as saveCandles
    /- add tsLast, priceLast and trades and export latter 2
    /- add _onTrade as onTrade
    /- stop exporting priceLast and trades
    /- start exporting pairToPairId and pairIdToPair
    /- say "unsubscribed from" instead of "removed subscription to"

*/

// imports
var fs = require('fs')

// vars
const PACKAGE = JSON.parse(fs.readFileSync('package.json')),
    NAME = PACKAGE.name,
    VERSION = PACKAGE.version,
    SAVE_INTERVAL = 15, // candle size in seconds
    LOG_INTERVAL = 60*60*24, // hr output period in seconds
    TS_START = (new Date()).getTime() // starting time in ms
var tsLast = {}, // object storing last timestamp for each pair
    tsLastLog = 0, // integer storing the timestamp of the last log update
    priceLast = {}, // object storing last price for each pair
    trades = {}, // object containing lists of trades used to compile the next candles
    subs = [], // list of currency pairs that im currently subscribed too
    pairToPairId = {}, // converts pair to 'pair id' used by exchange
    pairIdToPair = {} // converts pair id to pair

// functions
function outLog() {
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

function startupMessage(exchange) {
    console.log(`${exchange} WebSocket open.`)
    setTimeout(() => {
        console.log("Now collecting and storing candle data.")
    }, 3000)
}

function getSubs(filename) {
    // update subscriptions from json file
    // - get pairs from json then newSubs from pairs
    let pairs = JSON.parse(fs.readFileSync(filename)),
        newSubs = []
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i]
                pair = asset+base
            if (newSubs.indexOf(pair) < 0) {
                newSubs.push(pair)
            }
        }
    }
    // - compare newSubs to subs
    // -- unsub outdated subs
    for (i in subs) {
        let pair = subs[i]
        if (newSubs.indexOf(pair) < 0) {
            delete trades[pair]
            delete tsLast[pair]
            delete priceLast[pair]
            subs.splice(i, 1)
            console.log(`Unsubscribed from ${pair}.`)
        }
    }
    // -- add new subs
    for (i in newSubs) {
        let pair = newSubs[i]
        if (subs.indexOf(pair) < 0) {
            trades[pair] = []
            tsLast[pair] = (new Date()).getTime()
            priceLast[pair] = 0
            subs.push(pair)
            console.log(`Subscribed to ${pair}.`)
        }
    }
}

function saveCandles(exchange) {
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

function onTrade(pair, amount, price) {
    trades[pair].push({
        amount: amount,
        price: price
    })
    priceLast[pair] = price
}

module.exports = {
    SAVE_INTERVAL: SAVE_INTERVAL,
    subs: subs,
    pairToPairId: pairToPairId,
    pairIdToPair: pairIdToPair,
    outLog: outLog,
    startupMessage: startupMessage,
    getSubs: getSubs,
    saveCandles: saveCandles,
    onTrade: onTrade
}
