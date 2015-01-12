#!/usr/bin/env python

import argparse
import logging
from pprint import pprint

from pyepm import api
from serpent import compile

CONTRACT_FILE = "contracts/sleth.se"
CONTRACT_GAS = 50000


def cmd_create(args):
    instance = api.Api()

    contract = compile(open(CONTRACT_FILE).read()).encode('hex')
    contract_address = instance.create(contract, gas=CONTRACT_GAS)
    print "Contract is available at %s" % contract_address
    if args.wait:
        instance.wait_for_next_block(verbose=True)

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

    parser_status = subparsers.add_parser('status', help='display the eth node status')
    parser_status.set_defaults(func=cmd_status)

    parser_transact = subparsers.add_parser('transact', help='transact ether to destination (default: 1 ETH)')
    parser_transact.set_defaults(func=cmd_transact)
    parser_transact.add_argument('dest', help='destination')
    parser_transact.add_argument('--value', type=int, default=1, help='value to transfer in ether')
    parser_transact.add_argument('--wait', action='store_true', help='wait for block to be mined')

    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
