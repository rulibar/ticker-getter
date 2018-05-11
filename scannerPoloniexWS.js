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
    // update subs var and poloniex subscriptions from json file
    // init trades[currencyPair] if a new pair is added, don't delete until next write cycle
    // sets priceLast to 0 for new pairs, delete for removed pairs
    // sets tsLast to current time for new pairs, delete for removed pairs
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
            poloniex.unsubscribe(currencyPair)
            delete trades[currencyPair]
            delete tsLast[currencyPair]
            delete priceLast[currencyPair]
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
    let tradeData = {}
    // backup trades, reset trades
    for (currencyPair in trades) {
        tradeData[currencyPair] = trades[currencyPair]
        trades[currencyPair] = []
    }
    // cycle through subs, get candle data
    for (i in subs) {
        let currencyPair = subs[i]
        // get timestamps
        let ts1 = tsLast[currencyPair]
        let ts2 = (new Date()).getTime()
        tsLast[currencyPair] = ts2
        // get trades for this pair only
        let tradeList = tradeData[currencyPair]
        // get ohlc and volume
        let ohlc = [0, 0, 0, 0]
        let volume = 0
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
        // get candle string
        let candle = ts1+","
        candle += ts2+","
        for (j in ohlc) {
            candle += ohlc[j]+","
        }
        candle += volume
        console.log("Candle recieved for "+currencyPair)
        console.log(candle)
    }
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
                let currencyPair = channelName
                let trade = data[i].data
                let amount = parseFloat(trade.amount)
                let price = parseFloat(trade.rate)
                trades[currencyPair].push({
                    amount: amount,
                    price: price
                })
                priceLast[currencyPair] = price
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
