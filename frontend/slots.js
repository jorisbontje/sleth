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

var app = angular.module('slots', ['slots.game', 'slots.sounds']);

app.constant('config', {
    FPS: 60
});

app.directive('slots-reels', function() {
    return {
        restrict: 'A'
    };
});

app.controller("SlotsController", ['$scope', '$interval', 'config', 'game', 'sounds', function($scope, $interval, config, game, sounds) {

$interval(function() {
    logic();
    render();
}, 1000 / config.FPS);

// html elements
var ctx;     // context

var symbols_loaded = false;
var reels_bg_loaded = false;

// art
var symbols = new Image();
var reels_bg = new Image();

symbols.src = "images/reddit_icons_small.png";
reels_bg.src = "images/reels_bg.png";

// enums
var STATE_REST = 0;
var STATE_SPINUP = 1;
var STATE_SPINMAX = 2;
var STATE_SPINDOWN = 3;
var STATE_REWARD = 4;

// config
var reel_count = 3;
var reel_positions = 32;
var symbol_size = 32;

var reel_pixel_length = reel_positions * symbol_size;
var row_count = 3;
var stopping_distance = 528;
var max_reel_speed = 32;
var spinup_acceleration = 2;
var spindown_acceleration = 1;
var starting_credits = 100;
var reward_delay = 3; // how many frames between each credit tick
var reward_delay_grand = 1; // delay for grand-prize winning
var reward_grand_threshhold = 25; // count faster if the reward is over this size

var reel_area_left = 32;
var reel_area_top = 32;
var reel_area_width = 96;
var reel_area_height = 96;

// set up reels
var reels = new Array(reel_count);
reels[0] = new Array(2,1,7,1,2,7,6,7,3,10,1,6,1,7,3,4,3,2,4,5,0,6,10,5,6,5,8,3,0,9,5,4);
reels[1] = new Array(6,0,10,3,6,7,9,2,5,2,3,1,5,2,1,10,4,5,8,4,7,6,0,1,7,6,3,1,5,9,7,4);
reels[2] = new Array(1,4,2,7,5,6,4,10,7,5,2,0,6,4,10,1,7,6,3,0,5,7,2,3,9,3,5,6,1,8,1,3);

var reel_position = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  reel_position[i] = Math.floor(Math.random() * reel_positions) * symbol_size;
}

var stopping_position = new Array(reel_count);
var start_slowing = new Array(reel_count);

// reel spin speed in pixels per frame
var reel_speed = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  reel_speed[i] = 0;
}

var result = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  result[i] = new Array(row_count);
}

$scope.game_state = STATE_REST;
$scope.credits = starting_credits;

$scope.reward = {
    payout: 0,
    partial_payouts: {}
};
var reward_delay_counter = 0;

//---- Render Functions ---------------------------------------------

function draw_symbol(symbol_index, x, y) {
  var symbol_pixel = symbol_index * symbol_size;
  ctx.drawImage(symbols, 0,symbol_pixel,symbol_size,symbol_size, x+reel_area_left,y+reel_area_top,symbol_size,symbol_size);
}

function render_reel() {

  // clear reel
  ctx.drawImage(reels_bg, reel_area_left, reel_area_top);

  // set clipping area
  ctx.beginPath();
  ctx.rect(reel_area_left, reel_area_top, reel_area_width, reel_area_height);
  ctx.clip();

  var reel_index;
  var symbol_offset;
  var symbol_index;
  var x;
  var y;

  for (var i=0; i<reel_count; i++) {
    for (var j=0; j<row_count +1; j++) {

      reel_index = Math.floor(reel_position[i] / symbol_size) + j;
      symbol_offset = reel_position[i] % symbol_size;

      // reel wrap
      if (reel_index >= reel_positions) reel_index -= reel_positions;

      // symbol lookup
      symbol_index = reels[i][reel_index];

      x = i * symbol_size;
      y = j * symbol_size - symbol_offset;

      draw_symbol(symbol_index, x, y);

    }
  }
}

function highlight_line(line_num) {

  ctx.strokeStyle = "orange";
  var ss = symbol_size;

  // top row
  if (line_num == 2 || line_num == 4) {
    ctx.strokeRect(reel_area_left, reel_area_top, symbol_size-1, symbol_size-1); // top left
  }
  if (line_num == 2) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top, ss-1, ss-1); // top middle
  }
  if (line_num == 2 || line_num == 5) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top, ss-1, ss-1); // top right
  }

  // middle row
  if (line_num == 1) {
    ctx.strokeRect(reel_area_left, reel_area_top + ss, ss-1, ss-1); // top left
  }
  if (line_num == 1 || line_num == 4 || line_num == 5) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 1) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top + ss, ss-1, ss-1); // top right
  }

  // bottom row
  if (line_num == 3 || line_num == 5) {
    ctx.strokeRect(reel_area_left, reel_area_top + ss + ss, ss-1, ss-1); // top left
  }
  if (line_num == 3) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top + ss + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 3 || line_num == 4) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top + ss + ss, ss-1, ss-1); // top right
  }

}

// render all art needed in the current frame
function render() {

  if ($scope.game_state == STATE_SPINUP || $scope.game_state == STATE_SPINMAX || $scope.game_state == STATE_SPINDOWN) {
    render_reel();
  }

}


//---- Logic Functions ---------------------------------------------

function set_stops(entropy) {
  var rnd = entropy;

  for (var i=0; i<reel_count; i++) {

    start_slowing[i] = false;

    var stop_index = rnd % reel_positions;
    rnd = Math.floor(rnd / reel_positions);

    stopping_position[i] = stop_index * symbol_size;

    stopping_position[i] += stopping_distance;
    if (stopping_position[i] >= reel_pixel_length) stopping_position[i] -= reel_pixel_length;

    // convenient here to remember the winning positions
    for (var j=0; j<row_count; j++) {
      result[i][j] = stop_index + j;
      if (result[i][j] >= reel_positions) result[i][j] -= reel_positions;

      // translate reel positions into symbol
      result[i][j] = reels[i][result[i][j]];
    }
  }
}

function move_reel(i) {
  reel_position[i] -= reel_speed[i];

  // wrap
  if (reel_position[i] < 0) {
    reel_position[i] += reel_pixel_length;
  }
}

// handle reels accelerating to full speed
function logic_spinup() {

  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // accelerate speed
    reel_speed[i] += spinup_acceleration;

  }

  // if reels at max speed, begin spindown
  if (reel_speed[0] == max_reel_speed) {


    $scope.game_state = STATE_SPINMAX;
  }
}

function logic_spinmax() {
  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);
  }
}

// handle reel movement as the reels are coming to rest
function logic_spindown() {

  // if reels finished moving, begin rewards
  if (reel_speed[reel_count-1] == 0) {

    var reward = game.calc_reward($scope.playing_lines, result);
    angular.forEach(reward.partial_payouts, function(value, key) {
        highlight_line(key);
    });

    if (reward.payout > 0) {
        sounds.playWin();
    }
    $scope.reward = reward;
    $scope.game_state = STATE_REWARD;
  }

  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // start slowing this reel?
    if (start_slowing[i] == false) {

      // if the first reel, or the previous reel is already slowing
      var check_position = false;
      if (i == 0) check_position = true;
      else if (start_slowing[i-1]) check_position = true;

      if (check_position) {

        if (reel_position[i] == stopping_position[i]) {
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
    $scope.game_state = STATE_REST;
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

  if ($scope.game_state == STATE_SPINUP) {
    logic_spinup();
  }
  else if ($scope.game_state == STATE_SPINMAX) {
    logic_spinmax();
  }
  else if ($scope.game_state == STATE_SPINDOWN) {
    logic_spindown();
  }
  else if ($scope.game_state == STATE_REWARD) {
    logic_reward();
  }

}


    //---- Input Functions ---------------------------------------------

    $scope.handleKey = function(evt) {
      if (evt.keyCode == 32) { // spacebar
        if ($scope.game_state == STATE_SPINMAX) {
            $scope.stop();
            return;
        };
        if ($scope.game_state != STATE_REST) return;

        if ($scope.credits >= 5) $scope.spin(5);
        else if ($scope.credits >= 3) $scope.spin(3);
        else if ($scope.credits >= 1) $scope.spin(1);

      }
    };

    $scope.spin = function(line_choice) {

      if ($scope.game_state != STATE_REST) return;
      if ($scope.credits < line_choice) return;

      $scope.credits -= line_choice;
      $scope.playing_lines = line_choice;

      $scope.reward.partial_payouts = {};
      $scope.generateEntropy();

      $scope.game_state = STATE_SPINUP;

    };

    $scope.generateEntropy = function() {
        $scope.entropy = Math.floor(Math.random() * Math.pow(32, 3));
    };

    $scope.stop = function() {
        if ($scope.game_state != STATE_SPINMAX) return;

        // calculate the final results now, so that spindown is ready
        set_stops($scope.entropy);
        $scope.game_state = STATE_SPINDOWN;
    };

    //---- Init Functions -----------------------------------------------

    $scope.init = function() {
      var can = document.getElementById("slots");
      ctx = can.getContext("2d");

      symbols.onload = function() {
        symbols_loaded = true;
        if (symbols_loaded && reels_bg_loaded) render_reel();
      };

      reels_bg.onload = function() {
        reels_bg_loaded = true;
        if (symbols_loaded && reels_bg_loaded) render_reel();
      };
    };

    $scope.init();

}]);
