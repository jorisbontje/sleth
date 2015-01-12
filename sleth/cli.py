#!/usr/bin/env python

import argparse
import logging
from pprint import pprint

from pyepm import api
from serpent import compile

CONTRACT_FILE = "contracts/sleth.se"
CONTRACT_GAS = 50000

def cmd_spin(args):
    instance = api.Api()
    instance.transact(args.contract, funid=0, data=[int(args.bet)])

def cmd_claim(args):
    instance = api.Api()
    instance.transact(args.contract, funid=1, data=[int(args.round), int(args.entropy)])

def cmd_deposit(args):
    instance = api.Api()
    instance.transact(args.contract, funid=2, data=[], value=int(args.amount))

def cmd_withdraw(args):
    instance = api.Api()
    instance.transact(args.contract, funid=3, data=[int(args.amount)])

def cmd_get_round(args):
    instance = api.Api()
    result = instance.call(args.contract, funid=4, data=[int(args.round)])
    pprint(result)

def cmd_get_current_player(args):
    instance = api.Api()
    result = instance.call(args.contract, funid=5, data=[])
    pprint(result)

def cmd_create(args):
    instance = api.Api()
    contract = compile(open(CONTRACT_FILE).read()).encode('hex')
    contract_address = instance.create(contract, gas=CONTRACT_GAS)
    print "Contract is available at %s" % contract_address
    if args.wait:
        instance.wait_for_next_block(verbose=True)

def cmd_inspect(args):
    instance = api.Api()
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

    instance.transact(args.dest, value=args.value * 10 ** 18)
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

    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
