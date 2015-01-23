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

var app = angular.module('slots', ['slots.game', 'slots.reels', 'slots.sounds']);

app.constant('config', {
    FPS: 60,
    STATE_REST: 0,
    STATE_SPINUP: 1,
    STATE_SPINMAX: 2,
    STATE_SPINDOWN: 3,
    STATE_REWARD: 4,

    reel_count: 3,
    row_count: 3,
    reel_positions: 32,
    symbol_size: 32
});

app.controller("SlotsController", ['$scope', '$interval', 'config', 'game', 'sounds', function($scope, $interval, config, game, sounds) {

$interval(function() {
    logic();
}, 1000 / config.FPS);

// config
var reel_pixel_length = config.reel_positions * config.symbol_size;
var stopping_distance = 528;
var max_reel_speed = 32;
var spinup_acceleration = 2;
var spindown_acceleration = 1;
var starting_credits = 100;
var reward_delay = 3; // how many frames between each credit tick
var reward_delay_grand = 1; // delay for grand-prize winning
var reward_grand_threshhold = 25; // count faster if the reward is over this size

$scope.reel_position = new Array(config.reel_count);
for (var i=0; i<config.reel_count; i++) {
  $scope.reel_position[i] = Math.floor(Math.random() * config.reel_positions) * config.symbol_size;
}

var stopping_position = new Array(config.reel_count);
var start_slowing = new Array(config.reel_count);

// reel spin speed in pixels per frame
var reel_speed = new Array(config.reel_count);
for (var i=0; i<config.reel_count; i++) {
  reel_speed[i] = 0;
}

var result = new Array(config.reel_count);
for (var i=0; i<config.reel_count; i++) {
  result[i] = new Array(config.row_count);
}

$scope.highlights = [];
$scope.game_state = config.STATE_REST;
$scope.credits = starting_credits;

$scope.reward = {
    payout: 0,
    partial_payouts: {}
};
var reward_delay_counter = 0;

//---- Logic Functions ---------------------------------------------

function set_stops(entropy) {
  var rnd = entropy;

  for (var i=0; i<config.reel_count; i++) {

    start_slowing[i] = false;

    var stop_index = rnd % config.reel_positions;
    rnd = Math.floor(rnd / config.reel_positions);

    stopping_position[i] = stop_index * config.symbol_size;

    stopping_position[i] += stopping_distance;
    if (stopping_position[i] >= reel_pixel_length) stopping_position[i] -= reel_pixel_length;

    // convenient here to remember the winning positions
    for (var j=0; j<config.row_count; j++) {
      result[i][j] = stop_index + j;
      if (result[i][j] >= config.reel_positions) result[i][j] -= config.reel_positions;

      // translate reel positions into symbol
      result[i][j] = game.reels[i][result[i][j]];
    }
  }
}

function move_reel(i) {
  $scope.reel_position[i] -= reel_speed[i];

  // wrap
  if ($scope.reel_position[i] < 0) {
    $scope.reel_position[i] += reel_pixel_length;
  }
}

// handle reels accelerating to full speed
function logic_spinup() {

  for (var i=0; i<config.reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // accelerate speed
    reel_speed[i] += spinup_acceleration;

  }

  // if reels at max speed, begin spindown
  if (reel_speed[0] == max_reel_speed) {


    $scope.game_state = config.STATE_SPINMAX;
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
  if (reel_speed[config.reel_count-1] == 0) {

    var reward = game.calc_reward($scope.playing_lines, result);
    $scope.highlights = Object.keys(reward.partial_payouts);

    if (reward.payout > 0) {
        sounds.playWin();
    }
    $scope.reward = reward;
    $scope.game_state = config.STATE_REWARD;
  }

  for (var i=0; i<config.reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // start slowing this reel?
    if (start_slowing[i] == false) {

      // if the first reel, or the previous reel is already slowing
      var check_position = false;
      if (i == 0) check_position = true;
      else if (start_slowing[i-1]) check_position = true;

      if (check_position) {

        if ($scope.reel_position[i] == stopping_position[i]) {
          start_slowing[i] = true;
        }
      }
    }
    else {
      if (reel_speed[i] > 0) {
        reel_speed[i] -= spindown_acceleration;

        if (reel_speed[i] == 0) {
          sounds.playReelStop(i);
        }

      }
    }
  }

}

// count up the reward credits, play sound effects, etc.
function logic_reward() {

  if ($scope.reward.payout == 0) {
    $scope.game_state = config.STATE_REST;
    return;
  }

  // don't tick up rewards each frame, too fast
  if (reward_delay_counter > 0) {
    reward_delay_counter--;
    return;
  }

  $scope.reward.payout--;
  $scope.credits++;

  if ($scope.reward.payout < reward_grand_threshhold) {
    reward_delay_counter = reward_delay;
  }
  else { // speed up big rewards
    reward_delay_counter += reward_delay_grand;
  }

}

// update all logic in the current frame
function logic() {

  // SPINMAX TO SPINDOWN happens on an input event
  // REST to SPINUP happens on an input event

  if ($scope.game_state == config.STATE_SPINUP) {
    logic_spinup();
  }
  else if ($scope.game_state == config.STATE_SPINMAX) {
    logic_spinmax();
  }
  else if ($scope.game_state == config.STATE_SPINDOWN) {
    logic_spindown();
  }
  else if ($scope.game_state == config.STATE_REWARD) {
    logic_reward();
  }

}

    //---- Input Functions ---------------------------------------------

    $scope.handleKey = function(evt) {
      if (evt.keyCode == 32) { // spacebar
        if ($scope.game_state == config.STATE_SPINMAX) {
            $scope.stop();
            return;
        };
        if ($scope.game_state != config.STATE_REST) return;

        if ($scope.credits >= 5) $scope.spin(5);
        else if ($scope.credits >= 3) $scope.spin(3);
        else if ($scope.credits >= 1) $scope.spin(1);

      }
    };

    $scope.spin = function(line_choice) {
      if ($scope.game_state != config.STATE_REST) return;
      if ($scope.credits < line_choice) return;

      $scope.credits -= line_choice;
      $scope.playing_lines = line_choice;

      $scope.reward.partial_payouts = {};
      $scope.generateEntropy();

      $scope.game_state = config.STATE_SPINUP;

    };

    $scope.generateEntropy = function() {
        $scope.entropy = Math.floor(Math.random() * Math.pow(32, 3));
    };

    $scope.stop = function() {
        if ($scope.game_state != config.STATE_SPINMAX) return;

        // calculate the final results now, so that spindown is ready
        set_stops($scope.entropy);
        $scope.game_state = config.STATE_SPINDOWN;
    };

}]);
