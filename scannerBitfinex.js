/*
scannerBitfinex.js
Description: A candle data compiler and saver for Bitfinex exchange. Periodically
cycles through the pairs in pairsBitfinex.json, compile candle data, and store to
the Data file. See README.md

v1.0
    v1.0.6
    /- creation of scannerBitfinex.js and pairsBitfinex.json
    /- add version control to scannerBinance.js header
    /- add the same pairs to pairsBitfinex as pairsBinance (USD instead of USDT)
    /- copy scannerBinance code
    /- replace Binance and BINANCE to Bitfinex and BITFINEX
    /- install bitfinex-api-node into package.
    /- import pairsBitfinex instead of pairsBinance
    /- change Binance/ to Bitfinex/ in _saveCandles
    /- clear out initialize websocket section and redo for Bitfinex similar to
       Poloneix
    /- subscribe and unsubscribe from WS trade data in _getSubs but only when
       the WS is open
    /- when WS is opened, subscribe to all pairs in subs to make up for not
       doing so in _getSubs
    v1.0.7
    /- when logging an error do the same format as poloniex
    /- when the websocket is closed, do a timeout to reopen after 1 second
    /- when WS is closed, use same response format as Gdax and Poloniex
    v1.0.8
    /- add PAIRSFILE and EXCHANGE
    /- add _startupMessage and use when WS open
    /- use PAIRSFILE in _getSubs
    /- copy _saveCandles from scannerBinance and start sending EXCHANGE to it
    /- copy _onTrade from scannerGdax and call in onTradeEntry
    /- redo the WS programming to function like Binance and Gdax rather than
       Poloniex (see notesRyan)
    v1.0.9
    /- fix bug where it says Gdax WS closed
    /- import ./tgLib.js
    /- store PACKAGE, NAME, VERSION, TS_START in tgLib
    /- store _outLog in tgLib as outLog
    /- most var tsLastLog to tgLib
    /- move _startupMessage to tgLib as startupMessage
    /- move over LOG_INTERVAL
    /- move over SAVE_INTERVAL
    /- move over _getSubs and call from lib
    /- move over _saveCandles and call from lib
    /- move over subs and import with lib
    /- move over _onTrade function as onTrade
    /- rename _openWebSocket to openWS
    /- rename _setWSMethods to setWSMethods
    /- stop importing fs

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
