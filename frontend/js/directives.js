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

var app = angular.module('slots.directives', []);

app.directive('keypressEvents', function ($document, $rootScope) {
    return {
        restrict: 'A',
        link: function () {
            $document.bind('keypress', function (e) {
                $rootScope.$broadcast('keypress', e);
            });
        }
    };
});

app.directive('playerBar', function() {
  return {
    restrict: 'E',
    scope: {
      player: '=player',
      web3: '=web3'
    },
    templateUrl: 'templates/player-bar.html'
  };
});

app.directive('progressBar', function() {
  return {
    restrict: 'E',
    scope: {
      value: '=value',
      success: '=success'
    },
    templateUrl: 'templates/progress-bar.html'
  };
});

app.directive('revealValue', function() {
  return {
    restrict: 'E',
    scope: {
      on: '=on',
      value: '=value'
    },
    templateUrl: 'templates/reveal-value.html'
  };
});

app.directive('roundPanel', function() {
  return {
    restrict: 'E',
    scope: {
      round: '=round',
      state: '=state'
    },
    templateUrl: 'templates/round-panel.html'
  };
});

app.directive('prevRoundsPanel', function() {
  return {
    restrict: 'E',
    scope: {
      rounds: '=rounds',
      currentRound: '=currentRound'
    },
    templateUrl: 'templates/prev-rounds-panel.html'
  };
});

app.directive('statsPanel', function() {
  return {
    restrict: 'E',
    scope: {
      contract: '=contract',
      stats: '=stats'
    },
    templateUrl: 'templates/stats-panel.html'
  };
});
