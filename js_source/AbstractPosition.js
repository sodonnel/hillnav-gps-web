class AbstractPosition {
  constructor(params) {
    this.gpsLatitude     = params.gpsLatitude
    this.gpsLongitude    = params['gpsLongitude']
    this.systemLatitude  = params['systemLatitude']
    this.systemLongitude = params['systemLongitude']
    this.easting         = params['easting']
    this.northing        = params['northing']
    this.gridSquare      = params['gridSquare']
    this.gridEasting     = params['gridEasting']
    this.gridNorthing    = params['gridNorthing']
    this.accuracy        = params['accuracy']
    this.elevation       = params['elevation']
    this.elevationAccuracy = params['elevationAccuracy']
    this.speed             = params['speed']
    this.timestamp       = params['timestamp']
    
  }
  
  setPositionFromGPS(lat, lon, accuracy, timestamp) {
    this.gpsLatitude = lat;
    this.gpsLongitude = lon;
    // Accuracy is in meters, so round to nearest meter
    this.accuracy = Math.round(accuracy);
    this.timestamp = timestamp;
    this.latLonToNorthingEasting();
    this.northingEastingToGrid();
  }

  setElevation(elev, accuracy, speed) {
    this.elevation = elev;
    this.elevationAccuracy = accuracy;
    this.speed = speed;
  }

  minorEasting() {
    return (this.gridEasting % 100).toString().padStart(2, "0");
  }

  majorEasting() {
    return Math.floor(this.gridEasting / 100).toString().padStart(3, "0");
  }

  minorNorthing() {
    return (this.gridNorthing % 100).toString().padStart(2, "0");
  }

  majorNorthing() {
    return Math.floor(this.gridNorthing / 100).toString().padStart(3, "0");
  }

}

export default AbstractPosition;
