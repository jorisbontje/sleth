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

var app = angular.module('slots.reels', []);

app.directive('slotsReels', ['$interval', 'config', 'game', function($interval, config, game) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var reel_area_left = 32;
            var reel_area_top = 32;
            var reel_area_width = 96;
            var reel_area_height = 96;

            var ctx = element[0].getContext("2d");

            var symbols_loaded = false;
            var reels_bg_loaded = false;

            // art
            var symbols = new Image();
            var reels_bg = new Image();

            symbols.src = "images/reddit_icons_small.png";
            reels_bg.src = "images/reels_bg.png";

            function draw_symbol(symbol_index, x, y) {
              var symbol_pixel = symbol_index * config.symbol_size;
              ctx.drawImage(symbols, 0,symbol_pixel,config.symbol_size,config.symbol_size, x+reel_area_left,y+reel_area_top,config.symbol_size,config.symbol_size);
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

              for (var i=0; i<config.reel_count; i++) {
                for (var j=0; j<config.row_count +1; j++) {

                  reel_index = Math.floor(scope.reel_position[i] / config.symbol_size) + j;
                  symbol_offset = scope.reel_position[i] % config.symbol_size;

                  // reel wrap
                  if (reel_index >= config.reel_positions) reel_index -= config.reel_positions;

                  // symbol lookup
                  symbol_index = game.reels[i][reel_index];

                  x = i * config.symbol_size;
                  y = j * config.symbol_size - symbol_offset;

                  draw_symbol(symbol_index, x, y);

                }
              }
            }
                        // render all art needed in the current frame
            function render() {
              if (scope.game_state == game.STATE_SPINUP || scope.game_state == game.STATE_SPINMAX || scope.game_state == game.STATE_SPINDOWN) {
                render_reel();
              }
            }

            function highlight_line(line_num) {
              ctx.strokeStyle = "orange";
              var ss = config.symbol_size;

              // top row
              if (line_num == 2 || line_num == 4) {
                ctx.strokeRect(reel_area_left, reel_area_top, config.symbol_size-1, config.symbol_size-1); // top left
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

            scope.$watch('highlights', function() {
                scope.highlights.forEach(highlight_line);
            });

            $interval(function() {
                render();
            }, 1000 / config.FPS);

            scope.init = function() {
              symbols.onload = function() {
                symbols_loaded = true;
                if (symbols_loaded && reels_bg_loaded) render_reel();
              };

              reels_bg.onload = function() {
                reels_bg_loaded = true;
                if (symbols_loaded && reels_bg_loaded) render_reel();
              };
            };

            scope.init();
        }
    };
}]);
