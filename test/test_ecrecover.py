import bitcoin as b
from ethereum import tester, utils


class TestECRecover(object):

    CONTRACT = """

def test_ecrecover(h, v, r, s):
    return(ecrecover(h, v, r, s))
"""

    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT)
        cls.snapshot = cls.s.snapshot()

    def setup_method(self, method):
        self.s.revert(self.snapshot)

    def test_ecrecover(self):
        priv = b.sha256('some big long brainwallet password')
        pub = b.privtopub(priv)

        msghash = b.sha256('the quick brown fox jumps over the lazy dog')
        V, R, S = b.ecdsa_raw_sign(msghash, priv)
        assert b.ecdsa_raw_verify(msghash, (V, R, S), pub)

        addr = utils.sha3(b.encode_pubkey(pub, 'bin')[1:])[12:]
        assert utils.privtoaddr(priv) == addr

        result = self.c.test_ecrecover(utils.big_endian_to_int(msghash.decode('hex')), V, R, S)
        assert result == utils.big_endian_to_int(addr)
