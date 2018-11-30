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
    console.log("Trying to call it");
    this.currentPosition.setPositionFromGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    // TODO - this is not the correct accuracy used here
    this.currentPosition.setElevation(pos.coords.elevation, pos.coords.accuracy);
    this.newPositionCallback(this.currentPosition);
  }

}


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
   module.exports = PositionManager;
}
