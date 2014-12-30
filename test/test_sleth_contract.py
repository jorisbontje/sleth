from eth_tools import Contract, address
from pyethereum import tester

class TestSlethContract(object):

    CONTRACT = 'contracts/sleth.se'

    def setup_method(self, method):
        self.s = tester.state()
        self.c = self.s.contract(self.CONTRACT)

    def _storage(self, idx):
        return self.s.block.account_to_dict(self.c)['storage'].get(idx)

    def test_spin_bet_out_of_range(self):
        o1 = self.s.send(tester.k0, self.c, 0, funid=0, abi=[0])
        assert o1 == [0]

        o2 = self.s.send(tester.k0, self.c, 0, funid=0, abi=[6])
        assert o2 == [0]

    def test_spin_invalid_funds(self):
        o1 = self.s.send(tester.k0, self.c, 0, funid=0, abi=[5])
        assert o1 == [0]

    def test_spin_deposit(self):
        o1 = self.s.send(tester.k0, self.c, 5, funid=2, abi=[])
        assert o1 == [1]

        # TODO assert storage

    def test_spin_withdraw_too_much(self):
        o1 = self.s.send(tester.k0, self.c, 0, funid=3, abi=[5])
        assert o1 == [0]

    def test_spin_withdraw_valid(self):
        o1 = self.s.send(tester.k0, self.c, 5, funid=2, abi=[])
        assert o1 == [1]

        balance_before = self.s.block.get_balance(tester.a0)

        o2 = self.s.send(tester.k0, self.c, 0, funid=3, abi=[5])
        assert o2 == [1]

        balance_after = self.s.block.get_balance(tester.a0)
        assert balance_after - balance_before == 5

    def test_spin_valid_bet(self):
        o1 = self.s.send(tester.k0, self.c, 0, funid=2, abi=[])
        assert o1 == [1]

        o2 = self.s.send(tester.k0, self.c, 0, funid=0, abi=[5])
        assert o2 == [0]
