'use strict';

/**
 * @ngdoc service
 * @name skypathApp.mapTools
 * @description
 * # mapTools
 * Service in the skypathApp.
 */
angular.module('skypathApp')
  .service('mapTools', function () {

    var factory = {};

    /*tile conversion */
    factory.tile2long = function (x,z) {
      return (x/Math.pow(2,z)*360-180);
    }
    factory.tile2lat = function (y,z) {
      var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
      return (180/Math.PI*Math.atan((Math.exp(n)-Math.exp(-n))/2));
      //return (180/Math.PI*Math.atan(Math.sinh(n)));
    }


    /*color conversion */
    factory.getColorBySeverity = function (severity){
      switch(severity) {
        case 0:
          return 'white'
          break;
        case 1:
          return 'green'
          break;
        case 2:
          return 'blue'
          break;
        case 3:
          return 'yellow'
          break;
        case 4:
          return 'red'
          break;
        case 5:
          return 'black'
          break;
        default:
          return 'white'
      }

    }


    return factory;
  });
