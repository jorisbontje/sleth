from pyethereum import tester

class TestLog(object):

    CONTRACT = """
def test_log_topics():
    log(1)
    log(1, 2)
    log(1, 2, 3)
    log(1, 2, 3, 4)

def test_log_data():
    log(data=[1,2,3])

def test_log_topics_and_data():
    log(1, data=[1,2,3])
    log(1, 2, data=[1,2,3])
    log(1, 2, 3, data=[1,2,3])
    log(1, 2, 3, 4, data=[1,2,3])
"""

    EXPECTED_DATA = '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003'

    def _last_logs(self):
        return [log.to_dict() for log in self.s.last_tx.logs]

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def _call(self, funid=0):
        return self.s.send(tester.k0, self.c, 0, funid=funid, abi=[])

    def test_log_topics(self):
        assert self._call(0) == []
        assert self._last_logs() == [
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001'], data='0x'),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002'], data='0x'),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002',
                                         '0000000000000000000000000000000000000000000000000000000000000003'], data='0x'),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002',
                                         '0000000000000000000000000000000000000000000000000000000000000003',
                                         '0000000000000000000000000000000000000000000000000000000000000004'], data='0x')]

    def test_log_data(self):
        assert self._call(1) == []
        assert self._last_logs() == [dict(address=self.c, topics=[], data=self.EXPECTED_DATA)]

    def test_log_topics_and_data(self):
        assert self._call(2) == []
        assert self._last_logs() == [
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001'], data=self.EXPECTED_DATA),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002'], data=self.EXPECTED_DATA),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002',
                                         '0000000000000000000000000000000000000000000000000000000000000003'], data=self.EXPECTED_DATA),
            dict(address=self.c, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                         '0000000000000000000000000000000000000000000000000000000000000002',
                                         '0000000000000000000000000000000000000000000000000000000000000003',
                                         '0000000000000000000000000000000000000000000000000000000000000004'], data=self.EXPECTED_DATA)]
