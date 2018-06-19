/*
scannerPoloniex.js
Description: A candle data compiler and saver for Poloniex exchange. Periodically
cycles through the pairs in pairsPoloniex.json, compile candle data, and store to
the Data file. See README.md

v1.1

*/

// imports
var lib = require('./tgLib'),
    Poloniex = require('poloniex-api-node')

// vars
const PAIRSFILE = "pairsPoloniex.json", // name of file where pairs are stored
    EXCHANGE = "Poloniex" // exchange name
var POLONIEX = new Poloniex()

// initialize WS
function setWSMethods(WS) {
    WS.on('error', (err) => {
        console.log("Error:")
        console.log(err)
        if (err.indexOf("statusCode: 522") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => openWS(), 1000)
        } else if (err.indexOf("statusCode: 502") > -1) {
            console.log("WS failed to open. Retrying...")
            setTimeout(() => openWS(), 1000)
        }
    })

    WS.on('open', () => {
        lib.startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        console.log("Gdax WebSocket closed.")
        if (res == undefined) res = "No response from server."
        console.log(res)
        console.log("Trying to reopen the WebSocket...")
        setTimeout(() => openWS(), 1000)
    })

    WS.on('message', (channelName, data, seq) => {
        for (i in data) {
            if (data[i].type == "newTrade") {
                let pairId = channelName,
                    pair = lib.pairIdToPair[pairId]
                if (lib.subs.indexOf(pair) > -1) {
                    let trade = data[i].data,
                        amount = parseFloat(trade.amount),
                        price = parseFloat(trade.rate)
                    lib.onTrade(pair, amount, price)
                }
            }
        }
    })
}

function openWS() {
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
            lib.pairToPairId[pair] = pairId
            lib.pairIdToPair[pairId] = pair
            POLONIEX.subscribe(pairId)
        }
        setWSMethods(POLONIEX)
        POLONIEX.openWebSocket({version: 2})
    })
}

// script
lib.outLog()
lib.getSubs(PAIRSFILE)
openWS()
// - messages from initializing WS will appear here

// - start collecting
setInterval(() => {
    // save candles and refresh subscriptions every SAVE_INTERVAL
    lib.outLog()
    lib.saveCandles(EXCHANGE)
    lib.getSubs(PAIRSFILE)
}, lib.SAVE_INTERVAL * 1000)
