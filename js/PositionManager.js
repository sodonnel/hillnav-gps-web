import AbstractPosition from 'AbstractPosition';
import LatLonSystemMapper from 'LatLonSystemMapper';
import IrishGridPosition from 'IrishGridPosition';
import UKGridPosition from 'UKGridPosition';

class PositionManager {

  constructor() {
    this.currentPosition = null;
    this.coordinateSystem = null;
    this.newPositionCallback = null;
    this.gpsPos = null;
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
      this.currentPosition = new UKGridPosition({});
    } else {
      console.log("Invalid coordinate system specified: "+system);
      return;
    }
    this.updatePosition(null);
  }

  setNewPositionCallback(f) {
    this.newPositionCallback = f;
  }

  updatePosition(pos) {
    if (pos) {
      this.gpsPos=pos;
    }
    if (this.gpsPos) {
      // Only update the position if we actually have one to update it with
      this.currentPosition.setPositionFromGPS(this.gpsPos.coords.latitude, this.gpsPos.coords.longitude, this.gpsPos.coords.accuracy, this.gpsPos.timestamp);
      this.currentPosition.setElevation(this.gpsPos.coords.altitude, this.gpsPos.coords.altitudeAccuracy, this.gpsPos.coords.speed);
      this.newPositionCallback(this.currentPosition);
    }
  }

}

export default PositionManager;

