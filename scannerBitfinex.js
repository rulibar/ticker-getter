/*
scannerBitfinex.js
Description: A candle data compiler and saver for Bitfinex exchange. Periodically
cycles through the pairs in pairsBitfinex.json, compile candle data, and store to
the Data file. See README.md

v1.1
    v1.1.1
    /- use EXCHANGE in WS closed message instead of typing explicitly
    /- stop saying no response from server when WS closed
    /- combine log outputs into one line when WS closed
    /- replace log messages with the new lib.outMsg(str) to add a timestamp
    /- only log err if there was actually an error

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
        lib.outMsg("Error!")
        if (err) console.log(err)
    })

    WS.on('open', () => {
        lib.startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        lib.outMsg(`${EXCHANGE} WebSocket closed. Trying to reconnect...`)
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
