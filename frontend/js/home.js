"use strict";

var app = angular.module('homeController', []);

app.factory('localStorage', function() {
    return window.localStorage || {};
});

app.controller("HomeController", ['$location', '$scope', 'localStorage', function($location, $scope, localStorage) {

    $scope.address = localStorage['sleth:address'];

    $scope.play = function() {
        if ($scope.address.substring(0, 2) !== "0x") {
            $scope.address = "0x" + $scope.address;
        }

        localStorage['sleth:address'] = $scope.address;
        $location.path('/sleth/' + $scope.address);
    };

}]);
