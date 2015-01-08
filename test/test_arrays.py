from pyethereum import tester

class TestArrays(object):

    CONTRACT = """
def arr3():
    res = [1, 2, 3]
    return(res, 3)

def pass(rnd):
    return(self.arr3(outsz=3), 3)

def ta():
    return([3,4,5]:a)

def test():
    arr = self.ta(outsz=3)
    return(arr[1])  # how to get 4 to be returned?

def ta2():
    return([3,4,5], 3)

def test2():
    arr = self.ta2(outsz=3)
    return(arr[1])  # this does return 4 however
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

    def test_ta(self):
        assert self._call(3) == [4]

    def test_ta2(self):
        assert self._call(5) == [4]
