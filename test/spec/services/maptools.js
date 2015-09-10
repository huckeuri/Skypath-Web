'use strict';

describe('Service: mapTools', function () {

  // load the service's module
  beforeEach(module('skypathApp'));

  // instantiate service
  var mapTools;
  beforeEach(inject(function (_mapTools_) {
    mapTools = _mapTools_;
  }));

  it('should do something', function () {
    expect(!!mapTools).toBe(true);
  });

});
