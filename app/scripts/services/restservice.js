'use strict';

/**
 * @ngdoc service
 * @name skypathApp.restService
 * @description
 * # restService
 * Service in the skypathApp.
 */
var skypathAppModule = angular.module('skypathApp');
var token;


skypathAppModule.config(function($httpProvider) {
  $httpProvider.interceptors.push(function($q) {
    return {
      'request': function(config) {
        $httpProvider.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
        //$httpProvider.defaults.headers.common["Access-Control-Allow-Origin"] = '*';
        //$httpProvider.defaults.withCredentials = true;
        if (token !== undefined) {
          // $httpProvider.defaults.headers.get = {
          //   'x-access-token': token
          // };
          // config.headers['x-access-token'] = token;
          // config.headers['Content-Type'] = "application/json";
          // console.log('headers object:');
          // console.log(config.headers);
        }
        return config;
      },

      'response': function(res) {
        return res;
      },
      'responseError': function(res) {
        console.log(res);
        // if (res.status === 401) {
        //   console.log('interceptors unauthorized response');
        //   //$rootScope.$broadcast('unauthorized');
        // }
        return res;
      }
    };
  });
})


skypathAppModule.service('restService', ['$http', '$q', function($http, $q) {
  var urlBase = 'http://104.197.5.131:3000';
  //var urlBase = 'http://localhost:3000';
  var dataFactory = {};

  var turbulenceUrlBase = urlBase + '/turbulence';




  dataFactory.getTurbulence = function() {
    //get only the last 504 hours of data.
    return $http.get(turbulenceUrlBase + '/bytime?timespan=504');
  };

  //this method gets reports that needs a valid token to the server.
  //so it return a promise of the login and only when the login finishes it continues to get the information with the token received.
  dataFactory.getReportByIdAndFNum = function(empId, fNum) {
    // return loginPromise.then(function(result) {
    //token = 'eyJhbGciOiJIUzI1NiJ9.ZTA5ODI4OA.MRvUck0-xiO5EDfPZ-J-SWCE_tzlCGPP9O9JhcuL1Gk';
    if (token !== undefined) {
      console.log('token has value');
      if (fNum === undefined) fNum = '';
      if (empId === undefined) return;
      return $http.get(urlBase + '/reports/filtered?empId=' + empId + '&fNum=' + fNum, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'x-access-token': token
        }
      });
    } {
      console.log('token is not defined...')
    }
    // })
  }



  dataFactory.logout = function() {
    token = undefined;
    console.log('dataFactory.logout::token now is ' + token);
  }


  dataFactory.login = function(uName, pwd) {
    console.log('Trying to login')
    console.log('username:' + uName + ', pwd:' + pwd)
    var deferred = $q.defer();
    $http.post(urlBase + '/login', 'username=' + uName + '&password=' + pwd).then(function(result) {
      if (result.data.success) {
        token = result.data.token;
        deferred.resolve(result);
      } else {
        token = '';
        deferred.reject(result);
      }
    })
    return deferred.promise;
  }

  return dataFactory;
}]);
