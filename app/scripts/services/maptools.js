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

    factory.long2tile=function (lon,zoom) { 
      return (Math.floor((lon+180)/360*Math.pow(2,zoom))); 
    }

   factory.lat2tile=  function (lat,zoom) { 
    return (
      Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); 
  }


    /*color conversion */
    factory.getColorBySeverity = function (severity){
      switch(severity) {
        case 0:
          return 'white'
          break;
        case 1:
          return '#0EFF00'//light green
          break;
        case 2:
          return '#F2FF0C'
          break;
        case 3:
          return '#FFA600'
          break;
        case 4:
          return '#FA0000'
          break;
        case 5:
          return '#FF00C3'
          break;
        default:
          return 'white'
      }
      // switch(severity) {
      //   case 0:
      //     return 'white'
      //     break;
      //   case 1:
      //     return '#CCFFCC'//light green
      //     break;
      //   case 2:
      //     return '#CCFF99'
      //     break;
      //   case 3:
      //     return '#FFFF99'
      //     break;
      //   case 4:
      //     return '#FFB266'
      //     break;
      //   case 5:
      //     return '#FF3333'
      //     break;
      //   default:
      //     return 'white'
      // }

    }


    return factory;
  });
