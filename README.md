# ticker-getter-1
The first attempt at a program to retrieve and store ticker data from many exchanges

# Files
- pairs.js contains the pairs (and exchanges) that we will track
- scanner.js
  - is intended to run 24/7
  - cycles through the pairs in pairs.js (pairs.js should be updateable in real time)
  - asks the exchange for ticker data
  - converts the response to a consistent format
  - outputs the data to our storage system
  
## Notes
- Later on we will create a program to convert our stored ticker data to candle data
- Once we are producing candle data in real time we can begin working on the live trading system
- Once we have a bunch of data collected and we can produce candles, we can begin working on our backtesting system
- The ticker data will be stored in the following file structure:

Data/
  Bitfinex/
    BTCUSD/
      180101-180301.csv
      180301-180601.csv
      ...
    ETHUSD/
      ...
    ...
  Poloniex/
    ...
  ...
      
