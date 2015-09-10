'use strict';

/**
 * @ngdoc service
 * @name skypathApp.restService
 * @description
 * # restService
 * Service in the skypathApp.
 */
angular.module('skypathApp')
  .service('restService', ['$http', function($http) {
    var urlBase = 'http://104.197.5.131:3000';
    var dataFactory = {};

    var turbulenceUrlBase = urlBase + '/turbulence';

    dataFactory.getTurbulence = function () {
      return $http.get(turbulenceUrlBase);
    };


    return dataFactory;
  }]);
