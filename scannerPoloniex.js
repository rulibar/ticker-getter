/*
scannerPoloniex.js
*/

// imports
const fs = require('fs')
const Poloniex = require('poloniex-api-node')

// vars
const interval = 15 // seconds between checks
const poloniex = new Poloniex()
const tsStart = (new Date()).getTime()*1000

// functions
function _getTick () {
    poloniex.returnTicker((err, ticker) => {
        if (err) throw err
        ts = (new Date()).getTime()*1000
        pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json'))
        for (base in pairs) {
            for (i in pairs[base]) {
                asset = pairs[base][i]
                pair = base+"_"+asset
                console.log(pair)
                console.log(ticker[pair])
            }
        }
    })
}

// main
_getTick()
setInterval(function () {
    _getTick()
}, interval*1000)
