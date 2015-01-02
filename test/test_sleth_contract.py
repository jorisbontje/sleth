from eth_tools import Contract, address
from pyethereum import tester

class TestSlethContract(object):

    CONTRACT = 'contracts/sleth.se'

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

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

    def _calc_lines(self, s1, s2, s3):
        return self.s.send(tester.k0, self.c, 0, funid=6, abi=[s1, s2, s3])

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

        current_round, balance = self._get_current_player()
        assert current_round == 0
        assert balance == 0

        player, block, timestamp, bet, result, entropy, status = self._get_round(current_round)
        assert player == int(tester.a0, 16)
        assert block == 0
        assert timestamp == self.s.block.timestamp
        assert bet == 5
        assert result == 0
        assert entropy == 0
        assert status == 1  # spinning

    def test_calc_lines_perfect_match(self):
        assert self._calc_lines(0, 0, 0) == [50]
        assert self._calc_lines(1, 1, 1) == [10]
        assert self._calc_lines(2, 2, 2) == [15]
        assert self._calc_lines(3, 3, 3) == [20]
        assert self._calc_lines(4, 4, 4) == [25]
        assert self._calc_lines(5, 5, 5) == [8]
        assert self._calc_lines(6, 6, 6) == [6]
        assert self._calc_lines(7, 7, 7) == [4]
        assert self._calc_lines(8, 8, 8) == [250]
        assert self._calc_lines(9, 9, 9) == [75]
        assert self._calc_lines(10, 10, 10) == [100]

    def test_calc_lines_triple_ups(self):
        assert self._calc_lines(1, 2, 3) == [6]
        assert self._calc_lines(3, 2, 3) == [6]

    def test_calc_lines_triple_down(self):
        assert self._calc_lines(5, 6, 7) == [2]
        assert self._calc_lines(5, 6, 6) == [2]

    def test_calc_lines_bacon(self):
        assert self._calc_lines(9, 0, 0) == [50]
        assert self._calc_lines(0, 9, 0) == [50]
        assert self._calc_lines(0, 0, 9) == [50]

    def test_calc_lines_bacon_trip_ups(self):
        assert self._calc_lines(9, 2, 3) == [6]
        assert self._calc_lines(1, 9, 3) == [6]
        assert self._calc_lines(1, 2, 9) == [6]

    def test_calc_lines_bacon_trip_down(self):
        assert self._calc_lines(9, 6, 7) == [2]
        assert self._calc_lines(5, 9, 7) == [2]
        assert self._calc_lines(5, 6, 9) == [2]

    def test_calc_lines_double_bacon(self):
        assert self._calc_lines(9, 9, 0) == [50]
        assert self._calc_lines(0, 9, 9) == [50]
        assert self._calc_lines(9, 0, 9) == [50]

    def test_calc_lines_nothing(self):
        assert self._calc_lines(0, 1, 2) == [0]
