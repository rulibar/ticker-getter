#!/bin/bash
# Used for starting up all of the scanners with only one command './startScanners.sh'
#
# v1.1
# v1.1.1
# - create startScanners.sh and add core functionality

nohup node scannerBinance.js &> nohupBinance.out &
nohup node scannerBitfinex.js &> nohupBitfinex.out &
nohup node scannerGdax.js &> nohupGdax.out &
nohup node scannerPoloniex.js &> nohupPoloniex.out &

echo "Scanners started up."
echo "You can view the log by seeing the contents of the nohup files."
echo "You can stop the scanners by using 'ps -ef' to get the process ID and then 'kill pid'"
