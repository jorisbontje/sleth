from pyethereum import tester

class TestArrays(object):

    CONTRACT = """
def arr3():
    res = [1, 2, 3]
    return(res, 3)

def pass(rnd):
    return(self.arr3(outsz=3), 3)
"""

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def _call(self, funid=0):
        return self.s.send(tester.k0, self.c, 0, funid=funid, abi=[])

    def test_arr3(self):
        assert self._call(0) == [1, 2, 3]

    def test_arr3_pass(self):
        assert self._call(1) == [1, 2, 3]
