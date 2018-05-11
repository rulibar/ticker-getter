/*
scannerPoloniexWS.js
*/

// imports
const fs = require('fs')
const Poloniex = require('poloniex-api-node')

// vars
const hr = "============================================="
const interval = 15 // seconds between updating pairs
const poloniex = new Poloniex()
const tsStart = (new Date()).getTime()/1000
var tsLast = {} // object storing last timestamp for each pair
var priceLast = {} // object storing last price for each pair
var trades = {} // object containing lists of trades used to compile the next candles
var subs = [] // list of currency pairs that im currently subscribed too

// functions
_getSubs = function () {
    // update subscriptions from json file
    // does not reset trades, but if new pair is added, initialize it in trades
    let pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json'))
    // get newSubs
    let newSubs = []
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i]
            let pair = asset+base
            let currencyPair = base+"_"+asset
            if (newSubs.indexOf(currencyPair) < 0) {
                newSubs.push(currencyPair)
            }
        }
    }
    // unsub outdated subs
    for (i in subs) {
        let currencyPair = subs[i]
        if (newSubs.indexOf(currencyPair) < 0) {
            console.log("Removing subscription to "+currencyPair+".")
            delete tsLast[currencyPair]
            delete priceLast[currencyPair]
            poloniex.unsubscribe(currencyPair)
            subs.splice(i)
        }
    }
    // add new subs
    for (i in newSubs) {
        let currencyPair = newSubs[i]
        if (subs.indexOf(currencyPair) < 0) {
            console.log("Subscribed to "+currencyPair+".")
            trades[currencyPair] = []
            tsLast[currencyPair] = (new Date()).getTime()
            priceLast[currencyPair] = 0
            poloniex.subscribe(currencyPair)
            subs.push(currencyPair)
        }
    }
}

_writeCandle = function () {
    let tradesData = {}
    // backup trades, reset trades
    for (currencyPair in trades) {
        tradesData[currencyPair] = trades[currencyPair]
        if (subs.indexOf(currencyPair) >= 0) {
            trades[currencyPair] = []
        } else {
            delete trades[currencyPair]
        }
    }
    // cycle through subs
    for (i in subs) {
        let currencyPair = subs[i]
        // get timestamps
        let ts1 = tsLast[currencyPair]
        let ts2 = (new Date()).getTime()
        console.log(currencyPair+" seconds since last: "+(ts2-ts1)/1000)
        // get trades for this pair only
        let trades = tradesData[currencyPair]
        if (trades.length == 0) {
            continue
        }
        tsLast[currencyPair] = ts2
        console.log(trades)
        let ohlc = [
            trades[0].price,
            trades[0].price,
            trades[0].price,
            trades[trades.length - 1].price
        ]
    }
    // get ohlc
    /*
    for (currencyPair in tradesData) {
        //console.log("Finding ohlc for "+currencyPair)
        let _trades = tradesData[currencyPair]
        let _len = _trades.length
        let _ohlc = [
            _trades[0].price,
            _trades[0].price,
            _trades[0].price,
            _trades[_len - 1].price
        ]
        for (i in _trades) {
            let _trade = _trades[i]
            if (_trade.price > _ohlc[1]) {
                _ohlc[1] = _trade.price
            }
            if (_trade.price < _ohlc[2]) {
                _ohlc[2] = _trade.price
            }
        }
        console.log("ohlc: "+_ohlc)
    }
    */

    //console.log("Writing candle")
    //console.log(tradesData)
    //console.log(tsLast)
}

// initialize websocket
poloniex.on('open', (msg) => {
    console.log("Poloniex WebSocket open.")
    _getSubs()
})

poloniex.on('close', (reason) => {
    console.log("Poloniex WebSocket closed.")
})

poloniex.on('message', (channelName, data, seq) => {
    try {
        for (i in data) {
            if (data[i].type == "newTrade") {
                trades[channelName].push({
                    amount: parseFloat(data[i].data.amount),
                    price: parseFloat(data[i].data.rate)
                })
            }
        }
    } catch (err) {
        console.log(err)
    }
})

poloniex.on('error', (err) => {
    if (typeof(err) != "string") {
        err = JSON.stringify(err)
    }
    console.log("Warning: "+err)
})

poloniex.openWebSocket({version: 2})

// write candle data
console.log(hr)
setInterval(() => {
    console.log(hr)
    _writeCandle()
    _getSubs()
}, interval*1000)
