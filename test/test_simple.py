from ethereum import tester
from eth_tools import address

class TestSimpleContract(object):

    CONTRACT = 'contracts/simple.se'
    CONTRACT_GAS = 81815

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_create_gas_used(self):
        print "create gas used:", self.s.block.gas_used
        assert self.s.block.gas_used <= self.CONTRACT_GAS

    def test_init(self):
        assert self.s.block.get_code(self.c.address) != ''
        assert address(self.s.block.get_storage_data(self.c.address, 0)) == tester.a0.encode('hex')
        assert self.s.block.get_storage_data(self.c.address, 1) == 1

    def test_incr(self):
        assert self.c.get_counter() == 1
        self.c.incr()
        assert self.c.get_counter() == 2
