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

var app = angular.module('sleth',['slots.config', 'slots.game', 'slots.reels']);

app.factory('web3', function() {
    var web3 = require('web3');
    web3.setProvider(new web3.providers.AutoProvider());
    //web3.setProvider(new web3.providers.HttpRpcProvider("http://poc-8.ethdev.com:8080/"));
    return web3;
});

app.controller("SlethController", ['$http', '$interval', '$location', '$q', '$scope', 'config', 'game', 'web3', function($http, $interval, $location, $q, $scope, config, game, web3) {

    $scope.slethAddress = $location.search().address || "0x23a2df087d6ade86338d6cf881da0f12f6b9257a";
    $scope.slethBalance = 0;
    $scope.defaultGas = web3.fromDecimal(10000);
    $scope.contract = $q.defer();

    $scope.player = {};
    $scope.stats = {};
    $scope.round = {};
    $scope.messages = [];

    $scope.depositAmount = 0;
    $scope.withdrawAmount = 0;

    $interval(function() {
        game.logic();
    }, 1000 / config.FPS);

    $http.get('sleth.abi.json').then(function(res) {
        $scope.contract.resolve(web3.eth.contract($scope.slethAddress, res.data));
    });

    $scope.updateChain = function() {
        web3.eth.accounts.then(function (accounts) {
            $scope.player.address = accounts[0];
            $scope.$apply();
            return(web3.eth.balanceAt(accounts[0]));
        }).then(function (balance) {
            $scope.player.balance = web3.toDecimal(balance) / Math.pow(10, 18) || 0;
            $scope.$apply();
        });

        web3.eth.balanceAt($scope.slethAddress).then(function (balance) {
            $scope.slethBalance = web3.toDecimal(balance) / Math.pow(10, 18) || 0;
            $scope.$apply();
        });
    };

    $scope.updatePlayer = function() {
        $scope.contract.promise.then(function(contract) {
            return(contract.get_current_player().call());
        }).then(function(res) {
            $scope.player.round = res[0].toNumber();
            $scope.player.coins = res[1].toNumber();
        });
    };

    $scope.updateStats = function() {
        $scope.contract.promise.then(function(contract) {
            return(contract.get_stats().call());
        }).then(function(res) {
            $scope.stats.total_spins = res[1].toNumber();
            $scope.stats.total_coins_won = res[2].toNumber();
        });
    };

    $scope.updateRound = function() {
        var roundNumber = $scope.player.round;
        if(roundNumber) {
            $scope.contract.promise.then(function(contract) {
                return(contract.get_round(roundNumber).call());
            }).then(function(res) {
                var round = {
                    number: roundNumber,
                    player: res[0],
                    block: res[1].toNumber(),
                    timestamp: new Date(res[2].toNumber() * 1000),
                    bet: res[3].toNumber(),
                    result: res[4].toNumber(),
                    entropy: res[5].toNumber(),
                    status: res[6].toNumber()
                };

                var changed = !angular.equals(round, $scope.round);
                $scope.round = round;

                if (changed) {
                    console.log("ROUND", round);
                    if (round.status == 1) {
                        console.log("Trying to claim round #" + roundNumber);
                        $scope.claim(roundNumber, $scope.entropy);
                    } else if (round.status == 2) {
                        var message = "Results for round #" + roundNumber + ": you won ";
                        if (round.result) {
                            message += round.result + " coins :)";
                        } else {
                            message += "nothing :(";
                        }
                        $scope.logMessage(message);
                    }
                }
            });
        }
    };

    $scope.deposit = function(amount) {
        console.log("DEPOSIT", amount);
        if (amount) {
            var value = web3.fromDecimal(amount * Math.pow(10, 18));

            $scope.contract.promise.then(function(contract) {
                return(contract.deposit().transact({gas: $scope.defaultGas, value: value}));
            }).then(function(res) {
                $scope.logMessage("Deposited " + amount + " coins");
                $scope.updateChain();
                $scope.updatePlayer();
                $scope.updateStats();
            });
        }
    };

    $scope.withdraw = function(amount) {
        console.log("WITHDRAW", amount);

        if (amount) {
            $scope.contract.promise.then(function(contract) {
                return(contract.withdraw(amount).transact({gas: $scope.defaultGas}));
            }).then(function(res) {
                $scope.logMessage("Withdrawn " + amount + " coins");
                $scope.updateChain();
                $scope.updatePlayer();
                $scope.updateStats();
            });
        }
    };

    $scope.spin = function(bet) {
        if (bet) {
            if (game.state != game.STATE_REST) return;
            if ($scope.player.coins < bet) return;

            $scope.clearMessages();
            $scope.contract.promise.then(function(contract) {
                return(contract.spin(bet).transact({gas: $scope.defaultGas}));
            }).then(function(res) {
                game.spin(bet);
                $scope.logMessage("Spinning... " + bet);
                $scope.updatePlayer();
                $scope.updateStats();
            });

            $scope.generateEntropy();
        }
    };

    $scope.claim = function(round, entropy) {
        if (game.state != game.STATE_SPINMAX && game.state != game.STATE_REST) return;
        if (round) {
            game.set_stops(entropy);
            $scope.contract.promise.then(function(contract) {
                return(contract.claim(round, entropy).transact({gas: $scope.defaultGas}));
            }).then(function(res) {
                $scope.logMessage("Claiming round #" + round + "...");
                $scope.updatePlayer();
                $scope.updateStats();
                $scope.updateRound();
            });
        }
    };

    $scope.$on('slots:reward', function(evt, reward) {
        $scope.reward = reward;
        // check if the locally calculated reward matches with the contract results
        $scope.reward.verified = (reward.payout == $scope.round.result);
        if ($scope.reward.verified) {
            $scope.logMessage("Reward verified");
        } else {
            $scope.logMessage("Reward NOT verified");
        }
    });

    $scope.handleKey = function(e) {
        if (e.which == 32) { // spacebar
            if (game.state == game.STATE_SPINMAX) {
                $scope.claim($scope.player.round, $scope.entropy);
                return;
            }
            if (game.state != game.STATE_REST) return;

            if ($scope.player.coins >= 5) {
                $scope.spin(5);
            } else if ($scope.player.coins >= 3) {
                $scope.spin(3);
            } else if ($scope.player.coins >= 1) {
                $scope.spin(1);
            }
        }
    };

    $scope.generateEntropy = function() {
        $scope.entropy = Math.floor(Math.random() * Math.pow(32, 3));
    };

    $scope.clearMessages = function() {
        $scope.messages = [];
    };

    $scope.logMessage = function(message) {
        console.log("MESSAGE", message);
        $scope.messages.push(message);
    };

    $scope.$watch('player.round', $scope.updateRound);

    web3.eth.watch('chain').changed(function(res) {
        console.log("CHAIN UPDATED", res);
        $scope.updateChain();
        $scope.updatePlayer();
        $scope.updateRound();
        $scope.updateStats();
    });

    $scope.updateChain();
    $scope.updatePlayer();
    $scope.generateEntropy();
    $scope.updateStats();
}]);
