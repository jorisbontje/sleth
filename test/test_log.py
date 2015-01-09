from pyethereum import tester

class TestLog(object):

    CONTRACT = """
def test_log0():
    a = array(0)
    a[0] = 42
    log0(ref(a), 32)
"""

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def _call(self, funid=0):
        return self.s.send(tester.k0, self.c, 0, funid=funid, abi=[])

    def test_log0(self):
        assert self._call(0) == []
        assert self.s.last_tx.logs[0].to_dict() == dict(address=self.c, topics=[], data='0x' + tester.u.zpad(tester.u.encode_int(42), 32).encode('hex'))
