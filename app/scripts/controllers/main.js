'use strict';

/**
 * @ngdoc function
 * @name skypathApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the skypathApp
 */
angular.module('skypathApp')
  .controller('MainCtrl',['$scope','$rootScope','leafletData','restService','mapTools', function ($scope,$rootScope,leafletData,restService,mapTools) {


    var kAltitude_Min = 10;
    var kAltitude_NumberOfSteps = 16;
    var kAltitude_Step = 2;
    var tilesByHeight = [];
    var turbulenceLayer; //holds the turbulence shown on map

    // Scope vars
    $scope.noOfTilesForAlt = 0;
    $scope.noOfTilesForAltAndTime = 0;
    $scope.noOfTotalTiles = 0;
    $scope.altitudeToDisplay = 11;
    $scope.currentAltitudeLabel = "";
    $scope.currentTimeSpan =6;

    //objects
    function Tile(tileX, tileY, severity, altitude, timestamp) {
      this.tileX = tileX;
      this.tileY = tileY;
      this.severity = severity;
      this.altitude = altitude;
      this.timestamp = timestamp;
    }

    //whatchs
    $scope.$watch('currentTimeSpan', function() {
      drawTurbulenceAtAlt($scope.altitudeToDisplay);
    });


    // functions
    var getTurbulenceFromServer = function() {
      restService.getTurbulence().then(function (res) {

        leafletData.getMap().then(function (map) {
          var allObjects = res.data.turbulence;

          $scope.noOfTotalTiles = allObjects.length;
          allObjects.forEach(function (entry) {
            var tmpTile = new Tile(entry.tileX, entry.tileY, entry.sev, entry.alt, entry.ts);
            if (tmpTile.altitude >= 1) {
              tilesByHeight[tmpTile.altitude - 1].push(tmpTile);
            }
          });
          //init view to altitude
          drawTurbulenceAtAlt($scope.altitudeToDisplay);
        });
      });
    };



    var drawTurbulenceAtAlt = function(alt) {
      leafletData.getMap().then(function (map) {

          //get tiles from array
          var turbulenceAtAlt = tilesByHeight[alt - 1];

          //update number to tiles
          $scope.noOfTilesForAlt = turbulenceAtAlt.length;

          //update current Altitude Label
          $scope.currentAltitudeLabel= ((alt-1)*kAltitude_Step + kAltitude_Min) +'-' + ((alt  )*kAltitude_Step + kAltitude_Min);
          //clear layer
          turbulenceLayer.clearLayers();

          //get current time
          var date = new Date();
          var currentTime = date.getTime()/1000;
          $scope.noOfTilesForAlt = turbulenceAtAlt.length;
          $scope.noOfTilesForAltAndTime=0;
          //add new turbulence tiles to layer
          turbulenceAtAlt.forEach(function (entry) {

            //check that the tile ts is inside currentTimeSpan
            var timeDifferance = $scope.currentTimeSpan*3600;
            if (currentTime - entry.timestamp <timeDifferance){

              var radiusInMeters = dist(mapTools.tile2lat(entry.tileY, 11), mapTools.tile2long(entry.tileX, 11), mapTools.tile2lat(entry.tileY, 11), mapTools.tile2long(entry.tileX + 1, 11)) / 2;
              var circle = L.circle([mapTools.tile2lat(entry.tileY + 0.5, 11), mapTools.tile2long(entry.tileX + 0.5, 11)], radiusInMeters, {
                color: mapTools.getColorBySeverity(entry.severity),
                fillColor: mapTools.getColorBySeverity(entry.severity),
                fillOpacity: 1.0,
                weight: 2
              }).addTo(turbulenceLayer);
              $scope.noOfTilesForAltAndTime +=1;
            }
          });
        }
      )};

    /*    helpers    */
    var dist = function(lat1,lon1,lat2,lon2) {
      var R = 6371000; // metres
      var φ1 = lat1* Math.PI / 180;
      var φ2 = lat2* Math.PI / 180;
      var Δφ = (lat2-lat1)* Math.PI / 180;
      var Δλ = (lon2-lon1)* Math.PI / 180;

      var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      var d = R * c;
      return d;
    }

    //////////////////  view operations ///////////////////////
    $scope.viewMethods = {
      goUP: function(){
          if ($scope.altitudeToDisplay<kAltitude_NumberOfSteps) {
            $scope.altitudeToDisplay +=1;

            drawTurbulenceAtAlt($scope.altitudeToDisplay);

          }
        },
      goDOWN: function(){
        if ($scope.altitudeToDisplay>1) {
          $scope.altitudeToDisplay -=1;

          drawTurbulenceAtAlt($scope.altitudeToDisplay);

        }
      }
    };
    //////////////////  Map init ///////////////////////

    $scope.center = {
      lat: $rootScope.latLng.lat,
      lng: $rootScope.latLng.lng,
      zoom: $rootScope.initialZoom -1
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
    leafletData.getMap().then(function (map) {
      turbulenceLayer = new L.FeatureGroup().addTo(map);
      //add scale to map
      L.control.scale().addTo(map);
    });

    //read data from server
    getTurbulenceFromServer ();
  }]);
