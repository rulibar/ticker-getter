/*
scannerGdax.js
Description: A candle data compiler and saver for Gdax exchange. Periodically
cycles through the pairs in pairsGdax.json, compile candle data, and store to
the Data file. See README.md

v1.0
    v1.0.7
    /- copy over scannerBitfinex and modify header
    /- copy and modify pairsBitfinex to pairsGdax.json
    /- install gdax in npm
    /- add pairToPairId and pairIdToPair to track relationships between pairs
       and IDs used by the exchange. Set this up when opening WS
    /- complete the functionality by using the other scanners as reference
    v1.0.8
    /- add EXCHANGE
    /- copy _startupMessage from scannerBinance and use when WS open
    /- copy _saveCandles from scannerBinance and send EXCHANGE to it
    /- add PAIRSFILE to track name of pairs file
    /- use PAIRSFILE as argument in _getSubs()
    /- add _onTrade to handle the WS trade data we care about
    v1.0.9
    /- import tgLib as lib
    /- remove PACKAGE, NAME, VERSION, SAVE_INTERVAL, LOG_INTERVAL, TS_START
    /- remove tsLast, tsLastLog, priceLast, trades, subs, pairToPairId,
       and pairIdToPair
    /- remove _outLog, _startupMessage, _getSubs, _saveCandles, _onTrade
    /- replace all with corresponding from lib
    /- rename _openWebSocket to openWS and _setWSMethods to setWSMethods
    /- stop importing fs

*/

// imports
var lib = require('./tgLib'),
    Gdax = require('gdax')

const PAIRSFILE = "pairsGdax.json", // name of file where pairs are stored
    EXCHANGE = "Gdax" // exchange name
var GDAX = new Gdax.PublicClient()

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
        console.log("Gdax WebSocket closed.")
        if (res == undefined) res = "No response from server."
        console.log(res)
        console.log("Trying to reopen the WebSocket...")
        setTimeout(() => openWS(), 1000)
    })

    WS.on('message', (msg) => {
        if (msg.type == "match") {
            let pairId = msg.product_id,
                pair = lib.pairIdToPair[pairId]
            if (lib.subs.indexOf(pair) > -1) {
                let amount = parseFloat(msg.size),
                    price = parseFloat(msg.price)
                lib.onTrade(pair, amount, price)
            }
        }
    })
}

function openWS() {
    GDAX = new Gdax.PublicClient()
    // get a list of pairs
    GDAX.getProducts((err, response, data) => {
        if (err) throw err
        for (i in data) {
            let pairId = data[i].id,
                base = data[i].quote_currency,
                asset = data[i].base_currency,
                pair = asset+base
            lib.pairToPairId[pair] = pairId
            lib.pairIdToPair[pairId] = pair
        }
        // set up WS
        GDAX = new Gdax.WebsocketClient(Object.keys(lib.pairIdToPair))
        setWSMethods(GDAX)
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
