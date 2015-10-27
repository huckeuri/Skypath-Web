'use strict';

/**
 * @ngdoc function
 * @name skypathApp.controller:IndexCtrl
 * @description
 * # IndexCtrl
 * Controller of the skypathApp
 */
angular.module('skypathApp')
  .controller('IndexCtrl', ['$scope', 'restService', function($scope, restService) {

    $scope.userName = '';
    $scope.password = '';
    $scope.loginInProgress = false;
    $scope.serverOperationInProgress = false;
    $scope.loginMessage = '';
    $scope.loginButtonText = 'Log-in';
    $scope.loggedIn = false;
    $scope.activateRawDataFiltering = false;

    $scope.viewMethods = {

      login: function() {
        $scope.loginInProgress = true;
        $scope.loginMessage = '';
        restService.login($scope.username, $scope.password).then(function(success) {
          $scope.loginInProgress = false;
          $scope.loginMessage = success.data.message;
          $scope.loginButtonText = 'Log-out';
          $scope.loggedIn = true;
          angular.element($('#btnCloseLogin')).click();
          $scope.loginMessage = ''
          $scope.username = '';
          $scope.password = '';
        }, function(reason) { //failure
          console.log(reason.data.message);
          $scope.loginInProgress = false;
          $scope.loginMessage = reason.data.message;
          $scope.loginButtonText = 'Log-in';
          $scope.loggedIn = false;
        });
      },
      logout: function() {
        console.log('logout::logout clicked');
        if ($scope.loggedIn === true) {
          console.log('logout::preforming logout');
          restService.logout();
          $scope.loginButtonText = 'Log-in';
          $scope.loggedIn = false;
          $scope.loginInProgress = false;
          $scope.activateRawDataFiltering = false;
        }
      }
    }
  }]);
