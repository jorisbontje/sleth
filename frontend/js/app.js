'use strict';

var app = angular.module('slethApp', ['homeController', 'slethController', 'ngRoute']);
app.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
    when('/', {
        templateUrl: 'templates/home.html',
        controller: 'HomeController',
    }).
    when('/sleth/:contractAddress', {
        templateUrl: 'templates/sleth.html',
        controller: 'SlethController',
    }).
    otherwise({redirectTo: '/'});
}]);
