'use strict';

require('angular');
require('angular-route');

var app = angular.module('slethApp', ['homeController', 'slethController', 'ngRoute']);

var homeCtrl = require('home');

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
    when('/', {
        templateUrl: 'templates/home.html',
        controller: require('./home.js'),
    }).
    when('/sleth/:contractAddress', {
        templateUrl: 'templates/sleth.html',
        controller: 'SlethController',
    }).
    otherwise({redirectTo: '/'});
}]);
