'use strict';

/**
 * @ngdoc overview
 * @name skypathApp
 * @description
 * # skypathApp
 *
 * Main module of the application.
 */
angular
  .module('skypathApp', [
    'ngAnimate',
    'ngCookies',
    'ngMessages',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch',
    'leaflet-directive',
    'ui.bootstrap-slider'
  ])
  .config(["$routeProvider", function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        controllerAs: 'main'
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl',
        controllerAs: 'about'
      })
      .otherwise({
        redirectTo: '/'
      });
  }])
  .run(["$rootScope", function($rootScope) {
    $rootScope.latLng = {
      lat: 32.8,
      lng: 34.5
    };
    $rootScope.initialZoom = 6;


    

  }]);;

'use strict';

/**
 * @ngdoc function
 * @name skypathApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the skypathApp
 */
angular.module('skypathApp')
  .controller('MainCtrl', ['$q', '$scope', '$rootScope', '$filter', '$window', 'leafletData', 'restService', 'mapTools', function($q, $scope, $rootScope, $filter, $window, leafletData, restService, mapTools) {



    var kAltitude_Min = 10;
    var kAltitude_NumberOfSteps = 16;
    var kAltitude_Step = 2;
    var tilesByHeight = [];
    var tilesAtAllLevels = [];
    var tilesReportAtSamePosition = [];
    var turbulenceLayer; //holds the turbulence shown on map
    var rawReportsLayer; //holds the raw data erports shown on map
    //hold the current update time of the server
    var serverLastUpdateTime;

    // Scope vars
    $scope.noOfTilesForAlt = 0;
    $scope.noOfTilesForAltAndTime = 0;
    $scope.noOfTotalTiles = 0;
    $scope.altitudeToDisplay = 11;
    $scope.currentAltitudeLabel = "";
    $scope.currentTimeSpan = 6;
    $scope.altUpDownCollapsed = false;
    $scope.noOfTilesAtTimespan = 0;
    $scope.displayAllAltitude = false;
    $scope.selectedUITab = 1;


    //Filtering reports
    $scope.emplyeeIdFilterFromServer = '';
    $scope.flightNumberFilterFromServer;
    $scope.tileReports = [];
    $scope.tileDataExpanded = false;

    //width of col (left bar and the map)
    $scope.mapColWidth = 10;
    $scope.sideBarColWidth = 2;

    //objects
    function Tile(tileX, tileY, severity, altitude, timestamp, empId, fNum) {
      this.tileX = tileX;
      this.tileY = tileY;
      this.severity = severity;
      this.altitude = altitude;
      this.timestamp = timestamp;
      this.empId = empId;
      this.fNum = fNum;
    }

    //whatchs
    $scope.$watch('currentTimeSpan', function() {
      if ($scope.displayAllAltitude) {
        //currently do nothing because we use the on mouse-up event on the slider to avoid lagging
      } else {
        drawTurbulenceAtAlt($scope.altitudeToDisplay);
      }
    });


    $scope.$watch('activateRawDataFiltering', function() {
      if (turbulenceLayer !== undefined) {
        turbulenceLayer.clearLayers();
      }
      if (rawReportsLayer !== undefined) {
        rawReportsLayer.clearLayers();
      }
      if ($scope.activateRawDataFiltering) {
        $scope.mapColWidth = 8;
        $scope.sideBarColWidth = 4;
      } else {
        $scope.mapColWidth = 10;
        $scope.sideBarColWidth = 2;
      }
      resizeScreenAdjustments();
    });
    //End watches


    //functions
    var getUserRerportFromServer = function(emplyeeIdFilterFromServer, flightNumberFilterFromServer) {
      console.log('calling getReportByIdAndFNum with ' + emplyeeIdFilterFromServer + ', ' + flightNumberFilterFromServer);
      tilesReportAtSamePosition = [];
      var deferred = $q.defer();
      $scope.serverOperationInProgress = true;
      restService.getReportByIdAndFNum(emplyeeIdFilterFromServer, flightNumberFilterFromServer).then(function(result) {
        if (result.status !== 500 && result.data !== undefined) {
          result.data.forEach(function(entry) {
            var tmpTile = new Tile(entry.tileX, entry.tileY, entry.sev, entry.alt, entry.ts, entry.repId, entry.fNum);
            if (tmpTile.altitude >= 1) {
              var tileKey = tmpTile.tileX + '|' + tmpTile.tileY;
              if (!tilesReportAtSamePosition.hasOwnProperty(tileKey)) {
                tilesReportAtSamePosition[tileKey] = [];
              }
              tilesReportAtSamePosition[tileKey].push(tmpTile);
            }
            $scope.serverOperationInProgress = false;

          })
        } else {
          console.log('Somthing went wrong.');
          $scope.serverOperationInProgress = false;
          //NEED to notify on the UI!!! 
        }
        deferred.resolve(result);
      });
      return deferred.promise;
    }


    //Go over the reports from the server:
    //  for each tile in the reports (which is an array of reports for that tile), sort it and find the most severe. 
    //  that is the one to set as the color for that tile
    var drawRawDataTurbulence = function(report) {
      leafletData.getMap().then(function(map) {
        turbulenceLayer.clearLayers();
        rawReportsLayer.clearLayers();
        var mostSevereTile = {};
        //all reports received
        for (var k in tilesReportAtSamePosition) {
          if (tilesReportAtSamePosition.hasOwnProperty(k)) {
            var tileArray = tilesReportAtSamePosition[k];
            mostSevereTile = {};
            //sort tile reports by time
            tileArray.sort(function(a, b) {
                return a.timestamp - b.timestamp;
              })
              //loop through tiles and set the worst value of each tile events
            for (var i = tileArray.length - 1; i >= 0; i--) {
              var entry = tileArray[i];
              if (mostSevereTile.severity !== undefined) {
                if (mostSevereTile.severity < entry.severity) {
                  mostSevereTile = entry;
                }
              } else {
                mostSevereTile = entry;
              }
            };
            var radiusInMeters = dist(mapTools.tile2lat(mostSevereTile.tileY, 11), mapTools.tile2long(mostSevereTile.tileX, 11), mapTools.tile2lat(mostSevereTile.tileY, 11), mapTools.tile2long(mostSevereTile.tileX + 1, 11)) / 2;
            var circle = L.circle([mapTools.tile2lat(mostSevereTile.tileY + 0.5, 11), mapTools.tile2long(mostSevereTile.tileX + 0.5, 11)], radiusInMeters, {
              color: mapTools.getColorBySeverity(mostSevereTile.severity),
              fillColor: mapTools.getColorBySeverity(mostSevereTile.severity),
              fillOpacity: 1.0,
              weight: 2,
            }).addTo(rawReportsLayer);
          }
        }
      });
    }
    var getTurbulenceFromServer = function() {
      $scope.serverOperationInProgress = true;
      restService.getTurbulence().then(function(res) {
        var allObjects = res.data.turbulence;

        $scope.noOfTotalTiles = allObjects.length;
        allObjects.forEach(function(entry) {
          var tmpTile = new Tile(entry.tileX, entry.tileY, entry.sev, entry.alt, entry.ts);
          if (tmpTile.altitude >= 1) {
            tilesByHeight[tmpTile.altitude - 1].push(tmpTile);
            var tileKey = tmpTile.tileX + '|' + tmpTile.tileY;
            if (!tilesAtAllLevels.hasOwnProperty(tileKey)) {
              tilesAtAllLevels[tileKey] = tmpTile;
            } else {
              //console.log('tile:' + tileKey + 'current:'+tilesAtAllLevels[tileKey].timestamp+', new:'+tmpTile.timestamp);
              if (tilesAtAllLevels[tileKey].timestamp < tmpTile.timestamp) {
                //console.log('tile:' + tileKey + ' already exists with newer timestamp therefore added instead');
                tilesAtAllLevels[tileKey] = tmpTile
              }
            }
          }
        });
        //init view to altitude
        drawTurbulenceAtAlt($scope.altitudeToDisplay);
        $scope.serverOperationInProgress = false;
      });

    };

    var drawTurbulenceAtAllLevels = function() {
      turbulenceLayer.clearLayers();
      $scope.noOfTilesAtTimespan = 0;
      //get current time
      var date = new Date();
      var currentTime = date.getTime() / 1000;
      $scope.noOfTilesForAltAndTime = 0;
      console.log('currentTime:' + currentTime);
      leafletData.getMap().then(function(map) {
        var timeDifferance = $scope.currentTimeSpan * 3600;
        console.log('timeDifferance:' + timeDifferance);
        Object.keys(tilesAtAllLevels).forEach(function(entry) {
          //Get the tile from the Array according to the key (entry).
          var tmpTileFromArray = tilesAtAllLevels[entry];
          //check that the tile ts is inside currentTimeSpan
          if (currentTime - tmpTileFromArray.timestamp <= timeDifferance) {
            var radiusInMeters = dist(mapTools.tile2lat(tmpTileFromArray.tileY, 11), mapTools.tile2long(tmpTileFromArray.tileX, 11), mapTools.tile2lat(tmpTileFromArray.tileY, 11), mapTools.tile2long(tmpTileFromArray.tileX + 1, 11)) / 2;
            var circle = L.circle([mapTools.tile2lat(tmpTileFromArray.tileY + 0.5, 11), mapTools.tile2long(tmpTileFromArray.tileX + 0.5, 11)], radiusInMeters, {
              color: mapTools.getColorBySeverity(tmpTileFromArray.severity),
              fillColor: mapTools.getColorBySeverity(tmpTileFromArray.severity),
              fillOpacity: 1.0,
              weight: 2,
            }).addTo(turbulenceLayer);
            $scope.noOfTilesAtTimespan += 1;
          }
        });
        date = new Date();
        var finishTime = date.getTime() / 1000;
        console.log('drawTurbulenceAtAllLevels finished:' + (finishTime - currentTime) + ', noOfTilesAtTimespan:' + $scope.noOfTilesAtTimespan);
      });
    };


    var drawTurbulenceAtAlt = function(alt) {
      leafletData.getMap().then(function(map) {

        //get tiles from array
        var turbulenceAtAlt = tilesByHeight[alt - 1];

        //update number to tiles
        $scope.noOfTilesForAlt = turbulenceAtAlt.length;

        //update current Altitude Label
        $scope.currentAltitudeLabel = ((alt - 1) * kAltitude_Step + kAltitude_Min) + '-' + ((alt) * kAltitude_Step + kAltitude_Min);
        //clear layer
        turbulenceLayer.clearLayers();

        //get current time
        var date = new Date();
        var currentTime = date.getTime() / 1000;
        $scope.noOfTilesForAlt = turbulenceAtAlt.length;
        $scope.noOfTilesForAltAndTime = 0;
        //add new turbulence tiles to layer
        turbulenceAtAlt.forEach(function(entry) {

          //check that the tile ts is inside currentTimeSpan
          var timeDifferance = $scope.currentTimeSpan * 3600;
          if (currentTime - entry.timestamp < timeDifferance) {

            var radiusInMeters = dist(mapTools.tile2lat(entry.tileY, 11), mapTools.tile2long(entry.tileX, 11), mapTools.tile2lat(entry.tileY, 11), mapTools.tile2long(entry.tileX + 1, 11)) / 2;
            var circle = L.circle([mapTools.tile2lat(entry.tileY + 0.5, 11), mapTools.tile2long(entry.tileX + 0.5, 11)], radiusInMeters, {
              color: mapTools.getColorBySeverity(entry.severity),
              fillColor: mapTools.getColorBySeverity(entry.severity),
              fillOpacity: 1.0,
              weight: 2,
            }).addTo(turbulenceLayer);
            $scope.noOfTilesForAltAndTime += 1;
          }
        });
        date = new Date();
        var finishTime = date.getTime() / 1000;
        console.log('drawTurbulenceAtAlt finished:' + (finishTime - currentTime));

      })
    };

    /*    helpers    */
    var dist = function(lat1, lon1, lat2, lon2) {
        var R = 6371000; // metres
        var φ1 = lat1 * Math.PI / 180;
        var φ2 = lat2 * Math.PI / 180;
        var Δφ = (lat2 - lat1) * Math.PI / 180;
        var Δλ = (lon2 - lon1) * Math.PI / 180;

        var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        var d = R * c;
        return d;
      }
      //////////////////  view operations ///////////////////////
    $scope.viewMethods = {


      reportFilter: function() {

        $scope.tileReports = [];
        if ($scope.emplyeeIdFilterFromServer === {} && $scope.emplyeeIdFilterFromServer === undefined) return;
        getUserRerportFromServer($scope.emplyeeIdFilterFromServer, $scope.flightNumberFilterFromServer).then(function(result) {
          drawRawDataTurbulence(result.data)
        })
      },
      goUP: function() {
        if ($scope.altitudeToDisplay < kAltitude_NumberOfSteps) {
          $scope.altitudeToDisplay += 1;
          drawTurbulenceAtAlt($scope.altitudeToDisplay);
        }
      },
      goDOWN: function() {
        if ($scope.altitudeToDisplay > 1) {
          $scope.altitudeToDisplay -= 1;
          drawTurbulenceAtAlt($scope.altitudeToDisplay);
        }
      },
      sliderMouseReleased: function() {
        drawTurbulenceAtAllLevels();
      },
      setDisplayAllTiles: function() {
        $scope.displayAllAltitude = true;
        drawTurbulenceAtAllLevels();
      },
      setDisplayTilesByAltAndTime: function() {
        $scope.displayAllAltitude = false;
        drawTurbulenceAtAlt($scope.altitudeToDisplay);
      }
    };
    //////////////////  Map init ///////////////////////

    $scope.center = {
      lat: $rootScope.latLng.lat,
      lng: $rootScope.latLng.lng,
      zoom: $rootScope.initialZoom - 1
    };
    $scope.layers = {
      baselayers: {
        grayscale: {
          name: 'Grayscale',
          url: 'https://api.mapbox.com/v4/mapbox.light/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoieml2bGV2eSIsImEiOiJwaEpQeUNRIn0.OZupy_Vjyl5eRCRlgV6otg',
          type: 'xyz',
          layerOptions: {}
        },
        OpenStreetMap: {
          name: 'Open Streen Map',
          url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
          type: 'xyz',
          layerOptions: {}
        },
        satellite: {
          name: 'Satellite',
          url: 'https://api.mapbox.com/v4/mapbox.light/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoieml2bGV2eSIsImEiOiJwaEpQeUNRIn0.OZupy_Vjyl5eRCRlgV6otg',
          type: 'xyz',
          layerOptions: {}
        }
      },

      overlays: {}
    };


    $scope.controls = {

    };

    //////////////////////////// main /////////////////////////
    //set array for each altitude level
    for (var i = 0; i < kAltitude_NumberOfSteps; i++) {
      tilesByHeight.push([]);
    }

    //init map
    leafletData.getMap().then(function(map) {
      turbulenceLayer = new L.FeatureGroup().addTo(map);
      rawReportsLayer = new L.FeatureGroup().addTo(map);
      //////
      // handles an event of clicking on a tile.
      // The function locates the tile and if found, creates a popup with the time it was created in the system.
      // It needs to know what type of tile is clicked - one that is an aggregation of several altitudes or one that is 'regular'.
      //////
      function turbulenceLayerClick(e) {


        var tileX = mapTools.long2tile(e.latlng.lng, 11);
        var tileY = mapTools.lat2tile(e.latlng.lat, 11);
        var tsValue = '';
        if ($scope.displayAllAltitude) { // Create the popup for tiles shown for all altitudes.
          //create the key for the tile. 
          //it will be used to find the tile in the general list (in O(1) instead of looking for it at all altitudes)
          var tileKey = tileX + '|' + tileY;
          var clickedTile = tilesAtAllLevels[tileKey];
          var localDate = new Date(clickedTile.timestamp * 1000);
          //translate the date to UTC. when the tile timestamp is used to create the date it shifts the date to local time....
          var utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
          tsValue = $filter('date')(utcDate, 'dd/MM HH:mm') + ' GMT';
        } else { // Create the popup for tiles shown for a certain altitude
          for (var i = tilesByHeight[$scope.altitudeToDisplay - 1].length - 1; i >= 0; i--) {
            var clickedTile = tilesByHeight[$scope.altitudeToDisplay - 1][i];

            //console.log('tile: X=' + clickedTile.tileX + ', Y=' + clickedTile.tileY);
            if (clickedTile.tileX === tileX && tileY === clickedTile.tileY) {
              var localDate = new Date(clickedTile.timestamp * 1000);
              //translate the date to UTC. when the tile timestamp is used to create the date it shifts the date to local time....
              var utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
              tsValue = $filter('date')(utcDate, 'dd/MM HH:mm') + ' GMT';
              break;
            }
          };
        }
        if (tsValue) {

          var popup = L.popup({
            className: 'popup-background' + clickedTile.severity
          });
          popup
            .setLatLng(e.latlng)
            .setContent("Created at " + tsValue)
            .openOn(map);
        }
      }
      /////////////
      ///// This gets the list of events on each tile that the mouse is placed over.
      ///// The tiles 'trail' of values is already sorted by timestamp.
      ////////////
      function rawReportsLayerOnClick(e) {
        //console.log(e);
        //Get the tile coordinates
        var tileX = mapTools.long2tile(e.latlng.lng, 11);
        var tileY = mapTools.lat2tile(e.latlng.lat, 11);
        var tsValue = '';
        //create the key for the tile. 
        //it will be used to find the tile in the general list (in O(1) instead of looking for it at all altitudes)
        var tileKey = tileX + '|' + tileY;
        var mouseClickedTile = tilesReportAtSamePosition[tileKey];
        //console.log(mouseClickedTile);
        if (mouseClickedTile === undefined) {
          $scope.tileDataExpanded = false;
          return;
        }
        $scope.tileDataExpanded = true;
        for (var i = mouseClickedTile.length - 1; i >= 0; i--) {
          var localDate = new Date(mouseClickedTile[i].timestamp * 1000);
          //translate the date to UTC. when the tile timestamp is used to create the date it shifts the date to local time....
          var utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
          tsValue = $filter('date')(utcDate, 'dd/MM HH:mm:ss');
          mouseClickedTile[i].humenTime = tsValue;
          mouseClickedTile[i].alt = mouseClickedTile[i].altitude * 2 + 10;
        };
        $scope.tileReports = mouseClickedTile;
        // var localDate = new Date(clickedTile.timestamp * 1000);
        // //translate the date to UTC. when the tile timestamp is used to create the date it shifts the date to local time....
        // var utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
        // tsValue = $filter('date')(utcDate, 'dd/MM HH:mm') + ' GMT';
        // var popup = L.popup({
        //   className: 'popup-background' + clickedTile.severity
        // });

        // popup
        //   .setLatLng(e.latlng)
        //   .setContent("Created at " + tsValue)
        //   .openOn(map);

      }
      //register a click event on the turbulenceLayer so that we can show a popup
      turbulenceLayer.on('click', turbulenceLayerClick);
      rawReportsLayer.on('click', rawReportsLayerOnClick)
        //add scale to map
      L.control.scale().addTo(map);
    });



    //read data from server
    getTurbulenceFromServer();

    //This makes the map 80% of size of the div.
    angular.element($window).on("resize", resizeScreenAdjustments).trigger("resize");

    function resizeScreenAdjustments() {
      var mapWidthPercentage = .81;
      if ($scope.activateRawDataFiltering) {
        mapWidthPercentage = .65
      }
      console.log('adjusting screen size, mapWidthPercentage:' + mapWidthPercentage)
      $('[name="leafletCtrl"]').height(angular.element($window).height() * .78).width(angular.element($window).width() * mapWidthPercentage);
      leafletData.getMap().then(function(map) {
        map.invalidateSize();
      });
    }
  }]);

'use strict';

/**
 * @ngdoc function
 * @name skypathApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the skypathApp
 */
angular.module('skypathApp')
  .controller('AboutCtrl', function () {

  });

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


skypathAppModule.config(["$httpProvider", function($httpProvider) {
  $httpProvider.interceptors.push(["$q", function($q) {
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
  }]);
}])


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

angular.module('skypathApp').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('views/about.html',
    "<div class=\"row\"> <br> </div> <div class=\"row\"> <div class=\"jumbotron aboutPage\"> <h1>Skypath</h1> <p>The turbulence hunter !</p> <p>&copy 2015</p> </div> </div>"
  );


  $templateCache.put('views/main.html',
    "<section> <div class=\"container text-center\" ng-show=\"serverOperationInProgress\"> <button class=\"btn btn-xs btn-warning\"><span class=\"glyphicon glyphicon-refresh glyphicon-refresh-animate\"></span> Loading...</button> </div> <div class=\"form-group\"> <div class=\"col-xs-{{sideBarColWidth}}\"> <br> <div class=\"form-group\" style=\"border-radius: 5px\" ng-show=\"activateRawDataFiltering\"> <div class=\"panel panel-primary\"> <pre class=\"panel-heading\">Data filtering</pre> <div class=\"panel-body\"> <input class=\"form-group\" placeholder=\"Employee Id (e.g e098288)\" ng-model=\"emplyeeIdFilterFromServer\"> <input class=\"form-group\" placeholder=\"Flight #\" ng-model=\"flightNumberFilterFromServer\"> <div> <button class=\"btn btn-success\" ng-click=\"viewMethods.reportFilter()\">filter</button> <!-- <span ng-show='serverOperationInProgress' name=\"spinner3\" img-src=\"../spinner.gif\" class=\"ng-isolate-scope\">  \n" +
    "            <img height='30' ng-show=\"true\" src=\"../spinner.gif\">  \n" +
    "            </span> --> </div> </div> </div> </div> <div class=\"panel panel-default\" ng-show=\"tileDataExpanded && activateRawDataFiltering\" style=\"height: 380px !important;overflow: scroll\"> <div class=\"panel-heading\"><b>Tile: {{tileReports[0].tileX}},{{tileReports[0].tileY}}</b></div> <table class=\"table table-bordered\"> <thead> <tr> <th>#</th> <th>Time</th> <th>Alt.</th> <!-- <input  ng-model='flightNumberFilter'> --> <th>Sev.</th> <th>Flight #</th> <!-- <th>\n" +
    "                <input ng-model='flightNumberFilter'>\n" +
    "              </th> --> <th class=\"col-xs-2\">empId.</th> </tr> </thead> <tbody> <tr ng-repeat=\"tileReport in tileReports | filter:flightNumberFilter | orderBy:'-timestamp'\"> <td class=\"col-xs-2\">{{$index}}</td> <td class=\"col-xs-2\">{{tileReport.humenTime}}</td> <td class=\"col-xs-2\">{{tileReport.alt}}</td> <td class=\"col-xs-2\">{{tileReport.severity}}</td> <td class=\"col-xs-2\">{{tileReport.fNum}}</td> <td class=\"col-xs-2\">{{tileReport.empId}}</td> </tr> </tbody> </table> </div> <div class=\"form-group\" ng-show=\"!activateRawDataFiltering\" style=\"background-color:#002000; border-radius: 5px\"> <ul class=\"nav nav-pills\"> <li ng-class=\"{active: selectedUITab===1}\"> <a href style=\"font-size:small\" ng-click=\"viewMethods.setDisplayTilesByAltAndTime();selectedUITab=1\">Filter by Alt.</a></li> <li ng-class=\"{active: selectedUITab===2}\"><a href style=\"font-size:small\" ng-click=\"viewMethods.setDisplayAllTiles();selectedUITab=2\">Show all Alt.</a></li> </ul> <div ng-show=\"selectedUITab===1\" style=\"padding: 15px\"> <button class=\"btn btn-info btn-block\" type=\"button\" ng-click=\"viewMethods.goUP()\">Up </button> <pre style=\"margin-bottom: 0;color:#000000\" class=\"text-center\">{{currentAltitudeLabel}}</pre> <button class=\"btn btn-primary btn-block\" type=\"button\" ng-click=\"viewMethods.goDOWN()\">Down </button> <br> <br> <!-- time controls--> <label style=\"color:#C0C0C0\">History</label> <pre style=\"color:#000000\" class=\"text-center\">Last {{currentTimeSpan}} hours</pre> <slider ng-model=\"currentTimeSpan\" min=\"6\" step=\"6\" max=\"504\"></slider> <br> <label style=\"color:#C0C0C0\">Events at Alt. / time</label> <pre class=\"text-center\">{{noOfTilesForAltAndTime}} / {{noOfTilesForAlt}} events</pre> <br> <br> <label style=\"color:#C0C0C0\">Total events</label> <pre class=\"text-center\" style=\"color:#000000\">{{noOfTotalTiles}} events</pre> </div> <div ng-show=\"selectedUITab===2\" id=\"all\" style=\"padding: 15px\"> <!-- time controls--> <label style=\"color:#C0C0C0\">History</label> <pre style=\"color:#000000\" class=\"text-center\">Last {{currentTimeSpan}} hours</pre> <slider ng-model=\"currentTimeSpan\" ng-mouseup=\"viewMethods.sliderMouseReleased()\" min=\"6\" step=\"6\" max=\"504\"></slider> <br> <label style=\"color:#C0C0C0\">Events at timespan</label> <pre class=\"text-center\">{{noOfTilesAtTimespan}}</pre> <br> <br> <label style=\"color:#C0C0C0\">Total events</label> <pre class=\"text-center\" style=\"color:#000000\">{{noOfTotalTiles}} events</pre> </div> </div> </div> <div class=\"col-xs-{{mapColWidth}}\"> <leaflet name=\"leafletCtrl\" style=\"border-style: solid\" center=\"center\" layers=\"layers\" controls class=\"mainmap\"></leaflet> </div> </div> </section>"
  );

}]);
