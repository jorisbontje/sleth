from collections import Counter
from functools import reduce
import operator
import random

# 'g' won
# 'y' yen
# 'v' dollar
# 'p' euro
# 'l' pound
# 'H' miner
# 'L' asic
# 'S' ghost
# 'J' liberty
# '*' wild
# '!' bitcoin

REELS = [
    'lSgypJLyg!LvHly*vpHyvgplJg',
    'vplygvSg!vy*pgHlpHgLylLSyJ',
    'vgySLHpJ*SJgHLpylgv!pHvygl',
    'vplyvLygHlpyJvSglHgp!Sv*JL',
    'L!yvLlpgvpHSg*vlgyHJLSglyp'
]

MAX_RANDOM = reduce(operator.mul, (len(reel) for reel in REELS), 1)

PAYOUT = {
    'g': [0.12, 0.4, 2],    # won
    'y': [0.16, 0.6, 2.4],  # yen
    'v': [0.2, 0.8, 3],     # dollar
    'p': [0.2, 1, 3.2],     # euro
    'l': [0.2, 1.2, 4],     # pound
    'H': [0.4, 3, 16],      # miner
    'L': [1, 4, 18],        # asic
    'S': [1.2, 8, 26],      # ghost
    'J': [2, 10, 40]        # liberty
}

PAYLINES = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],

    [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2],
    [1, 2, 2, 2, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],

    [1, 2, 1, 2, 1],
    [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1],

    [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2],
    [2, 2, 1, 0, 0],
    [0, 0, 1, 2, 2],
    [0, 2, 0, 2, 0],

    [2, 0, 2, 0, 2],
    [0, 2, 2, 2, 0],
    [2, 0, 0, 0, 2],
    [0, 0, 2, 0, 0],
    [2, 2, 0, 2, 2]
]

def wheel_frequency(wheel):
    freq = Counter()
    for char in wheel:
        freq[char] += 1
    return freq

def rnd_positions(reels, rnd):
    reel1_div = len(reels[1]) * len(reels[2]) * len(reels[3]) * len(reels[4])
    reel2_div = len(reels[2]) * len(reels[3]) * len(reels[4])
    reel3_div = len(reels[3]) * len(reels[4])
    reel4_div = len(reels[4])

    reel1_pos = rnd / reel1_div
    reel1_rem = rnd % reel1_div
    reel2_pos = reel1_rem / reel2_div
    reel2_rem = reel1_rem % reel2_div
    reel3_pos = reel2_rem / reel3_div
    reel3_rem = reel2_rem % reel3_div
    reel4_pos = reel3_rem / reel4_div
    reel4_rem = reel3_rem % reel4_div
    reel5_pos = reel4_rem

    return reel1_pos, reel2_pos, reel3_pos, reel4_pos, reel5_pos

def position_symbols(reels, pos):
    result = []
    for i in range(0, len(reels)):
        double_reel = reels[i] * 2
        symbols = double_reel[pos[i]:pos[i] + 3]
        result.append(symbols)
    return tuple(result)


def find_paylines(symbols):
    result = []
    for payline_nr, payline in enumerate(PAYLINES):
        # print "PAYLINE", payline_nr, payline

        line = ''
        for pos, offset in enumerate(payline):
            line += symbols[pos][offset]

        symbol = line[0]
        cnt = 0
        if line.startswith(symbol * 5):
            cnt = 5
        elif line.startswith(symbol * 4):
            cnt = 4
        elif line.startswith(symbol * 3):
            cnt = 3

        if cnt:
            if symbol in PAYOUT:
                payout = PAYOUT[symbol][cnt - 3]
                result.append((payline_nr + 1, symbol, cnt, payout))
            else:
                print "Symbol", symbol, "not found in paytable"
    return result

def sum_payline(paylines):
    return sum(payout for line, symbol, cnt, payout in paylines)

def outcome(rnd):
    return sum_payline(find_paylines(position_symbols(REELS, rnd_positions(REELS, rnd))))

def main():
    total = 0
    for i in range(0, 10000):
        rnd = random.SystemRandom().randint(0, MAX_RANDOM)
        out = outcome(rnd)
        print i, rnd, out
        total += out

    print "TOTAL", total

if __name__ == '__main__':
    main()
