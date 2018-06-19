/*
scannerBinance.js
Description: A candle data compiler and saver for Binance exchange. Periodically
cycles through the pairs in pairsBinance.json, compile candle data, and store to
the Data file. See README.md

v1.1

*/

// imports
var lib = require('./tgLib'),
    Binance = require('node-binance-api')

const PAIRSFILE = "pairsBinance.json", // name of file where pairs are stored
    EXCHANGE = "Binance" // exchange name
var BINANCE = new Binance()

// initialize websocket
function openWS() {
    // get a list of pairs
    BINANCE.prices((err, ticker) => {
        if (err) throw err
        // set up WS
        BINANCE.websockets.trades(Object.keys(ticker), (trade) => {
            if (trade.e == "trade") {
                let pair = trade.s
                if (lib.subs.indexOf(pair) > -1) {
                    let amount = parseFloat(trade.q),
                        price = parseFloat(trade.p)
                    lib.onTrade(pair, amount, price)
                }
            }
        })
        lib.startupMessage(EXCHANGE)
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
