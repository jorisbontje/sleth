[![Build Status](https://travis-ci.org/jorisbontje/sleth.svg?branch=master)](https://travis-ci.org/jorisbontje/sleth)
[![Stories in Ready](https://badge.waffle.io/jorisbontje/sleth.png?label=ready&title=Ready)](https://waffle.io/jorisbontje/sleth)

<img src="https://i.imgur.com/OgFHoHD.png" />

## First game of sleth

Lets create the `sleth` Ethereum Slot contract:
```
$ ./cli.py create
Contract is available at 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Waiting for next block to be mined..
INFO:pyepm.api Ready! Mining took 10s
```

The contract is created under the account `0xc6c97de34c2b52b929baa21e662196b9e9e03fe0`. Now lets deposit `1000` Ether into the slot machine:
```
$ ./cli.py deposit 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1000
```

Getting information about the current player:
```
$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Current round: 0
Balance: 1000 ether
```

Now that we have some coins to play with, lets give it a spin; betting `5` (letting us play on 5 lines):
```
$ ./cli.py spin 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 5
```

Our bet is deducted from the balance, and we are playing in game round `1`:
```
$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Current round: 1
Balance: 995 ether
```

Knowing that we are in round `1`, we can check out its status:
```
$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1
Player: 0x9ecb3cc2e0d7eef7485a5234767b313c2f24b582L
Block: 4823
Timestamp: 1421155818
Bet: 5
Result: 0
Entropy: 0
Status: 1
```

The round `1` is still pending (status=1), lets claim it! (for testing purposes we can provide the random seed `12345`):
```
$ ./cli.py claim 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1 12345
```

Now we'll inspect the results of round `1` again:
```
$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1
Player: 0x9ecb3cc2e0d7eef7485a5234767b313c2f24b582L
Block: 4823
Timestamp: 1421155818
Bet: 5
Result: 0
Entropy: 12345
Status: 2
```

Too bad, we didn't win anything...

Lets play again!
```
$ ./cli.py spin 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 5

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Current round: 2
Balance: 990 ether

$ ./cli.py claim 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 2 23888

$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 2
Player: 0x9ecb3cc2e0d7eef7485a5234767b313c2f24b582L
Block: 4826
Timestamp: 1421155937
Bet: 5
Result: 32
Entropy: 23888
Status: 2

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Current round: 2
Balance: 1022 ether
```

Yeehaa! We won 32 ether :) Time to withdraw:

```
$ ./cli.py withdraw 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1022

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Current round: 2
Balance: 0 ether
```
