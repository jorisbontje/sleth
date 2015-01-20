"use strict";

var app = angular.module('sleth',[]);

app.factory('web3', function() {
    var web3 = require('web3');
    web3.setProvider(new web3.providers.AutoProvider());
    return web3;
});

app.controller("SlethController", ['$http', '$q', '$scope', 'web3', function($http, $q, $scope, web3) {

    $scope.slethAddress = "0x23a2df087d6ade86338d6cf881da0f12f6b9257a";
    $scope.defaultGas = web3.fromDecimal(10000);
    $scope.contract = $q.defer();

    $scope.player = {};
    $scope.round = {};
    $scope.messages = [];

    $scope.depositAmount = 0;
    $scope.withdrawAmount = 0;

    $http.get('../contracts/sleth.abi.json').then(function(res) {
        $scope.contract.resolve(web3.eth.contract($scope.slethAddress, res.data));
    });

    $scope.updateAccount = function() {
        web3.eth.accounts.then(function (accounts) {
            $scope.player.address = accounts[0];
            $scope.$apply();
            return(web3.eth.balanceAt(accounts[0]));
        }).then(function (balance) {
            $scope.player.balance = web3.toDecimal(balance) / Math.pow(10, 18);
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
                        console.log("Automatically claiming round #" + roundNumber);
                        $scope.claim(roundNumber, $scope.entropy);
                    } else if (round.status == 2) {
                        var message = "Results for round #" + roundNumber + ": you won ";
                        if (round.result) {
                            message += round.result + " coins :)";
                        } else {
                            message += "nothing :(";
                        };
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
                $scope.updateAccount();
                $scope.updatePlayer();
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
                $scope.updateAccount();
                $scope.updatePlayer();
            });
        }
    };

    $scope.spin = function(bet) {
        if (bet) {
            $scope.clearMessages();
            $scope.contract.promise.then(function(contract) {
                return(contract.spin(bet).transact({gas: $scope.defaultGas}));
            }).then(function(res) {
                $scope.logMessage("Spinning... " + bet);
                $scope.updatePlayer();
            });

            $scope.generateEntropy();
        }
    }

    $scope.claim = function(round, entropy) {
        if (round) {
            $scope.contract.promise.then(function(contract) {
                return(contract.claim(round, entropy).transact({gas: $scope.defaultGas}));
            }).then(function(res) {
                $scope.logMessage("Claiming round #" + round + "...");
                $scope.updatePlayer();
                $scope.updateRound();
            });
        }
    }

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
        $scope.updateAccount();
        $scope.updatePlayer();
        $scope.updateRound();
    });

    $scope.updateAccount();
    $scope.updatePlayer();
    $scope.generateEntropy();
}]);
