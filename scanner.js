// basic vars
n = 5 // minimum seconds between scans

// advanced vars
lastUpdate = undefined // used to track time between updates

// imports
pairs = require('./pairs')

// functions
function _scan() {
    // get latest pairs file
    pairs = undefined
    pairs = require('./pairs')
    // cycle through all pairs in pairs.js
    for (var exchange in pairs.list) {
        console.log(exchange+":")
        for (var base in pairs.list[exchange]) {
            for (var i = 0; i < pairs.list[exchange][base].length; i++) {
                asset = pairs.list[exchange][base][i]
                console.log("  "+asset+""+base)
            }
        }
    }
}

// script
while (true) {
    if (lastUpdate == undefined) {
        _scan()
        lastUpdate = (new Date()).getTime()
    } else {
        time = (new Date()).getTime()
        dt = (time - lastUpdate)/1000
        if (dt > n) {
            _scan()
            lastUpdate = time
        }
    }
}
