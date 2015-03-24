#!/usr/bin/env python

import argparse
from pprint import pprint

from pyepm import api, config
import serpent

from constants import CONTRACT_FILE, CONTRACT_GAS, SPIN_GAS, CLAIM_GAS, ETHER


def cmd_spin(instance, args):
    print "Spinning the slots with bet", args.bet
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, fun_name='spin', sig='i', data=[int(args.bet)], value=int(args.bet) * ETHER, gas=SPIN_GAS)

def cmd_claim(instance, args):
    print "Claiming round ", args.round
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, fun_name='claim', sig='i', data=[int(args.round)], gas=CLAIM_GAS)

def cmd_get_round(instance, args):
    print "Getting information about round", args.round
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = instance.call(args.contract, fun_name='get_round', sig='i', data=[int(args.round)])
    assert result, "No result returned to call"
    array_len, player, block, bet, result, entropy, status = result
    print "Player:", hex(player)
    print "Block:", block
    print "Bet:", bet
    print "Result:", result
    print "Entropy:", hex(entropy)
    print "RND:", entropy % 32768
    print "Status:", status

def cmd_get_current_round(instance, args):
    print "Getting information about the current player round"
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = instance.call(args.contract, fun_name='get_current_round', sig='', data=[])
    assert result, "No result returned to call"
    print "Current round:", result[0]

def cmd_get_stats(instance, args):
    print "Getting statistics"
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = instance.call(args.contract, fun_name='get_stats', sig='', data=[])
    assert result, "No result returned to call"
    array_len, total_spins, total_coins_bet, total_coins_won = result
    print "Total spins:", total_spins
    print "Total coins bet:", total_coins_bet
    print "Total coins won:", total_coins_won
    if total_coins_bet > 0:
        print "Payout percentage: %.2f" % (float(total_coins_won) / total_coins_bet * 100)

def cmd_suicide(instance, args):
    print "Killing the contract"
    assert instance.is_contract_at(args.contract), "Contract not found"
    instance.transact(args.contract, fun_name='suicide', sig='', data=[])

def cmd_create(instance, args):
    creator_balance = instance.balance_at(args.from_address)
    balance_required = CONTRACT_GAS * 1e+13 + args.endowment * ETHER
    if creator_balance < balance_required:
        print "Insufficient balance to cover gas for contract creation."
        print "You need at least %d wei in account %s (current balance is %d wei)." % \
            (balance_required, args.from_address, creator_balance)
        return

    contract = serpent.compile(open(CONTRACT_FILE).read()).encode('hex')

    contract_address = instance.create(contract, gas=CONTRACT_GAS, endowment=args.endowment * ETHER)

    print "Contract will be available at %s" % contract_address
    instance.wait_for_contract(contract_address, verbose=True)
    print "Is contract?", instance.is_contract_at(contract_address)

def cmd_inspect(instance, args):
    defaultBlock = 'latest'
    if args.pending:
        defaultBlock = 'pending'

    result = instance.is_contract_at(args.contract, defaultBlock)
    print "Is contract?", result

    result = instance.balance_at(args.contract, defaultBlock)
    print "Balance", result

    print "Owner:"
    result = instance.storage_at(args.contract, 0, defaultBlock)
    pprint(result)

    print "Logs:"
    logs = instance.logs({'address': args.contract, 'fromBlock': hex(0), 'toBlock': 'latest'})
    pprint(logs)

def cmd_status(instance, args):
    print "Coinbase: %s" % instance.coinbase()
    print "Listening? %s" % instance.is_listening()
    print "Mining? %s" % instance.is_mining()
    print "Peer count: %d" % instance.peer_count()
    block_number = instance.number()
    print "Number: %d" % block_number

    last_block = instance.block(block_number)
    print "Last Block:"
    pprint(last_block)

    accounts = instance.accounts()
    print "Accounts:"
    for address in accounts:
        balance = instance.balance_at(address)
        print "- %s %.4e" % (address, balance)

def cmd_transact(instance, args):
    tx_count = instance.transaction_count()
    instance.transact(args.dest, value=args.value * ETHER)
    instance.wait_for_transaction(tx_count, verbose=True)

def main():
    api_config = config.read_config()
    instance = api.Api(api_config)

    parser = argparse.ArgumentParser()
    from_address = instance.accounts()[0]
    parser.add_argument('--from_address', default=from_address, help='address to send transactions from')

    subparsers = parser.add_subparsers(help='sub-command help')
    parser_create = subparsers.add_parser('create', help='create the contract')
    parser_create.set_defaults(func=cmd_create)
    parser_create.add_argument('--endowment', type=int, default=500, help='value to endow in ether')

    parser_inspect = subparsers.add_parser('inspect', help='inspect the contract')
    parser_inspect.set_defaults(func=cmd_inspect)
    parser_inspect.add_argument('contract', help='sleth contract address')
    parser_inspect.add_argument('--pending', action='store_true', help='look in pending transactions instead of mined')

    parser_status = subparsers.add_parser('status', help='display the eth node status')
    parser_status.set_defaults(func=cmd_status)

    parser_transact = subparsers.add_parser('transact', help='transact ether to destination (default: 1 ETH)')
    parser_transact.set_defaults(func=cmd_transact)
    parser_transact.add_argument('dest', help='destination')
    parser_transact.add_argument('--value', type=int, default=1, help='value to transfer in ether')

    parser_spin = subparsers.add_parser('spin', help='make a spin')
    parser_spin.set_defaults(func=cmd_spin)
    parser_spin.add_argument('contract', help='sleth contract address')
    parser_spin.add_argument('bet', help='bet amount')

    parser_claim = subparsers.add_parser('claim', help='clain a round')
    parser_claim.set_defaults(func=cmd_claim)
    parser_claim.add_argument('contract', help='sleth contract address')
    parser_claim.add_argument('round', help='round number to claim')

    parser_get_round = subparsers.add_parser('get_round', help='get round information')
    parser_get_round.set_defaults(func=cmd_get_round)
    parser_get_round.add_argument('contract', help='sleth contract address')
    parser_get_round.add_argument('round', help='round number')

    parser_get_current_round = subparsers.add_parser('get_current_round', help='get current round')
    parser_get_current_round.set_defaults(func=cmd_get_current_round)
    parser_get_current_round.add_argument('contract', help='sleth contract address')

    parser_get_stats = subparsers.add_parser('get_stats', help='get contract statistics')
    parser_get_stats.set_defaults(func=cmd_get_stats)
    parser_get_stats.add_argument('contract', help='sleth contract address')

    parser_suicide = subparsers.add_parser('suicide', help='kills the contract')
    parser_suicide.set_defaults(func=cmd_suicide)
    parser_suicide.add_argument('contract', help='sleth contract address')

    args = parser.parse_args()

    print "Using from_address = %s" % (args.from_address)
    instance.address = args.from_address
    args.func(instance, args)

if __name__ == '__main__':
    main()
