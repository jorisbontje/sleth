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

var app = angular.module('slots.sounds', []);

app.factory('sounds', function() {
    var snd_win = new Audio("sounds/win.wav");
    var snd_reel_stop = [];
    snd_reel_stop[0] = new Audio("sounds/reel_stop.wav");
    snd_reel_stop[1] = new Audio("sounds/reel_stop.wav");
    snd_reel_stop[2] = new Audio("sounds/reel_stop.wav");

    var sounds = {};

    sounds.playWin = function() {
        try {
            snd_win.currentTime = 0;
            snd_win.load();  // workaround for chrome currentTime bug
            snd_win.play();
        } catch(err) {
            console.error(err);
        }
    };

    sounds.playReelStop = function(i) {
        try {
            snd_reel_stop[i].currentTime = 0;
            snd_reel_stop[i].load();  // workaround for chrome currentTime bug
            snd_reel_stop[i].play();
        } catch(err) {
            console.error(err);
        }
    };

    return sounds;
});
