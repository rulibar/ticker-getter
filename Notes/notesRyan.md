#### 2018-05-04

I'm thinking that for each exchange we can have 2 files. The first 'scannerPoloniex.js' will be run 24/7 and will..
- periodically receive the 'pairsPoloniex.json' file
- cycle through the pairs list
- receive ticker data
- convert to consistent format
- save to storage

This way, if something happens which causes our program to break, it will only affect one exchange. Or if we need to update, we just need to stop collecting on one exchange at a time. And we can always update the pairs we're following without interrupting the scanner.

This will be what I'll be working on for now. I'll create an Archives/ directory and store the old scanner.js and pairs.js there for reference.

#### 2018-06-09

Poloniex is working now. There might still be some small bugs. I'm gonna hold out a while and improve the Poloniex scanner before trying Binance.

#### 2018-06-10

I ran a test of Poloniex scanner v1.0.1 last night for 12 hours on 10 pairs on my Amazon AWS EC2 instance. Everything seemed to work fine. I was able to approximate the size of 1 day for 1 pair to be around 0.48 MB if we are saving candle data every 15 seconds.

So let's say we store 100 pairs for 1 year. That would be about `0.48*100*365 = 17,520` MB or around 18 GB.
So to store 100 pairs will cost about 18 GB/yr for storage. (A first approximation)
So therefore 1 TB of storage space would last us around 56 years (lol)

#### 2018-06-10

I also did a test today regarding how much data we should store in 1 file. First off, a day of data is about 2900 lines and about half a MB. Once you start dealing with several days in the same csv document you experience lag opening the file, copy/pasting contents, and saving the file. Storing 2 weeks on the same text file is manageable in spite of the lag but probably not preferred.

I've been thinking it's probably best to split the days like we split the months
```
Poloniex/
  BTCUSD/
    2018/
      5/
        1.csv
        2.csv
        3.csv
        4.csv
```
or better yet
```
Poloniex/
  BTCUSD/
    2018/
      4-31.csv
      5-1.csv
      5-2.csv
      5-3.csv
```
but I would also like to adjust the month so it goes from 1-12 instead of 0-11
```
Poloniex/
  BTCUSD/
    2018/
      5-31.csv
      6-1.csv
      6-2.csv
```
