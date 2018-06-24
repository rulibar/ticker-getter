/*
scannerPoloniex.js
Description: A candle data compiler and saver for Poloniex exchange. Periodically
cycles through the pairs in pairsPoloniex.json, compile candle data, and store to
the Data file. See README.md

v1.1
    v1.1.1
    /- use EXCHANGE in WS closed message instead of typing explicitly
    /- replace log messages with the new lib.outMsg(str) to add a timestamp
    /- add a try/catch to error handling for converting to string and checking
       error type

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
        lib.outMsg("Error!")
        if (err) console.log(err)
        try {
            err = JSON.stringify(err)
            if (err.indexOf("statusCode: 522") > -1) {
                lib.outMsg("WS failed to open. Retrying...")
                setTimeout(() => openWS(), 1000)
            } else if (err.indexOf("statusCode: 502") > -1) {
                lib.outMsg("WS failed to open. Retrying...")
                setTimeout(() => openWS(), 1000)
            }
        } catch (err) {console.log(err)}
    })

    WS.on('open', () => {
        lib.startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        lib.outMsg(`${EXCHANGE} WebSocket closed.`)
        if (res == undefined) res = "No response from server."
        if (res) console.log(res)
        lib.outMsg("Trying to reopen the WebSocket...")
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
