from ethereum import tester

class TestStops(object):

    CONTRACT = """
def shared():
    REEL_COUNT = 3
    REEL_POSITIONS = 32

def get_stops(rnd):
    stops = array(REEL_COUNT)
    i = 0
    while i < REEL_COUNT:
        stops[i] = rnd % REEL_POSITIONS
        rnd = rnd / REEL_POSITIONS
        i += 1
    return(stops, items=REEL_COUNT)

def pass_(rnd):
    return(self.get_stops(rnd, outsz=REEL_COUNT), items=REEL_COUNT)
"""

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_get_stops(self):
        assert self.c.get_stops(23888) == [16, 10, 23]
        assert self.c.get_stops(1606) == [6, 18, 1]
        assert self.c.get_stops(30464) == [0, 24, 29]

    def test_pass(self):
        assert self.c.pass_(23888) == [16, 10, 23]
