from ethereum import tester

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

    def _last_logs(self, tx=0):
        return [log.to_dict() for log in self.s.block.get_receipt(tx).logs]

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_log_topics_without_data(self):
        self.s.mine(1)
        assert self.c.test_log_topics() is None
        logs = self._last_logs()
        assert len(logs) == 4

        assert logs[0]['address'] == self.c.address.encode('hex')
        assert logs[0]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001']
        assert logs[0]['data'] == '0x'

        assert logs[1]['address'] == self.c.address.encode('hex')
        assert logs[1]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002']
        assert logs[1]['data'] == '0x'

        assert logs[2]['address'] == self.c.address.encode('hex')
        assert logs[2]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002',
                                     '0000000000000000000000000000000000000000000000000000000000000003']
        assert logs[2]['data'] == '0x'

        assert logs[3]['address'] == self.c.address.encode('hex')
        assert logs[3]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002',
                                     '0000000000000000000000000000000000000000000000000000000000000003',
                                     '0000000000000000000000000000000000000000000000000000000000000004']
        assert logs[3]['data'] == '0x'

    def test_log_data(self):
        self.s.mine(1)
        assert self.c.test_log_data() is None
        logs = self._last_logs()
        assert len(logs) == 1

        assert logs[0]['address'] == self.c.address.encode('hex')
        assert logs[0]['topics'] == []
        assert logs[0]['data'] == self.EXPECTED_DATA

    def test_log_topics_and_data(self):
        self.s.mine(1)
        assert self.c.test_log_topics_and_data() is None
        logs = self._last_logs()
        assert len(logs) == 4

        assert logs[0]['address'] == self.c.address.encode('hex')
        assert logs[0]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001']
        assert logs[0]['data'] == self.EXPECTED_DATA

        assert logs[1]['address'] == self.c.address.encode('hex')
        assert logs[1]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002']
        assert logs[1]['data'] == self.EXPECTED_DATA

        assert logs[2]['address'] == self.c.address.encode('hex')
        assert logs[2]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002',
                                     '0000000000000000000000000000000000000000000000000000000000000003']
        assert logs[2]['data'] == self.EXPECTED_DATA

        assert logs[3]['address'] == self.c.address.encode('hex')
        assert logs[3]['topics'] == ['0000000000000000000000000000000000000000000000000000000000000001',
                                     '0000000000000000000000000000000000000000000000000000000000000002',
                                     '0000000000000000000000000000000000000000000000000000000000000003',
                                     '0000000000000000000000000000000000000000000000000000000000000004']
        assert logs[3]['data'] == self.EXPECTED_DATA
