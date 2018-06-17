/*
scannerPoloniex.js
Description: A candle data compiler and saver for Poloniex exchange. Periodically
cycles through the pairs in pairsPoloniex.json, compile candle data, and store to
the Data file. See README.md

v1.0
/- Initial stable version
    v1.0.1
    /- Change log output to 24 hours instead of 1 minute
    /- When adding or removing subs send log once complete instead of at start
    /- Add PACKAGE var to import package.json
    /- Add NAME and VERSION vars to import name and version from PACKAGE
    /- Use NAME and VERSION in _outLog on startup
    /- remove 3 #'s from hr in _outLog to make up for adding version
    /- add 3 #'s to hr if not starting up to make up for 3 removed
    v1.0.2
    /- Change format of saves so month and day are included in filename
        /- Data/Poloniex/BTCUSD/2018/5-1.csv
        /- Add day var in _saveCandles path section
        /- Remove month from items in _saveCandles
        /- Add filename var in _saveCandles constructed with day and month
        /- Add filename to end of path instead of "data.csv"
    /- Add +1 to the month so it goes from 1-12 instead of 0-11
    /- Redo error section so non-string errors are stringified before being
       sent
    /- Other minor code improvements
    /- When WS is opened, wait 3 seconds before saying that data is being
       collected in case WS spits an error immediately after opening.
    v1.0.3
    /- Add a comma after PACKAGE declaration
    /- Add commas after var definitions in functions where necessary
    v1.0.4
    /- When the WS is closed, stringify reason and send to log, then attempt
       to reconnect to WS
       /- In case the WS is unexpectedly closed during data collection
    v1.0.5
    /- Only use currencyPair when absolutely necessary. Use pair instead because
       we can always convert currencyPair to pair but not reverse
    /- Store currencyPair to pair relations in _getSubs so I can still subscribe
       and unsubscribe properly when adding or removing pairs
    /- Use function _f = (){} instead of _f = function () to be consistent with
       var declarations
    /- Remove unnecessary let in _saveCandles
    /- Add _openWebSocket function when initializing WS
    v1.0.6
    /- Stop trying to stringify the error in case the error is circular
    /- Make sure to not add the error to a string when logging to avoid
       [Object object] response
    /- Move up the _openWebSocket function and call it whenever I need to open
       WS
    /- Handle WS 'error' after defining _openWebSocket. error -> open -> close
       -> message
    v1.0.7
    /- stop stringifying reason in poloniex close log for same reasons as in
       error section
    /- add "No response from server" check in WS close handling to be similar
       to Gdax
    /- remove msg var from WS open section since not being used and to keep
       consistent with Gdax
    v1.0.8
    /- add PAIRSFILE and EXCHANGE
    /- change POLONIEX to a var
    /- replace _getSubs, _saveCandles, and script section with Bitfinex version
    /- add _onTrade from scannerBitfinex
    /- add _startupMessage from scannerBitfinex
    /- redo WS functionality similar to others (based on Bitfinex)
    /- remove _currencyPairToPair
    /- add pairIdToPair and pairToPairId like in Gdax
    v1.0.9
    /- import tgLib instead of fs
    /- remove PACKAGE, NAME, VERSION, SAVE_INTERVAL, LOG_INTERVAL, TS_START
    /- remove tsLast, tsLastLog, priceLast, trades, subs, pairToPairId,
       and pairIdToPair
    /- remove _outLog, _startupMessage, _getSubs, _saveCandles, _onTrade
    /- replace all with corresponding from lib
    /- rename _openWebSocket to openWS and _setWSMethods to setWSMethods

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
