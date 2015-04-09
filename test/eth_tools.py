from ethereum import tester as t

def address(returned_value):
    return hex(returned_value).lstrip("0x").rstrip("L")

class Contract(object):
    def __init__(self, filepath, state):
        self.state = state
        self.contract = self.state.contract(filepath)

    @classmethod
    def from_address(cls, address, state):
        result = cls("", state)
        result.contract = address
        return result

    def call(self, function, arguments=[], ether=0, sender=t.k0):
        return self.state.send(sender, self.contract, ether, funid=function, abi=arguments)
