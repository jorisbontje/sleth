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

    EXPECTED_DATA = '0x0000000000000000000000000000000000000000000000000000000000000001' +\
                    '0000000000000000000000000000000000000000000000000000000000000002' +\
                    '0000000000000000000000000000000000000000000000000000000000000003'

    def _last_logs(self):
        return [log.to_dict() for log in self.s.block.get_receipt(0).logs]

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_log_topics(self):
        assert self.c.test_log_topics() is None
        assert self._last_logs() == [
            dict(address=self.c.address, topics=['0000000000000000000000000000000000000000000000000000000000000001'], data='0x'),
            dict(address=self.c.address, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                                 '0000000000000000000000000000000000000000000000000000000000000002'], data='0x'),
            dict(address=self.c.address, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                                 '0000000000000000000000000000000000000000000000000000000000000002',
                                                 '0000000000000000000000000000000000000000000000000000000000000003'], data='0x'),
            dict(address=self.c.address, topics=['0000000000000000000000000000000000000000000000000000000000000001',
                                                 '0000000000000000000000000000000000000000000000000000000000000002',
                                                 '0000000000000000000000000000000000000000000000000000000000000003',
                                                 '0000000000000000000000000000000000000000000000000000000000000004'], data='0x')]

    def test_log_data(self):
        assert self.c.test_log_data() is None
        assert self._last_logs() == [dict(address=self.c.address, topics=[], data=self.EXPECTED_DATA)]

    def test_log_topics_and_data(self):
        assert self.c.test_log_topics_and_data() is None
        assert self._last_logs() == [
            dict(address=self.c.address,
                 topics=['0000000000000000000000000000000000000000000000000000000000000001'],
                 data=self.EXPECTED_DATA),
            dict(address=self.c.address,
                 topics=['0000000000000000000000000000000000000000000000000000000000000001',
                         '0000000000000000000000000000000000000000000000000000000000000002'],
                 data=self.EXPECTED_DATA),
            dict(address=self.c.address,
                 topics=['0000000000000000000000000000000000000000000000000000000000000001',
                         '0000000000000000000000000000000000000000000000000000000000000002',
                         '0000000000000000000000000000000000000000000000000000000000000003'],
                 data=self.EXPECTED_DATA),
            dict(address=self.c.address,
                 topics=['0000000000000000000000000000000000000000000000000000000000000001',
                         '0000000000000000000000000000000000000000000000000000000000000002',
                         '0000000000000000000000000000000000000000000000000000000000000003',
                         '0000000000000000000000000000000000000000000000000000000000000004'],
                 data=self.EXPECTED_DATA)]
