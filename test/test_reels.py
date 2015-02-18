from sleth.reels import rnd_positions, outcome, position_symbols, sum_payline, find_paylines, REELS


def test_rnd_positions():
    assert rnd_positions(REELS, 3792463) == (8, 7, 20, 3, 25)
    assert rnd_positions(REELS, 1900918) == (4, 4, 4, 0, 6)

def test_position_symbols():
    assert position_symbols(REELS, (8, 7, 20, 3, 25)) == ('g!L', 'g!v', 'pHv', 'yvL', 'pL!')
    assert position_symbols(REELS, (4, 4, 4, 0, 6)) == ('pJL', 'gvS', 'LHp', 'vpl', 'pgv')

def test_find_paylines():
    assert find_paylines(('gyp', 'gHl', 'JgH', 'ygH', 'LSg')) == [(6, 'g', 3, 0.12), (19, 'g', 3, 0.12)]

def test_round_321416():
    rnd = 1149376
    exp_outcome = 0.24

    pos = rnd_positions(REELS, rnd)
    assert pos == (2, 13, 10, 6, 20)

    symbols = position_symbols(REELS, pos)
    assert symbols == ('gyp', 'gHl', 'JgH', 'ygH', 'LSg')

    paylines = find_paylines(symbols)
    assert paylines == [(6, 'g', 3, 0.12), (19, 'g', 3, 0.12)]
    assert sum_payline(paylines) == exp_outcome

def test_round_329904():
    assert outcome(10105281) == 1.2

def test_round_329897():
    assert outcome(3983410) == 0.52

def test_round_329777():
    assert outcome(10999484) == 0
