# ticker-getter-1
The first attempt at a program to retrieve and store ticker data from multiple exchanges

### Concept
- Each exchange will have a scanner and a pairs file
- The scanner file will be run 24/7 and periodically:
  1. Retrieve the pairs file to find out what pairs we're watching
  2. Cycle through the pairs
  3. Convert the ticker response to a consistent format
  4. Save the data to data storage
  
### Notes
- Collecting data in real time is essential for hosting our own live bots
- Once we are collecting in real time we can do some things to add past data to our data storage
- Once we have a nice, large data storage, we can start programming backtesting software
- The live instances and the backtester will go into our data storage and create candle data to execute the strategy on
- The idea for the data storage structure is as follows

```
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
```
