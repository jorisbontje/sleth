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

var app = angular.module('slots.game', []);

app.factory('game', function() {
    var symbol_count = 11;
    var match_payout = new Array(symbol_count);
    match_payout[7] = 4; // 3Down
    match_payout[6] = 6; // 2Down
    match_payout[5] = 8; // 1Down
    match_payout[1] = 10; // 1Up
    match_payout[2] = 15; // 2Up
    match_payout[3] = 20; // 3Up
    match_payout[4] = 25; // OrangeRed
    match_payout[0] = 50; // AlienHead
    match_payout[9] = 75; // Bacon
    match_payout[10] = 100; // Narwhal
    match_payout[8] = 250; // CakeDay

    var payout_ups = 6; // Any 3 Ups
    var payout_downs = 2; // Any 3 Downs

    var game = {};

    // given an input line of symbols, determine the payout
    game.calc_line = function(s1, s2, s3) {
      // perfect match
      if (s1 == s2 && s2 == s3) {
        return match_payout[s1];
      }

      // special case #1: triple ups
      if ((s1 == 1 || s1 == 2 || s1 == 3) &&
          (s2 == 1 || s2 == 2 || s2 == 3) &&
          (s3 == 1 || s3 == 2 || s3 == 3)) {
        return payout_ups;
      }

      // special case #2: triple down
      if ((s1 == 5 || s1 == 6 || s1 == 7) &&
          (s2 == 5 || s2 == 6 || s2 == 7) &&
          (s3 == 5 || s3 == 6 || s3 == 7)) {
        return payout_downs;
      }

      // special case #3: bacon goes with everything
      if (s1 == 9) {
        if (s2 == s3) return match_payout[s2];

        // wildcard trip ups
        if ((s2 == 1 || s2 == 2 || s2 == 3) &&
            (s3 == 1 || s3 == 2 || s3 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s2 == 5 || s2 == 6 || s2 == 7) &&
            (s3 == 5 || s3 == 6 || s3 == 7)) return payout_downs;

      }
      if (s2 == 9) {
        if (s1 == s3) return match_payout[s1];

        // wildcard trip ups
        if ((s1 == 1 || s1 == 2 || s1 == 3) &&
            (s3 == 1 || s3 == 2 || s3 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 == 5 || s1 == 6 || s1 == 7) &&
            (s3 == 5 || s3 == 6 || s3 == 7)) return payout_downs;

      }
      if (s3 == 9) {
        if (s1 == s2) return match_payout[s1];

        // wildcard trip ups
        if ((s1 == 1 || s1 == 2 || s1 == 3) &&
            (s2 == 1 || s2 == 2 || s2 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 == 5 || s1 == 6 || s1 == 7) &&
            (s2 == 5 || s2 == 6 || s2 == 7)) return payout_downs;
      }

      // check double-bacon
      if (s2 == 9 && s3 == 9) return match_payout[s1];
      if (s1 == 9 && s3 == 9) return match_payout[s2];
      if (s1 == 9 && s2 == 9) return match_payout[s3];

      // no reward
      return 0;
    };

    // calculate the reward
    game.calc_reward = function(playing_lines, result) {
      var reward = {
          payout: 0,
          partial_payouts: {}
      };

      var partial_payout;

      // Line 1
      partial_payout = game.calc_line(result[0][1], result[1][1], result[2][1]);
      if (partial_payout > 0) {
        reward.partial_payouts[1] = partial_payout;
        reward.payout += partial_payout;
      }

      if (playing_lines > 1) {
        // Line 2
        partial_payout = game.calc_line(result[0][0], result[1][0], result[2][0]);
        if (partial_payout > 0) {
          reward.partial_payouts[2] = partial_payout;
          reward.payout += partial_payout;
        }

        // Line 3
        partial_payout = game.calc_line(result[0][2], result[1][2], result[2][2]);
        if (partial_payout > 0) {
          reward.partial_payouts[3] = partial_payout;
          reward.payout += partial_payout;
        }
      }

      if (playing_lines > 3) {
        // Line 4
        partial_payout = game.calc_line(result[0][0], result[1][1], result[2][2]);
        if (partial_payout > 0) {
          reward.partial_payouts[4] = partial_payout;
          reward.payout += partial_payout;
        }

        // Line 5
        partial_payout = game.calc_line(result[0][2], result[1][1], result[2][0]);
        if (partial_payout > 0) {
          reward.partial_payouts[5] = partial_payout;
          reward.payout += partial_payout;
        }
      }

      return reward;
    }

    return game;
});
