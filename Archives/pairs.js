/*

stores the list of pairs we will be watching and storing data for in the
following format

list = {
    "exchange1": {
        "base1": [
            "asset1",
            "asset2"
        ],
        "base2": [
            "asset1",
            "asset2"
        ]
    },
    "exchange2": {
        ...
    }
}

Notes:
- We should be able to update this while scanner is running so that we can leave
  scanner running 24/7
- Keep this list simple for now. Let's just track one pair while we get the
  core functionality added (Bitfinex BTCUSD)

*/

list = {
    "Bitfinex": {
        "USD": [
            "BTC",
            "ETH"
        ]
    }
}

module.exports = {
    list: list
}
