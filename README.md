Block B:

user -> slotmachine.spin(bet-amount, user-entropy)

slot machine will assign round R to user, reserve the bet-amount and note block B.
calls entropy contract with user-entropy for block B

...

Block B+1:

entropy contract received additional entropy, finalizes random number for block B

...
Block B+2

user interface polls slotmachine for results of last round, discovers last round is R.

user checks slotmachine for result of round R
slot machine calls entropy contract for rng associated with block B.
calculates winnings and updates user record for round R.

Questions:
* how to make this work with multiple users per block. pass along concept of round to entropy?
* is it correct that entropy result is linked to a certain block number (committed when entropy is first requested)
* is this robust against forks / transaction reordering?
* how to ensure that we have received enough entropy sources for block B?



