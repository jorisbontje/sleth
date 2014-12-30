from eth_tools import Contract, address
from pyethereum import tester

class TestSlethContract(object):

    CONTRACT = 'contracts/sleth.se'

    def setup_method(self, method):
        self.s = tester.state()
        self.c = self.s.contract(self.CONTRACT)

    def _spin(self, bet):
        return self.s.send(tester.k0, self.c, 0, funid=0, abi=[bet])

    def _claim(self, round):
        return self.s.send(tester.k0, self.c, 0, funid=1, abi=[round])

    def _deposit(self, amount):
        return self.s.send(tester.k0, self.c, amount, funid=2, abi=[])

    def _withdraw(self, amount):
        return self.s.send(tester.k0, self.c, 0, funid=3, abi=[amount])

    def _get_round(self, round):
        return self.s.send(tester.k0, self.c, 0, funid=4, abi=[round])

    def _get_current_player(self):
        return self.s.send(tester.k0, self.c, 0, funid=5, abi=[])

    def test_spin_bet_out_of_range(self):
        assert self._spin(0) == [0]
        assert self._spin(6) == [0]

    def test_spin_invalid_funds(self):
        assert self._spin(5) == [0]

    def test_spin_deposit(self):
        assert self._deposit(5) == [1]
        assert self._get_current_player() == [0, 5]

    def test_spin_withdraw_too_much(self):
        assert self._withdraw(5) == [0]

    def test_spin_withdraw_valid(self):
        assert self._deposit(5) == [1]

        balance_before = self.s.block.get_balance(tester.a0)
        assert self._withdraw(5) == [1]

        balance_after = self.s.block.get_balance(tester.a0)
        assert balance_after - balance_before == 5

        assert self._get_current_player() == [0, 0]

    def test_spin_valid_bet(self):
        assert self._deposit(5) == [1]
        assert self._spin(5) == [1]

        # TODO
