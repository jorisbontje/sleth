#!/usr/bin/env python

import argparse
import logging
from pprint import pprint

from pyepm import api
from serpent import compile

CONTRACT_FILE = "contracts/sleth.se"
CONTRACT_GAS = 52000

ETHER = 10 ** 18

def cmd_test(args):
    instance = api.Api()

    contract = compile(open(CONTRACT_FILE).read()).encode('hex')
    contract_address = instance.create(contract, gas=CONTRACT_GAS)
    print "Contract will be available at %s" % contract_address

    if args.wait:
        instance.wait_for_next_block(verbose=True)

    assert instance.is_contract_at(contract_address)

    instance.transact(contract_address, funid=2, data=[], value=10)

    result = instance.call(contract_address, funid=5, data=[])
    pprint(result)

    instance.transact(contract_address, funid=3, data=[5])

    result = instance.call(contract_address, funid=5, data=[])
    pprint(result)

def cmd_spin(args):
    print "Spinning the slots with bet", args.bet
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, funid=0, data=[int(args.bet)])

def cmd_claim(args):
    print "Claiming round ", args.round, "with entropy", args.entropy
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, funid=1, data=[int(args.round), int(args.entropy)])

def cmd_deposit(args):
    print "Depositing", args.amount, "ether"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, funid=2, data=[], value=int(args.amount) * ETHER)

def cmd_withdraw(args):
    print "Withdrawing", args.amount, "ether"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, funid=3, data=[int(args.amount)])

def cmd_get_round(args):
    print "Getting information about round", args.round
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = instance.call(args.contract, funid=4, data=[int(args.round)])
    player, block, timestamp, bet, result, entropy, status = result
    print "Player:", hex(player)
    print "Block:", block
    print "Timestamp:", timestamp
    print "Bet:", bet
    print "Result:", result
    print "Entropy:", entropy
    print "Status:", status

def cmd_get_current_player(args):
    print "Getting information about the current player"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = instance.call(args.contract, funid=5, data=[])
    current_round, balance = result
    print "Current round:", current_round
    print "Balance:", balance, "ether"

def cmd_create(args):
    instance = api.Api()
    contract = compile(open(CONTRACT_FILE).read()).encode('hex')
    contract_address = instance.create(contract, gas=CONTRACT_GAS)
    print "Contract will be available at %s" % contract_address
    if args.wait:
        instance.wait_for_next_block(verbose=True)
    print "Is contract?", instance.is_contract_at(contract_address)

def cmd_inspect(args):
    instance = api.Api()
    result = instance.is_contract_at(args.contract)
    print "Is contract?", result

    result = instance.storage_at(args.contract)
    pprint(result)

def cmd_status(args):
    instance = api.Api()

    print "Coinbase: %s" % instance.coinbase()
    print "Listening? %s" % instance.is_listening()
    print "Mining? %s" % instance.is_mining()
    print "Peer count: %d" % instance.peer_count()
    print "Number: %d" % instance.number()

    last_block = instance.last_block()
    print "Last Block:"
    pprint(last_block)

    accounts = instance.accounts()
    print "Accounts:"
    for address in accounts:
        balance = instance.balance_at(address)
        print "- %s %.4e" % (address, balance)

def cmd_transact(args):
    instance = api.Api()

    instance.transact(args.dest, value=args.value * ETHER)
    if args.wait:
        instance.wait_for_next_block(verbose=True)

def main():
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(help='sub-command help')
    parser_create = subparsers.add_parser('create', help='create the contract')
    parser_create.set_defaults(func=cmd_create)
    parser_create.add_argument('--wait', action='store_true', help='wait for block to be mined')

    parser_inspect = subparsers.add_parser('inspect', help='inspect the contract')
    parser_inspect.set_defaults(func=cmd_inspect)
    parser_inspect.add_argument('contract', help='sleth contract address')

    parser_status = subparsers.add_parser('status', help='display the eth node status')
    parser_status.set_defaults(func=cmd_status)

    parser_transact = subparsers.add_parser('transact', help='transact ether to destination (default: 1 ETH)')
    parser_transact.set_defaults(func=cmd_transact)
    parser_transact.add_argument('dest', help='destination')
    parser_transact.add_argument('--value', type=int, default=1, help='value to transfer in ether')
    parser_transact.add_argument('--wait', action='store_true', help='wait for block to be mined')

    parser_spin = subparsers.add_parser('spin', help='make a spin')
    parser_spin.set_defaults(func=cmd_spin)
    parser_spin.add_argument('contract', help='sleth contract address')
    parser_spin.add_argument('bet', help='bet amount')

    parser_claim = subparsers.add_parser('claim', help='clain a round')
    parser_claim.set_defaults(func=cmd_claim)
    parser_claim.add_argument('contract', help='sleth contract address')
    parser_claim.add_argument('round', help='round number to claim')
    parser_claim.add_argument('entropy', help='your random number')  # XXX for testing purposes only

    parser_deposit = subparsers.add_parser('deposit', help='make a deposit')
    parser_deposit.set_defaults(func=cmd_deposit)
    parser_deposit.add_argument('contract', help='sleth contract address')
    parser_deposit.add_argument('amount', help='amount to deposit')

    parser_withdraw = subparsers.add_parser('withdraw', help='make a withdraw')
    parser_withdraw.set_defaults(func=cmd_withdraw)
    parser_withdraw.add_argument('contract', help='sleth contract address')
    parser_withdraw.add_argument('amount', help='amount to withdraw')

    parser_get_round = subparsers.add_parser('get_round', help='get round information')
    parser_get_round.set_defaults(func=cmd_get_round)
    parser_get_round.add_argument('contract', help='sleth contract address')
    parser_get_round.add_argument('round', help='round number')

    parser_get_current_player = subparsers.add_parser('get_current_player', help='get current player information')
    parser_get_current_player.set_defaults(func=cmd_get_current_player)
    parser_get_current_player.add_argument('contract', help='sleth contract address')

    parser_test = subparsers.add_parser('test', help='test simple contract')
    parser_test.set_defaults(func=cmd_test)
    parser_test.add_argument('--wait', action='store_true', help='wait for block to be mined')

    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
