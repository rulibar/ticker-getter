/*
scannerPoloniex.js
*/

// imports
const fs = require('fs')
const Poloniex = require('poloniex-api-node')

// vars
const interval = 15 // seconds between checks
const poloniex = new Poloniex()
const tsStart = (new Date()).getTime()/1000 // starting timestamp in seconds
var tsLast = {} // tracks the timestamp of the last datapoint for each pair

// classes
class Ticker {
    constructor (ts, price, volume) {
        this.ts = ts
        this.price = price
        this.volume = volume
    }
}

// functions
function _storeTicker (ticker) {
    // get timestamp in seconds and update our list of pairs
    var ts = (new Date()).getTime()/1000
    var pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json'))
    // cycle through pairs
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i]
            let pair = asset+base
            let currencyPair = base+"_"+asset
            let _ticker = ticker[currencyPair]
            let price = _ticker.last
            let volume = 0
            if (!tsLast[pair]) {
                console.log("Warning! No past data for "+pair+", ")
                tsLast[pair] = ts
            } else {
                volume = 1
                //poloniex.returnTradeHistory()
            }
            _ticker = new Ticker(ts, price, volume)
            console.log(pair+": "+JSON.stringify(_ticker))
        }
    }
}

function _handleTicker () {
    // get ticker data for all poloniex pairs
    poloniex.returnTicker((err, ticker) => {
        if (err) throw err
        _storeTicker(ticker)
    })
}

// main
_handleTicker()
setInterval(function () {
    _handleTicker()
}, interval*1000)
