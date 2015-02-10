(function() {

'use strict';
angular
.module('homeController', [])
.factory('localStorage', function() {
    return window.localStorage;
})
.controller("HomeController", ['$location', '$scope', 'localStorage', function($location, $scope, localStorage) {

    $scope.address = localStorage['sleth:address'];

    $scope.play = function() {
        if ($scope.address.substring(0, 2) !== "0x") {
            $scope.address = "0x" + $scope.address;
        }

        localStorage['sleth:address'] = $scope.address;
        $location.path('/sleth/' + $scope.address);
    };

}]);

})();
