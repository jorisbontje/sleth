## First game of sleth

```
$ ./cli.py create
Contract is available at 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
Waiting for next block to be mined..
INFO:pyepm.api	Ready! Mining took 10s

$ ./cli.py deposit 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1000

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
[0, 1000]

$ ./cli.py spin 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 5

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
[1, 995]

$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1
[906552886116271711289069258654233580937993827714L,
 4823,
 1421155818,
 5,
 0,
 0,
 1]

$ ./cli.py claim 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1 12345

$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1
[906552886116271711289069258654233580937993827714L,
 4823,
 1421155818,
 5,
 0,
 12345,
 2]

$ ./cli.py spin 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 5

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
[2, 990]

$ ./cli.py claim 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 2 23888

$ ./cli.py get_round 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 2
[906552886116271711289069258654233580937993827714L,
 4826,
 1421155937,
 5,
 32,
 23888,
 2]

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
[2, 1022]

$ ./cli.py withdraw 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0 1022

$ ./cli.py get_current_player 0xc6c97de34c2b52b929baa21e662196b9e9e03fe0
[2, 0]
```
