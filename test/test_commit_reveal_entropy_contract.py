from pyethereum import tester
from pyethereum import utils

def hash_value(value):
    return utils.big_endian_to_int(utils.sha3(utils.zpad(value, 32)))


class TestCommitRevealEntropyContract(object):

    CONTRACT = 'contracts/commit_reveal_entropy.se'
    COW_HASH = hash_value('cow')

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def _request_entropy(self, cost=10**15, sender=tester.k0):
        return self.s.send(sender, self.c, cost, funid=0, abi=[])

    def _get_entropy(self, ticket_id, sender=tester.k0):
        return self.s.send(sender, self.c, 0, funid=1, abi=[ticket_id])

    def _get_entropy_ticket(self, ticket_id):
        return self.s.send(tester.k0, self.c, 0, funid=2, abi=[ticket_id])

    def _commit(self, target, hash, deposit=10**18, sender=tester.k0):
        return self.s.send(sender, self.c, deposit, funid=3, abi=[target, hash])

    def _reveal(self, target, value, sender=tester.k0):
        return self.s.send(sender, self.c, 0, funid=4, abi=[target, utils.big_endian_to_int(value)])

    def _get_block(self, target):
        return self.s.send(tester.k0, self.c, 0, funid=5, abi=[target])

    def _call_hash(self, value):
        return self.s.send(tester.k0, self.c, 0, funid=6, abi=[utils.big_endian_to_int(value)])

    def test_request_entropy(self):
        assert self._request_entropy() == [0, 4]
        assert self._get_entropy_ticket(0) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]
        assert self._get_entropy(0) == [0, 0]  # pending
        assert self._get_block(self.s.block.number + 1) == [0, 0, 0, 1]

        assert self.s.block.get_balance(tester.a0) == 10 ** 24 - 10 ** 15

    def test_request_entropy_insufficient_fee(self):
        assert self._request_entropy(cost=0) == [0]
        assert self._get_entropy_ticket(0) == [0, 0, 0, 0]
        assert self._get_entropy(0) == [3, 0]  # not found

    def test_request_multiple_entropy_tickets(self):
        assert self._request_entropy() == [0, 4]
        assert self._request_entropy() == [1, 4]
        assert self._request_entropy() == [2, 4]

        assert self._get_entropy_ticket(0) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]
        assert self._get_entropy_ticket(1) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]
        assert self._get_entropy_ticket(2) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]

        assert self._get_block(self.s.block.number + 1) == [0, 0, 0, 3]

    def test_request_multiple_entropy_tickets_different_senders(self):
        assert self._request_entropy() == [0, 4]
        assert self._request_entropy(sender=tester.k1) == [1, 4]

        assert self._get_entropy_ticket(0) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]
        assert self._get_entropy_ticket(1) == [int(tester.a1, 16), 0, self.s.block.number + 1, 0]

        assert self._get_block(self.s.block.number + 1) == [0, 0, 0, 2]

    def test_request_entropy_target_depends_on_block_number(self):
        self.s.mine()
        assert self._request_entropy() == [0, 5]
        assert self._get_entropy_ticket(0) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]

        self.s.mine(10)
        assert self._request_entropy() == [1, 15]
        assert self._get_entropy_ticket(1) == [int(tester.a0, 16), 0, self.s.block.number + 1, 0]

    def test_request_entropy_get_expired(self):
        assert self._request_entropy() == [0, 4]

        # XXX off by one?
        self.s.mine(4)
        assert self.s.block.number == 4
        assert self._get_entropy(0) == [2, 0]  # expired

    def test_hash_sha3(self):
        value = 'cow'
        assert self._call_hash(value) == [hash_value(value)]

    def test_commit(self):
        assert self._commit(1, self.COW_HASH) == [1]
        assert self._get_block(1) == [0, 1, 0, 0]

        assert self.s.block.get_balance(tester.a0) == 10 ** 24 - 10 ** 18

    def test_commit_insufficient_deposit(self):
        assert self._commit(4, self.COW_HASH, deposit=0) == [0]
        assert self._get_block(4) == [0, 0, 0, 0]

    def test_commit_invalid_target(self):
        assert self._commit(0, self.COW_HASH) == [0]
        assert self._get_block(0) == [0, 0, 0, 0]

        self.s.mine(4)
        assert self._commit(4, self.COW_HASH) == [0]
        assert self._get_block(4) == [0, 0, 0, 0]

    def test_commit_twice(self):
        assert self._commit(4, self.COW_HASH) == [1]
        assert self._get_block(4) == [0, 1, 0, 0]

        assert self._commit(4, self.COW_HASH) == [0]
        assert self._get_block(4) == [0, 1, 0, 0]

    def test_commit_twice_different_senders(self):
        assert self._commit(4, self.COW_HASH) == [1]
        assert self._commit(4, self.COW_HASH, sender=tester.k1) == [1]
        assert self._get_block(4) == [0, 2, 0, 0]

    def test_commit_invalid_hash(self):
        assert self._commit(1, 0) == [0]
        assert self._get_block(0) == [0, 0, 0, 0]

    def test_reveal(self):
        self.test_commit()
        self.s.mine(2)

        balance = self.s.block.get_balance(tester.a0)
        assert self._reveal(1, 'cow') == [1]
        assert self._get_block(1) == [0x6d8d9b450dd77c907e2bc2b6612699789c3464ea8757c2c154621057582287a3, 1, 1, 0]
        assert self.s.block.get_balance(tester.a0) - balance == 10 ** 18  # deposit return

    def test_reveal_not_yet_allowed(self):
        self.test_commit()

        assert self._reveal(1, 'cow') == [90]

    def test_reveal_window_expired(self):
        self.test_commit()
        self.s.mine(5)

        assert self._reveal(1, 'cow') == [91]

    def test_reveal_not_committed(self):
        self.s.mine(2)

        assert self._reveal(1, 'cow') == [92]

    def test_reveal_already_revealed(self):
        self.test_commit()
        self.s.mine(2)

        assert self._reveal(1, 'cow') == [1]
        assert self._reveal(1, 'cow') == [93]

    def test_reveal_hash_mismatch(self):
        self.test_commit()
        self.s.mine(2)

        assert self._reveal(1, 'monkey') == [94]

    def test_reveal_calculates_seed_when_all_reveals_are_in(self):
        assert self._commit(1, self.COW_HASH) == [1]
        assert self._commit(1, self.COW_HASH, sender=tester.k1) == [1]
        self.s.mine(2)

        assert self._reveal(1, 'cow') == [1]
        assert self._get_block(1) == [0, 2, 1, 0]
        assert self._reveal(1, 'cow', sender=tester.k1) == [1]
        assert self._get_block(1) == [0x2c996eb68c74cec2b2acd81abe0f75fe67b2b941702b8dc25e96a106800eb922, 2, 2, 0]

    def test_reveal_returns_entropy(self):
        assert self._commit(1, self.COW_HASH) == [1]
        assert self._request_entropy() == [0, 4]
        assert self._get_block(self.s.block.number + 1) == [0, 1, 0, 1]

        self.s.mine(2)

        SEED = 0x6d8d9b450dd77c907e2bc2b6612699789c3464ea8757c2c154621057582287a3
        HASH_1 = -0x217015341621a8359cbcae58c0498f47cf0b55befbe600d6ae74ae4b45478191
        assert self._reveal(1, 'cow') == [1]
        assert self._get_block(1) == [SEED, 1, 1, 1]
        assert self._get_entropy_ticket(0) == [int(tester.a0, 16), 1, 1, HASH_1]
        assert self._get_entropy(0) == [1, HASH_1]  # ready

        hash_2 = utils.big_endian_to_int(utils.sha3(utils.int_to_big_endian(SEED)))
        # signed vs unsigned as introduced by tester.send
        assert hash_2 == 2**256 + HASH_1
