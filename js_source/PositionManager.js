var AbstractPosition = require('./AbstractPosition.js');
var LatLonSystemMapper = require('./LatLonSystemMapper.js');
var IrishGridPosition = require('./IrishGridPosition.js');

class PositionManager {

  constructor() {
    this.currentPosition = null;
    this.coordinateSystem = null;
    this.newPositionCallback = null;
  }

  setCoordinateSystem(system) {
    if (system != null && system == this.coordinateSystem) {
      return;
    }
    
    if (system == "Irish") {
      this.coordinateSystem = system;
      this.currentPosition = new IrishGridPosition({});
    } else if (system == "UK") {
      this.coordinateSystem = system;
    //  this.currentPosition = new UKGridPosition();
    } else {
      console.log("Invalid coordinate system specified: "+system);
    }
  }

  setNewPositionCallback(f) {
    this.newPositionCallback = f;
  }

  updatePosition(pos) {
    this.currentPosition.setPositionFromGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.timestamp);
    this.currentPosition.setElevation(pos.coords.altitude, pos.coords.altitudeAccuracy, pos.coords.speed);
    this.newPositionCallback(this.currentPosition);
  }

}


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
   module.exports = PositionManager;
}
