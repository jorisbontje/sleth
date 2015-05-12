from ethereum import tester
from ethereum import utils

def hash_value(value):
    return utils.big_endian_to_int(utils.sha3(utils.zpad(value, 32)))


class TestCommitRevealEntropyContract(object):

    CONTRACT = 'contracts/commit_reveal_entropy.se'
    CONTRACT_GAS = 1014114
    COW_HASH = hash_value('cow')
    COW_INT = utils.big_endian_to_int('cow')
    MONKEY_INT = utils.big_endian_to_int('monkey')

    ENTROPY_COST = 10 ** 15
    DEPOSIT_COST = 10 ** 18

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT, gas=cls.CONTRACT_GAS)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_create_gas_used(self):
        print "create gas used:", self.s.block.gas_used
        assert self.s.block.gas_used <= self.CONTRACT_GAS

    def test_request_entropy(self):
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [0, 4]
        assert self.c.get_entropy_ticket(0) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]
        assert self.c.get_entropy(0) == [0, 0]  # pending
        assert self.c.get_block(self.s.block.number + 1) == [0, 0, 0, 1]

        assert self.s.block.get_balance(tester.a0) == 10 ** 24 - self.ENTROPY_COST

    def test_request_entropy_insufficient_fee(self):
        assert self.c.request_entropy(value=0) == [0]
        assert self.c.get_entropy_ticket(0) == [0, 0, 0, 0]
        assert self.c.get_entropy(0) == [3, 0]  # not found

    def test_request_multiple_entropy_tickets(self):
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [0, 4]
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [1, 4]
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [2, 4]

        assert self.c.get_entropy_ticket(0) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]
        assert self.c.get_entropy_ticket(1) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]
        assert self.c.get_entropy_ticket(2) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]

        assert self.c.get_block(self.s.block.number + 1) == [0, 0, 0, 3]

    def test_request_multiple_entropy_tickets_different_senders(self):
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [0, 4]
        assert self.c.request_entropy(sender=tester.k1, value=self.ENTROPY_COST) == [1, 4]

        assert self.c.get_entropy_ticket(0) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]
        assert self.c.get_entropy_ticket(1) == [utils.big_endian_to_int(tester.a1), 0, self.s.block.number + 1, 0]

        assert self.c.get_block(self.s.block.number + 1) == [0, 0, 0, 2]

    def test_request_entropy_target_depends_on_block_number(self):
        self.s.mine()
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [0, 5]
        assert self.c.get_entropy_ticket(0) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]

        self.s.mine(10)
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [1, 15]
        assert self.c.get_entropy_ticket(1) == [utils.big_endian_to_int(tester.a0), 0, self.s.block.number + 1, 0]

    def test_request_entropy_get_expired(self):
        assert self.c.request_entropy(value=self.ENTROPY_COST) == [0, 4]

        # XXX off by one?
        self.s.mine(4)
        assert self.s.block.number == 4
        assert self.c.get_entropy(0) == [2, 0]  # expired

    def test_hash_sha3(self):
        value = 'cow'
        assert self.c.hash(self.COW_INT) == hash_value(value)

    def test_commit(self):
        assert self.c.commit(1, self.COW_HASH, value=self.DEPOSIT_COST) == 1
        assert self.c.get_block(1) == [0, 1, 0, 0]

        assert self.s.block.get_balance(tester.a0) == 10 ** 24 - self.DEPOSIT_COST

    def test_commit_insufficient_deposit(self):
        assert self.c.commit(4, self.COW_HASH, value=0) == 0
        assert self.c.get_block(4) == [0, 0, 0, 0]

    def test_commit_invalid_target(self):
        assert self.c.commit(0, self.COW_HASH, value=self.DEPOSIT_COST) == 0
        assert self.c.get_block(0) == [0, 0, 0, 0]

        self.s.mine(4)
        assert self.c.commit(4, self.COW_HASH, value=self.DEPOSIT_COST) == 0
        assert self.c.get_block(4) == [0, 0, 0, 0]

    def test_commit_twice(self):
        assert self.c.commit(4, self.COW_HASH, value=self.DEPOSIT_COST) == 1
        assert self.c.get_block(4) == [0, 1, 0, 0]

        assert self.c.commit(4, self.COW_HASH, value=self.DEPOSIT_COST) == 0
        assert self.c.get_block(4) == [0, 1, 0, 0]

    def test_commit_twice_different_senders(self):
        assert self.c.commit(4, self.COW_HASH, value=self.DEPOSIT_COST) == 1
        assert self.c.commit(4, self.COW_HASH, sender=tester.k1, value=self.DEPOSIT_COST) == 1
        assert self.c.get_block(4) == [0, 2, 0, 0]

    def test_commit_invalid_hash(self):
        assert self.c.commit(1, 0, value=self.DEPOSIT_COST) == 0
        assert self.c.get_block(0) == [0, 0, 0, 0]

    def test_reveal(self):
        self.test_commit()
        self.s.mine(2)

        balance = self.s.block.get_balance(tester.a0)
        assert self.c.reveal(1, self.COW_INT) == 1
        assert self.c.get_block(1) == [0x6d8d9b450dd77c907e2bc2b6612699789c3464ea8757c2c154621057582287a3, 1, 1, 0]
        assert self.s.block.get_balance(tester.a0) - balance == self.DEPOSIT_COST  # deposit return

    def test_reveal_not_yet_allowed(self):
        self.test_commit()

        assert self.c.reveal(1, self.COW_INT) == 90

    def test_reveal_window_expired(self):
        self.test_commit()
        self.s.mine(5)

        assert self.c.reveal(1, self.COW_INT) == 91

    def test_reveal_not_committed(self):
        self.s.mine(2)

        assert self.c.reveal(1, self.COW_INT) == 92

    def test_reveal_already_revealed(self):
        self.test_commit()
        self.s.mine(2)

        assert self.c.reveal(1, self.COW_INT) == 1
        assert self.c.reveal(1, self.COW_INT) == 93

    def test_reveal_hash_mismatch(self):
        self.test_commit()
        self.s.mine(2)

        assert self.c.reveal(1, self.MONKEY_INT) == 94

    def test_reveal_calculates_seed_when_all_reveals_are_in(self):
        assert self.c.commit(1, self.COW_HASH, value=self.DEPOSIT_COST) == 1
        assert self.c.commit(1, self.COW_HASH, sender=tester.k1, value=self.DEPOSIT_COST) == 1
        self.s.mine(2)

        assert self.c.reveal(1, self.COW_INT) == 1
        assert self.c.get_block(1) == [0, 2, 1, 0]
        assert self.c.reveal(1, self.COW_INT, sender=tester.k1) == 1
        assert self.c.get_block(1) == [0x2c996eb68c74cec2b2acd81abe0f75fe67b2b941702b8dc25e96a106800eb922, 2, 2, 0]

    def test_reveal_returns_entropy(self):
        assert self.c.commit(1, self.COW_HASH, value=self.DEPOSIT_COST) == 1
        assert self.c.request_entropy(sender=tester.k1, value=self.ENTROPY_COST) == [0, 4]
        assert self.c.get_block(self.s.block.number + 1) == [0, 1, 0, 1]

        self.s.mine(2)

        COW_SEED = utils.big_endian_to_int(utils.sha3(utils.sha3(utils.zpad('cow', 32)) + utils.zpad('cow', 32)))
        COW_HASH_1 = utils.big_endian_to_int(utils.sha3(utils.int_to_big_endian(COW_SEED)))

        balance = self.s.block.get_balance(tester.a0)
        assert self.c.reveal(1, self.COW_INT) == 1
        assert self.s.block.get_balance(tester.a0) - balance == self.DEPOSIT_COST + self.ENTROPY_COST  # deposit return + payout of committer share

        assert self.c.get_block(1) == [COW_SEED, 1, 1, 1]

        # signed vs unsigned as introduced by tester.send
        assert self.c.get_entropy_ticket(0) == [utils.big_endian_to_int(tester.a1), 1, 1, COW_HASH_1 - 2 ** 256]
        assert self.c.get_entropy(0, sender=tester.k1) == [1, COW_HASH_1 - 2 ** 256]  # ready
