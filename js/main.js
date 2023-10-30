var LatLonSystemMapper = require('./LatLonSystemMapper.js');
var AbstractPosition = require('./AbstractPosition.js');
var IrishGridPosition = require('./IrishGridPosition.js');
var UKGridPosition = require('./UKGridPosition.js');
var PositionManager = require('./PositionManager.js');

module.exports = {
  IrishGridPosition: IrishGridPosition,
  UKGridPosition: UKGridPosition,
  PositionManager: PositionManager
//  AbstractPosition: AbstractPosition,
//  LatLonSystemMapper: LatLonSystemMapper
};

/*
class MyCoords {
  constructor() {
    this.latitude = 54.683033;
    this.longitude = -5.893674;
    this.elevation = 10;
    this.accuracy = 10;
  }
}


class MyPos {
  constructor() {
    this.coords = new MyCoords();
    this.timestamp = '1233456';
  }

}


var pm = new PositionManager();
pm.setCoordinateSystem("Irish");
pm.setNewPositionCallback(
  function(p) {
    console.log(p.gridReference());
  }
);
pm.updatePosition(new MyPos());


*/
