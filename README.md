# ticker-getter
#### v1.1
A program which collects and stores ticker data for multiple exchanges. Currently supports Binance, Bitfinex, Gdax, and Poloniex.

### Concept
- Each exchange has a scanner and a pairs file.
- The scanner file will be left running 24/7 and periodically:
  1. Retrieve the pairs file to find out what pairs to watch
  2. Cycle through the pairs and:
    - Convert the ticker response to a consistent format
    - Save the data to storage

### Notes
- Collecting data in real time is essential for hosting our own live bots
- We can possibly increase our data size by getting old data from other sources
- Once we have a nice, large data storage, we can do backtesting. Which means we should start programming backtesting software soon
- The live instances and the backtester will go into our data storage and create candle data to execute the strategy on
- The idea for the data storage structure is as follows. (The month, day, year are based on the JS date object methods.)

```
Data/
  Bitfinex/
    2018/
      1-1.csv
      1-2.csv
      ...
      12-31.csv
    2017/
      ...
    ...
  Poloniex/
    ...
  ...
```

### How to use
- Clone the repository to the desired directory
- Enter the directory in terminal and type 'npm install'
- Run the program in the background by typing 'nohup node scannerBinance &> nohupBinance.out &'
  - This will create a log file called nohupBinance.out
  - End the process by using 'ps -ef' to get the process ID and then 'kill processID'
  - This should be run for every exchange you want to watch
- Leave your server running 24/7

### How to update
- Clone the updated repository into the desired directory
  - New version needs to be in a different directory than old version
  - Recommended to use ticker-getter_1-0/ and then ticker-getter_1-1/ if updating from 1.0 to 1.1
- Enter the new directory in terminal and type 'npm install'
- Update all of the pairs files to track the pairs you want
- Kill the old scanner processes using 'ps -ef' and then 'kill processID'
- Replace the new empty data folder with the previous data
- Run the new scanners one at a time with 'nohup node scannerBinance &> nohupBinance.out &'
- Remove the old scanner if desired as the updated one is now running and has all of the old data and pairs

### Versions
- 1.0
  - Supports Poloniex exchange only
- 1.1
  - Supports Binance, Bitfinex, Gdax, and Poloniex
