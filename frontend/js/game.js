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

app.factory('game', ['$rootScope', 'config', function($rootScope, config) {
    var symbol_count = 11;
    var match_payout = [];
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


    game.STATE_NEW = 0;
    game.STATE_REST = 1;
    game.STATE_SPINUP = 2;
    game.STATE_SPINMAX = 3;
    game.STATE_SPINDOWN = 4;

    game.state = game.STATE_NEW;

    game.reward = {
        payout: 0,
        partial_payouts: {},
        highlights: []
    };

    // set up reels
    game.reels = [];
    game.reels[0] = [2,1,7,1,2,7,6,7,3,10,1,6,1,7,3,4,3,2,4,5,0,6,10,5,6,5,8,3,0,9,5,4];
    game.reels[1] = [6,0,10,3,6,7,9,2,5,2,3,1,5,2,1,10,4,5,8,4,7,6,0,1,7,6,3,1,5,9,7,4];
    game.reels[2] = [1,4,2,7,5,6,4,10,7,5,2,0,6,4,10,1,7,6,3,0,5,7,2,3,9,3,5,6,1,8,1,3];

    // config
    game.reel_position = [];

    var stopping_position = [];
    var start_slowing = [];
    var reel_speed = [];  // reel spin speed in pixels per frame
    var result = [];

    for (var i=0; i<config.reel_count; i++) {
        game.reel_position[i] = Math.floor(Math.random() * config.reel_positions) * config.symbol_size;
        reel_speed[i] = 0;
        result[i] = [];
    }

    // given an input line of symbols, determine the payout
    game.calc_line = function(s1, s2, s3) {
      // perfect match
      if (s1 === s2 && s2 === s3) {
        return match_payout[s1];
      }

      // special case #1: triple ups
      if ((s1 === 1 || s1 === 2 || s1 === 3) &&
          (s2 === 1 || s2 === 2 || s2 === 3) &&
          (s3 === 1 || s3 === 2 || s3 === 3)) {
        return payout_ups;
      }

      // special case #2: triple down
      if ((s1 === 5 || s1 === 6 || s1 === 7) &&
          (s2 === 5 || s2 === 6 || s2 === 7) &&
          (s3 === 5 || s3 === 6 || s3 === 7)) {
        return payout_downs;
      }

      // special case #3: bacon goes with everything
      if (s1 === 9) {
        if (s2 === s3) return match_payout[s2];

        // wildcard trip ups
        if ((s2 === 1 || s2 === 2 || s2 === 3) &&
            (s3 === 1 || s3 === 2 || s3 === 3)) return payout_ups;

        // wildcard trip downs
        if ((s2 === 5 || s2 === 6 || s2 === 7) &&
            (s3 === 5 || s3 === 6 || s3 === 7)) return payout_downs;

      }
      if (s2 === 9) {
        if (s1 === s3) return match_payout[s1];

        // wildcard trip ups
        if ((s1 === 1 || s1 === 2 || s1 === 3) &&
            (s3 === 1 || s3 === 2 || s3 === 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 === 5 || s1 === 6 || s1 === 7) &&
            (s3 === 5 || s3 === 6 || s3 === 7)) return payout_downs;

      }
      if (s3 === 9) {
        if (s1 === s2) return match_payout[s1];

        // wildcard trip ups
        if ((s1 === 1 || s1 === 2 || s1 === 3) &&
            (s2 === 1 || s2 === 2 || s2 === 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 === 5 || s1 === 6 || s1 === 7) &&
            (s2 === 5 || s2 === 6 || s2 === 7)) return payout_downs;
      }

      // check double-bacon
      if (s2 === 9 && s3 === 9) return match_payout[s1];
      if (s1 === 9 && s3 === 9) return match_payout[s2];
      if (s1 === 9 && s2 === 9) return match_payout[s3];

      // no reward
      return 0;
    };

    game.calc_reward_line = function(reward, line, s1, s2, s3) {
        var partial_payout = game.calc_line(s1, s2, s3);
        if (partial_payout > 0) {
            reward.partial_payouts[line] = partial_payout;
            reward.payout += partial_payout;
            reward.highlights.push(line);
        }
    };

    // calculate the reward
    game.calc_reward = function(playing_lines, result) {
      var reward = {
          payout: 0,
          partial_payouts: {},
          highlights: []
      };

      // Line 1
      game.calc_reward_line(reward, 1, result[0][1], result[1][1], result[2][1]);

      if (playing_lines > 1) {
        // Line 2
        game.calc_reward_line(reward, 2, result[0][0], result[1][0], result[2][0]);
        // Line 3
        game.calc_reward_line(reward, 3, result[0][2], result[1][2], result[2][2]);
      }

      if (playing_lines > 3) {
        // Line 4
        game.calc_reward_line(reward, 4, result[0][0], result[1][1], result[2][2]);
        // Line 5
        game.calc_reward_line(reward, 5, result[0][2], result[1][1], result[2][0]);
      }

      return reward;
    };

    game.spin = function(line_choice) {
        game.playing_lines = line_choice;
        game.reward.payout = 0;
        game.reward.partial_payouts = {};
        game.state = game.STATE_SPINUP;
        $rootScope.$broadcast('slots:state', game.state);
    };

    game.set_stops = function(entropy) {
      var rnd = entropy;

      for (var i=0; i<config.reel_count; i++) {

        start_slowing[i] = false;

        var stop_index = rnd % config.reel_positions;
        rnd = Math.floor(rnd / config.reel_positions);

        stopping_position[i] = stop_index * config.symbol_size;

        stopping_position[i] += config.stopping_distance;
        if (stopping_position[i] >= config.reel_pixel_length) stopping_position[i] -= config.reel_pixel_length;

        // convenient here to remember the winning positions
        for (var j=0; j<config.row_count; j++) {
          result[i][j] = stop_index + j;
          if (result[i][j] >= config.reel_positions) result[i][j] -= config.reel_positions;

          // translate reel positions into symbol
          result[i][j] = game.reels[i][result[i][j]];
        }
      }

      game.state = game.STATE_SPINDOWN;
      $rootScope.$broadcast('slots:state', game.state);
    };

    game.get_result = function() {
        return result;
    };

    game.reinit = function(line_choice) {
      for (var i=0; i<config.reel_count; i++) {
        reel_speed[i] = config.max_reel_speed;
      }
      game.playing_lines = line_choice;
      game.reward.payout = 0;
      game.reward.partial_payouts = {};
      game.state = game.STATE_SPINMAX;
      $rootScope.$broadcast('slots:state', game.state);
    };

    function move_reel(i) {
      game.reel_position[i] -= reel_speed[i];

      // wrap
      if (game.reel_position[i] < 0) {
        game.reel_position[i] += config.reel_pixel_length;
      }
    }

    //---- Logic Functions ---------------------------------------------


    // handle reels accelerating to full speed
    function logic_spinup() {
      for (var i=0; i<config.reel_count; i++) {
        // move reel at current speed
        move_reel(i);

        // accelerate speed
        reel_speed[i] += config.spinup_acceleration;
      }

      // if reels at max speed, begin spindown
      if (reel_speed[0] >= config.max_reel_speed) {
        game.state = game.STATE_SPINMAX;
        $rootScope.$broadcast('slots:state', game.state);
      }
    }

    function logic_spinmax() {
      for (var i=0; i<config.reel_count; i++) {

        // move reel at current speed
        move_reel(i);
      }
    }

    // handle reel movement as the reels are coming to rest
    function logic_spindown() {

      // if reels finished moving, begin rewards
      if (reel_speed[config.reel_count-1] === 0) {
        var reward = game.calc_reward(game.playing_lines, result);
        game.reward = reward;
        game.state = game.STATE_REST;
        $rootScope.$broadcast('slots:state', game.state);
        $rootScope.$broadcast('slots:reward', reward);
        return;
      }

      for (var i=0; i<config.reel_count; i++) {

        // move reel at current speed
        move_reel(i);

        // start slowing this reel?
        if (! start_slowing[i]) {

          // if the first reel, or the previous reel is already slowing
          var check_position = false;
          if (i === 0) check_position = true;
          else if (start_slowing[i-1]) check_position = true;

          if (check_position) {

            if (game.reel_position[i] === stopping_position[i]) {
              start_slowing[i] = true;
            }
          }
        }
        else {
          if (reel_speed[i] > 0) {
            reel_speed[i] -= config.spindown_acceleration;

            // XXX sounds
            /*
            if (reel_speed[i] == 0) {
              sounds.playReelStop(i);
            }*/
          }
        }
      }
    }

    // update all logic in the current frame
    game.logic = function() {

      // SPINMAX TO SPINDOWN happens on an input event
      // NEW or REST to SPINUP happens on an input event

      if (game.state === game.STATE_SPINUP) {
        logic_spinup();
      }
      else if (game.state === game.STATE_SPINMAX) {
        logic_spinmax();
      }
      else if (game.state === game.STATE_SPINDOWN) {
        logic_spindown();
      }
    };

    return game;
}]);
