from contextlib import contextmanager
from ethereum import tester
from eth_tools import address

import random
import pytest

from sleth.constants import CONTRACT_FILE, CONTRACT_GAS, SPIN_GAS, CLAIM_GAS, ETHER

@contextmanager
def assert_max_gas_cost(block, max_gas):
    start_gas = block.gas_used
    yield
    gas_cost = block.gas_used - start_gas
    assert gas_cost <= max_gas, "Maximum gas cost exceeded. gas_cost = %d, max_gas = %d" % (gas_cost, max_gas)

class TestSlethContract(object):

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(CONTRACT_FILE, endowment=2000 * ETHER, gas=CONTRACT_GAS)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)
        tester.seed = 3 ** 160

    def profile_calc_reward(self, rnd, lines):
        return self.s.profile(tester.k0, self.c.address, 0, funid=8, abi=[rnd, lines])

    def test_init(self):
        assert self.c.get_stats() == [0, 0, 0]
        assert self.s.block.get_code(self.c.address) != ''

    def test_suicide(self):
        assert self.c.suicide() is None
        assert self.s.block.get_code(self.c.address) == ''

    def test_create_gas_used(self):
        print "create gas used:", self.s.block.gas_used
        assert self.s.block.gas_used <= CONTRACT_GAS

    def test_spin_bet_out_of_range(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(0) == 0

        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(6, value=6 * ETHER) == 0

    def test_spin_invalid_funds(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5) == 0

        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=3 * ETHER) == 0

    def test_spin_valid_bet(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=5 * ETHER) == 1

        current_round = self.c.get_current_round()
        assert current_round == 1

        player, block, bet, result, entropy, status = self.c.get_round(current_round)
        assert address(player) == tester.a0.encode('hex')
        assert block == 0
        assert bet == 5
        assert result == 0
        assert entropy == 0
        assert status == 1  # spinning

        assert self.c.get_stats() == [1, 5, 0]

    def test_calc_line_perfect_match(self):
        assert self.c.calc_line(0, 0, 0) == 50
        assert self.c.calc_line(1, 1, 1) == 10
        assert self.c.calc_line(2, 2, 2) == 15
        assert self.c.calc_line(3, 3, 3) == 20
        assert self.c.calc_line(4, 4, 4) == 25
        assert self.c.calc_line(5, 5, 5) == 8
        assert self.c.calc_line(6, 6, 6) == 6
        assert self.c.calc_line(7, 7, 7) == 4
        assert self.c.calc_line(8, 8, 8) == 250
        assert self.c.calc_line(9, 9, 9) == 75
        assert self.c.calc_line(10, 10, 10) == 100

    def test_calc_line_triple_ups(self):
        assert self.c.calc_line(1, 2, 3) == 6
        assert self.c.calc_line(3, 2, 3) == 6
        assert self.c.calc_line(2, 3, 2) == 6

    def test_calc_line_triple_down(self):
        assert self.c.calc_line(5, 6, 7) == 2
        assert self.c.calc_line(5, 6, 6) == 2

    def test_calc_line_bacon(self):
        assert self.c.calc_line(9, 0, 0) == 50
        assert self.c.calc_line(0, 9, 0) == 50
        assert self.c.calc_line(0, 0, 9) == 50

    def test_calc_line_bacon_trip_ups(self):
        assert self.c.calc_line(9, 2, 3) == 6
        assert self.c.calc_line(1, 9, 3) == 6
        assert self.c.calc_line(1, 2, 9) == 6

    def test_calc_line_bacon_trip_down(self):
        assert self.c.calc_line(9, 6, 7) == 2
        assert self.c.calc_line(5, 9, 7) == 2
        assert self.c.calc_line(5, 6, 9) == 2

    def test_calc_line_double_bacon(self):
        assert self.c.calc_line(9, 9, 0) == 50
        assert self.c.calc_line(0, 9, 9) == 50
        assert self.c.calc_line(9, 0, 9) == 50

    def test_calc_line_nothing(self):
        assert self.c.calc_line(0, 1, 2) == 0

    def test_get_stops(self):
        assert self.c.get_stops(23888) == [16, 10, 23]
        assert self.c.get_stops(1606) == [6, 18, 1]
        assert self.c.get_stops(30464) == [0, 24, 29]
        assert self.c.get_stops(0) == [0, 0, 0]

    def test_calc_reward(self):
        assert self.c.calc_reward(23888, 1) == 6
        assert self.c.calc_reward(23888, 3) == 26
        assert self.c.calc_reward(23888, 5) == 32

    def test_calc_reward_2878(self):
        # wheel stops should wrap around
        assert self.c.get_stops(2878) == [30, 25, 2]
        assert self.c.calc_reward(2878, 5) == 6

    def _spin_mine_claim(self, amount, premine, expected_result):
        self.s.mine(premine)

        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(amount, value=amount * ETHER) == 1

        self.s.mine(1)
        balance_before = self.s.block.get_balance(tester.a0)

        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1) == 1

        player, block, bet, result, entropy, status = self.c.get_round(1)
        assert address(player) == tester.a0.encode('hex')
        assert block == premine
        assert bet == amount
        assert entropy != 0
        assert status == 2  # done
        assert result == expected_result

        balance_after = self.s.block.get_balance(tester.a0)
        assert balance_after - balance_before == expected_result * ETHER

        current_round = self.c.get_current_round()
        assert current_round == 1

        assert self.c.get_stats() == [1, amount, expected_result]

    def test_claim_winning(self):
        self._spin_mine_claim(amount=5, premine=1, expected_result=4)

    def test_claim_losing(self):
        self._spin_mine_claim(amount=5, premine=0, expected_result=0)

    def test_claim_invalid_status(self):
        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1) == 90

    def test_claim_invalid_round(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=5 * ETHER) == 1

        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1, sender=tester.k1) == 91

    def test_claim_not_yet_ready(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=5 * ETHER) == 1

        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1) == 92

    def test_claim_block_number_out_of_range(self):
        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=5 * ETHER) == 1

        self.s.mine(256)
        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1) == 93

    def test_claim_has_unique_entropy(self):
        self.s.mine(1)

        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, value=5 * ETHER) == 1

        with assert_max_gas_cost(self.s.block, SPIN_GAS):
            assert self.c.spin(5, sender=tester.k1, value=5 * ETHER) == 1

        current_round = self.c.get_current_round()
        assert current_round == 1

        current_round = self.c.get_current_round(sender=tester.k1)
        assert current_round == 2

        self.s.mine(1)

        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(1) == 1

        with assert_max_gas_cost(self.s.block, CLAIM_GAS):
            assert self.c.claim(2, sender=tester.k1) == 1

        player1, block1, bet1, result1, entropy1, status1 = self.c.get_round(1)
        player2, block2, bet2, result2, entropy2, status2 = self.c.get_round(2)
        assert address(player1) == tester.a0.encode('hex')
        assert address(player2) == tester.a1.encode('hex')
        assert entropy1 != entropy2

    @pytest.mark.slow
    def test_calc_reward_loop(self):
        random.seed(0)
        bet = 5
        times = 1000

        total_cost = 0
        total_payout = 0
        total_gas = 0
        total_time = 0

        for _ in range(0, times):
            total_cost += bet
            rnd = random.randint(0, 32 ** 3)

            result = self.profile_calc_reward(rnd, bet)
            total_gas += result['gas']
            total_time += result['time']
            total_payout += result['output'][0]

        print total_payout, total_cost, float(total_payout) / total_cost, total_gas / times, total_time / times
        assert total_payout < total_cost
