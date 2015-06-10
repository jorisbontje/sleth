/**

Copyright (c) 2015 Joris Bontje
Copyright (c) 2012 Clint Bellanger

MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Sounds by Brandon Morris (CC-BY 3.0)
Art by Clint Bellanger (CC-BY 3.0)

*/

"use strict";

var app = angular.module('slethController', ['slots.config', 'slots.game', 'slots.reels', 'slots.directives', 'ngAnimate', 'angular-lodash', 'angularMoment']);

app.factory('moment', function() {
    var moment = window.moment;
    window.moment = undefined;
    return moment;
});

app.factory('web3', function() {
    var web3 = require('web3');
    web3.setProvider(new web3.providers.HttpProvider("http://localhost:8545/"));
    return web3;
});

app.controller("SlethController", ['$http', '$interval', '$log', '$q', '$routeParams', '$scope', '$timeout', 'config', 'game', 'moment', 'web3', function($http, $interval, $log, $q, $routeParams, $scope, $timeout, config, game, moment, web3) {

    var ROUND_NEW = 0;
    var ROUND_SPINNING = 1;
    var ROUND_DONE = 2;
    var ROUND_EXPIRED = 2;

    var MAX_BLOCK_AGE = 255;

    /* global BigNumber:false */
    var two_256 = new BigNumber(2).toPower(256);

    $scope.canvasSize = 160 * config.reel_scale;

    $scope.slethAddress = $routeParams.contractAddress;
    $scope.defaultGas = web3.fromDecimal(200000);
    $scope.contract = $q.defer();

    $scope.bet = 0;
    $scope.lastClaimed = 0;
    $scope.player = {};
    $scope.stats = {};
    $scope.round = {};
    $scope.messages = [];
    $scope.web3 = {};
    $scope.state = game.STATE_NEW;

    $scope.maxPayout = 250;

    $scope.rounds = {};

    $interval(function() {
        game.logic();
    }, 1000 / config.FPS);

    $http.get('sleth.abi.json').then(function(res) {
        var Contract = web3.eth.contract(res.data);
        $scope.contract.resolve(new Contract($scope.slethAddress));
    });

    $scope.updateChain = function() {
        var accounts = web3.eth.accounts;
        $scope.player.address = accounts[0];

        var playerBalance = web3.eth.getBalance(accounts[0]);
        $scope.player.balance = playerBalance.toNumber() / Math.pow(10, 18) || 0;
        $scope.player.coins = Math.floor($scope.player.balance);

        var slethBalance = web3.eth.getBalance($scope.slethAddress);
        $scope.stats.slethBalance = slethBalance.toNumber() / Math.pow(10, 18) || 0;
        $scope.stats.slethAddress = $scope.slethAddress;

        $scope.web3.blockNumber = web3.eth.blockNumber;
    };

    $scope.updateStats = function() {
        $scope.contract.promise.then(function(contract) {
            var res = contract.call({from: $scope.player.address}).get_stats();
            if (res.length) {
                $scope.stats.total_spins = res[0].toNumber();
                $scope.stats.total_coins_bet = res[1].toNumber();
                $scope.stats.total_coins_won = res[2].toNumber();
            } else {
                $log.warn("get_stats: Empty response");
            }
        });
    };

    $scope.getCurrentRound = function(contract) {
        var res = contract.call({from: $scope.player.address}).get_current_round();
        if (res) {
            return res.toNumber();
        }
    };

    $scope.getRound = function(contract, roundNumber) {
        var res = contract.call({from: $scope.player.address}).get_round(roundNumber);
        if (res.length) {
            var player = res[0].isNeg() ? res[0].plus(two_256) : res[0];
            var entropy = res[4].isNeg() ? res[4].plus(two_256) : res[4];
            var round = {
                number: roundNumber,
                player: '0x' + player.toString(16),
                block: res[1].toNumber(),
                bet: res[2].toNumber(),
                result: res[3].toNumber(),
                entropy: '0x' + entropy.toString(16),
                rnd: entropy.modulo(32768).toNumber(),
                status: res[5].toNumber()
            };
            return round;
        }
    };

    $scope.updateRound = function() {
        $scope.contract.promise.then(function(contract) {
            var roundNumber = $scope.getCurrentRound(contract);
            if (!roundNumber) {
                $log.warn("get_current_round: Empty response");
                return;
            }
            $scope.player.round = roundNumber;

            var round = $scope.getRound(contract, roundNumber);
            if (!round) {
                $log.warn("get_round: Empty response");
                return;
            }

            if (round.status === ROUND_SPINNING && ($scope.web3.blockNumber > round.block + MAX_BLOCK_AGE)) {
                round.status = ROUND_EXPIRED;
            }

            var changed = !angular.equals(round, $scope.round);
            $scope.round = round;

            if (changed) {
                if (round.status === ROUND_SPINNING && (game.state === game.STATE_NEW)) {
                    $scope.bet = round.bet;
                    game.spin(round.bet);
                } else if (round.status === ROUND_DONE && (game.state !== game.STATE_NEW)) {
                    $scope.bet = 0;
                    game.set_stops(round.rnd);
                    var message = "Results for round #" + roundNumber + ": you won ";
                    if (round.result) {
                        message += round.result + " coins :)";
                    } else {
                        message += "nothing :(";
                    }
                    $scope.logMessage(message);
                    $scope.rounds[roundNumber] = round;
                }
            }
        });
    };

    $scope.spin = function(bet) {
        if (bet) {
            if (game.state !== game.STATE_NEW && game.state !== game.STATE_REST) return;
            if ($scope.player.coins < bet) return;

            $scope.clearMessages();

            var value = web3.fromDecimal(bet * Math.pow(10, 18));
            $scope.contract.promise.then(function(contract) {
                contract.sendTransaction({from: $scope.player.address, gas: $scope.defaultGas, value: value}).spin(bet);

                $scope.bet = bet;

                game.spin(bet);
                $scope.logMessage("Spinning... " + bet);
                $scope.round = {};
            });
        }
    };

    $scope.canClaim = function(round) {
        return round.status === ROUND_SPINNING && ($scope.web3.blockNumber >= round.block) && ($scope.web3.blockNumber <= round.block + MAX_BLOCK_AGE) && (round.number > $scope.lastClaimed);
    };

    $scope.$watchGroup(['round', 'web3'], function(newValues, oldValues, scope) {
        if ($scope.canClaim($scope.round)) {
            $scope.claim($scope.round);
        }
    });

    $scope.claim = function(round) {
        if (round.number) {
            $scope.contract.promise.then(function(contract) {
                contract.sendTransaction({from: $scope.player.address, gas: $scope.defaultGas}).claim(round.number);

                $scope.logMessage("Claiming round #" + round.number + "...");
                $scope.lastClaimed = round.number;
            });
        }
    };

    $scope.spinBest = function() {
        if (game.state !== game.STATE_NEW && game.state !== game.STATE_REST) return;

        if ($scope.player.coins >= 5) {
            $scope.spin(5);
        } else if ($scope.player.coins >= 3) {
            $scope.spin(3);
        } else if ($scope.player.coins >= 1) {
            $scope.spin(1);
        } else if ($scope.autoplay) {
            $scope.logMessage("Out of funds, disabling autoplay");
            $scope.autoplay = false;
        }
    };

    $scope.autoplaySpin = function() {
        if ($scope.autoplay) {
            $scope.spinBest();
        }
    };

    $scope.$on('slots:reward', function(evt, reward) {
        $scope.reward = reward;
        // check if the locally calculated reward matches with the contract results
        $scope.reward.verified = (reward.payout === $scope.round.result);
        if ($scope.reward.verified) {
            $scope.logMessage("Reward verified");
        } else {
            $scope.logMessage("Reward NOT verified");
        }

        if ($scope.autoplay) {
            $scope.logMessage("Autoplay enabled, playing next round in " + config.autoplay_delay / 1000 + " seconds...");
            $timeout($scope.autoplaySpin, config.autoplay_delay);
        }
    });

    $scope.$on('keypress', function (evt, obj) {
        if (obj.which === 32) { // spacebar
            $scope.spinBest();
        }
    });

    $scope.clearMessages = function() {
        $scope.messages = [];
    };

    $scope.logMessage = function(message) {
        $log.info(message);
        $scope.messages.push(message);
    };

    // test if web3 is available
    try {
        $scope.web3.available = (web3.eth.coinbase !== "");
        $scope.contractExists = (web3.eth.getCode($scope.slethAddress) !== "0x0000000000000000000000000000000000000000000000000000000000000000");
    } catch(e) {
        $log.error(e);
        $scope.web3.error = e;
    }

    $scope.$on('slots:state', function(evt, state) {
        $scope.state = state;
    });

    function init() {
        if (!$scope.contractExists) {
            $scope.web3.error = {'name': "Contract Not Found", 'message': "The specified contract couldn't be found on the blockchain"};
            return;
        }

        $scope.$watch('player.round', $scope.updateRound);

        web3.eth.filter('latest').watch(function(res) {
            $log.debug('filter:latest');
            $scope.updateChain();
            $scope.updateRound();
            $scope.updateStats();
        });

        // force initial load
        $scope.updateChain();
        $scope.updateRound();
        $scope.updateStats();

        $scope.contract.promise.then(function(contract) {
            web3.eth.filter({'address': $scope.slethAddress, 'limit': 10}).watch(function(res) {
                if (!res || res.address !== $scope.slethAddress) {
                    $log.warn("watch: invalid result", res);
                    return;
                }
                var roundNumber = web3.toDecimal(res.data);
                $log.debug("filter.watch", roundNumber);
                if (roundNumber > 0 && !(roundNumber in $scope.rounds)) {
                    var round = $scope.getRound(contract, roundNumber);
                    if (round) {
                        $scope.rounds[roundNumber] = round;
                    } else {
                        $log.warn("watch: empty response received for round", roundNumber);
                    }
                }
            });
        });
    }

    if ($scope.web3.available) {
        init();
    }
}]);
