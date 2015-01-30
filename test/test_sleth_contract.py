from pyethereum import tester

import random
import pytest
slow = pytest.mark.slow

class TestSlethContract(object):

    CONTRACT = 'contracts/sleth.se'
    CONTRACT_GAS = 55000

    ETHER = 10 ** 18

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()
        cls.seed = tester.seed

    def setup_method(self, method):
        self.s.revert(self.snapshot)
        tester.seed = self.seed

    def profile_calc_reward(self, rnd, lines):
        return self.s.profile(tester.k0, self.c.address, 0, funid=8, abi=[rnd, lines])

    def test_init(self):
        assert self.c.get_stats() == [1, 0, 0]
        assert self.s.block.get_code(self.c.address) != ''

    def test_suicide(self):
        assert self.c.suicide() == []
        assert self.s.block.get_code(self.c.address) == ''

    def test_spin_bet_out_of_range(self):
        assert self.c.spin(0) == [0]
        assert self.c.spin(6) == [0]

    def test_create_gas_used(self):
        assert self.s.block.gas_used < self.CONTRACT_GAS

    def test_spin_bet_out_of_range(self):
        assert self.c.spin(0) == [0]
        assert self.c.spin(6) == [0]

    def test_spin_invalid_funds(self):
        assert self.c.spin(5) == [0]

    def test_spin_deposit(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.get_current_player() == [0, 5]

    def test_spin_withdraw_too_much(self):
        assert self.c.withdraw(5) == [0]

    def test_spin_withdraw_valid(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]

        balance_before = self.s.block.get_balance(tester.a0)
        assert self.c.withdraw(5) == [1]

        balance_after = self.s.block.get_balance(tester.a0)
        assert balance_after - balance_before == 5 * self.ETHER

        assert self.c.get_current_player() == [0, 0]

    def test_spin_valid_bet(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        current_round, balance = self.c.get_current_player()
        assert current_round == 1
        assert balance == 0

        player, block, timestamp, bet, result, entropy, rnd, status = self.c.get_round(current_round)
        assert player == int(tester.a0, 16)
        assert block == 0
        assert timestamp == self.s.block.timestamp
        assert bet == 5
        assert result == 0
        assert entropy == 0
        assert rnd == 0
        assert status == 1  # spinning

        assert self.c.get_stats() == [2, 1, 0]

    def test_calc_line_perfect_match(self):
        assert self.c.calc_line(0, 0, 0) == [50]
        assert self.c.calc_line(1, 1, 1) == [10]
        assert self.c.calc_line(2, 2, 2) == [15]
        assert self.c.calc_line(3, 3, 3) == [20]
        assert self.c.calc_line(4, 4, 4) == [25]
        assert self.c.calc_line(5, 5, 5) == [8]
        assert self.c.calc_line(6, 6, 6) == [6]
        assert self.c.calc_line(7, 7, 7) == [4]
        assert self.c.calc_line(8, 8, 8) == [250]
        assert self.c.calc_line(9, 9, 9) == [75]
        assert self.c.calc_line(10, 10, 10) == [100]

    def test_calc_line_triple_ups(self):
        assert self.c.calc_line(1, 2, 3) == [6]
        assert self.c.calc_line(3, 2, 3) == [6]
        assert self.c.calc_line(2, 3, 2) == [6]

    def test_calc_line_triple_down(self):
        assert self.c.calc_line(5, 6, 7) == [2]
        assert self.c.calc_line(5, 6, 6) == [2]

    def test_calc_line_bacon(self):
        assert self.c.calc_line(9, 0, 0) == [50]
        assert self.c.calc_line(0, 9, 0) == [50]
        assert self.c.calc_line(0, 0, 9) == [50]

    def test_calc_line_bacon_trip_ups(self):
        assert self.c.calc_line(9, 2, 3) == [6]
        assert self.c.calc_line(1, 9, 3) == [6]
        assert self.c.calc_line(1, 2, 9) == [6]

    def test_calc_line_bacon_trip_down(self):
        assert self.c.calc_line(9, 6, 7) == [2]
        assert self.c.calc_line(5, 9, 7) == [2]
        assert self.c.calc_line(5, 6, 9) == [2]

    def test_calc_line_double_bacon(self):
        assert self.c.calc_line(9, 9, 0) == [50]
        assert self.c.calc_line(0, 9, 9) == [50]
        assert self.c.calc_line(9, 0, 9) == [50]

    def test_calc_line_nothing(self):
        assert self.c.calc_line(0, 1, 2) == [0]

    def test_get_stops(self):
        assert self.c.get_stops(23888) == [16, 10, 23]
        assert self.c.get_stops(1606) == [6, 18, 1]
        assert self.c.get_stops(30464) == [0, 24, 29]
        assert self.c.get_stops(0) == [0, 0, 0]

    def test_calc_reward(self):
        assert self.c.calc_reward(23888, 1) == [6]
        assert self.c.calc_reward(23888, 3) == [26]
        assert self.c.calc_reward(23888, 5) == [32]

    def test_calc_reward_2878(self):
        # wheel stops should wrap around
        assert self.c.get_stops(2878) == [30, 25, 2]
        assert self.c.calc_reward(2878, 5) == [6]

    def test_claim_winning(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        self.s.mine(1)
        assert self.c.spin(5) == [1]

        self.s.mine(1)
        assert self.c.claim(1) == [1]

        player, block, timestamp, bet, result, entropy, rnd, status = self.c.get_round(1)
        assert player == int(tester.a0, 16)
        assert bet == 5
        assert result == 25
        assert entropy == 21247117214489229499127664727368756521312663676433866631611806496815512017794L
        assert rnd == 23426
        assert status == 2  # done

        current_round, balance = self.c.get_current_player()
        assert current_round == 1
        assert balance == 25

        assert self.c.get_stats() == [2, 1, 25]

    def test_claim_losing(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        self.s.mine(1)
        assert self.c.claim(1) == [1]

        player, block, timestamp, bet, result, entropy, rnd, status = self.c.get_round(1)
        assert player == int(tester.a0, 16)
        assert bet == 5
        assert result == 0
        assert entropy == -53669045882980737574605973067441324862018663655629087799958787665378161080178L
        assert rnd == 18574
        assert status == 2  # done

        current_round, balance = self.c.get_current_player()
        assert current_round == 1
        assert balance == 0

    def test_claim_invalid_status(self):
        assert self.c.claim(1) == [90]

    def test_claim_invalid_round(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        assert self.c.claim(1, sender=tester.k1) == [91]

    def test_claim_not_yet_ready(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        assert self.c.claim(1) == [92]

    def test_claim_not_yet_ready(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        assert self.c.claim(1) == [92]

    def test_claim_block_number_out_of_range(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        assert self.c.spin(5) == [1]

        self.s.mine(256)
        assert self.c.claim(1) == [93]

    def test_withdraw_more_than_balance(self):
        assert self.c.deposit(value=5 * self.ETHER) == [1]
        self.s.mine(1)
        assert self.c.spin(5) == [1]

        self.s.mine(1)
        assert self.c.claim(1) == [1]

        current_round, balance = self.c.get_current_player()
        assert balance == 25

        balance_before = self.s.block.get_balance(tester.a0)
        assert self.c.withdraw(25) == [0]

        # no withdraw should happen

        current_round, balance = self.c.get_current_player()
        assert balance == 25

        assert self.s.block.get_balance(tester.a0) == balance_before

    @slow
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
