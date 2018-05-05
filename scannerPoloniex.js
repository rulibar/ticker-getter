/*
scannerPoloniex.js
*/

// imports
const fs = require('fs')

// vars
const interval = 15 // seconds between checks
var startDate = (new Date()).getTime()
var todayDate
var data

// functions
function _getTick () {
    todayDate = (new Date()).getTime()
    data = JSON.parse(fs.readFileSync('pairsPoloniex.json'))
    console.log("Pairs recieved")
    secondsSinceStart = (todayDate - startDate)/1000
    console.log(JSON.stringify(data))
}

// main
_getTick()
setInterval(function () {
    _getTick()
}, interval*1000)
