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
