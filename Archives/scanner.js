/*

cycles through the pairs in the pairs.js file and...
1. imports last data point
2. checks how much time has passed since last data point
3. if enough time has passed ask the exchange for ticker data
4. save ticker data as a Tick class instance like
   'ticker = new Tick("exchange", body)'
5. export ticker data to the appropriate storage location like
   '_write(ticker)'

current focus:
- Make sure the program properly cycles through pairs
!- Make sure we can update pairs.js in real time and the following
   iteration in scanner.js will include whatever pairs we added to pairs.js

*/

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
