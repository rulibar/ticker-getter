/*
scannerBitfinex.js
Description: A candle data compiler and saver for Bitfinex exchange. Periodically
cycles through the pairs in pairsBitfinex.json, compile candle data, and store to
the Data file. See README.md

v1.0

*/

// imports
var lib = require('./tgLib'),
    Bitfinex = require('bitfinex-api-node')

const PAIRSFILE = "pairsBitfinex.json", // name of file where pairs are stored
    EXCHANGE = "Bitfinex" // exchange name
var BITFINEX = new Bitfinex()

// initialize websocket
function setWSMethods(WS) {
    WS.on('error', (err) => {
        console.log("Error:")
        console.log(err)
    })

    WS.on('open', () => {
        lib.startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        console.log("Bitfinex WebSocket closed.")
        if (res == undefined) res = "No response from server."
        console.log(res)
        console.log("Trying to reopen the WebSocket...")
        setTimeout(() => openWS(), 1000)
    })

    WS.onTradeEntry({}, (data, info) => {
        let pair = info.pair
        if (lib.subs.indexOf(pair) > -1) {
            let trade = data[0],
                amount = Math.abs(trade[2]),
                price = trade[3]
            lib.onTrade(pair, amount, price)
        }
    })
}

function openWS() {
    BITFINEX = (new Bitfinex()).rest()
    // get a list of pairs
    BITFINEX.symbols((err, symbols) => {
        if (err) throw err
        for (i in symbols) symbols[i] = symbols[i].toUpperCase()
        // set up WS
        BITFINEX = (new Bitfinex()).ws()
        setWSMethods(BITFINEX)
        BITFINEX.on('open', () => {
            for (i in symbols) BITFINEX.subscribeTrades(symbols[i])
        })
        BITFINEX.open()
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
