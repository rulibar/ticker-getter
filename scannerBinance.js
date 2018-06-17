/*
scannerBinance.js
Description: A candle data compiler and saver for Binance exchange. Periodically
cycles through the pairs in pairsBinance.json, compile candle data, and store to
the Data file. See README.md

v1.0
    v1.0.4
    /- creation of scannerBinance.js and pairsBinance.js
    v1.0.5
    /- add version control to scannerBinance.js header
    /- add the same pairs to pairsBinance as pairsPoloniex
    /- import fs and node-binance-api
    /- install node-binance-api into package
    /- replicate scannerPoloniex code for Binance and use as the initial
       functional release of scannerBinance
    v1.0.6
    /- make _getSubs more similar to Poloniex by tracking currencyPairs
    v1.0.7
    /- stop parsing float in ticker in _openWebSocket and simplify code
    v1.0.8
    /- remove allPairs from _openWebSocket and use Object.keys instead
    /- change some comments
    /- add _startupMessage function
    /- add EXCHANGE to store the exchange name
    /- use EXCHANGE as an argument when calling _startupMessage and
       _saveCandles
    /- add PAIRSFILE to track name of pairs file
    /- use PAIRSFILE as argument in _getSubs()
    /- copy _onTrade from scannerGdax
    /- remove _onMessage and use _onTrade instead
    /- refer to BINANCE as a var instead of constant
    v1.0.9
    /- import tgLib as lib
    /- remove all constants except PAIRSFILE and EXCHANGE and call from lib
    /- remove tsLastLog
    /- remove _outLog and _startupMessage and call from lib
    /- remove tsLast, priceLast, trades, subs
    /- remove _getSubs and _saveCandles and call from lib
    /- remove _onTrade and call from lib
    /- rename _openWebSocket to openWS
    /- stop importing fs

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
