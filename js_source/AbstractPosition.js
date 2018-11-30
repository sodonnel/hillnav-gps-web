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
    this.timestamp       = params['timestamp']
    
  }
  
  setPositionFromGPS(lat, lon, accuracy, timestamp) {
    this.gpsLatitude = lat;
    this.gpsLongitude = lon;
    this.accuracy = accuracy;
    this.timestamp = timestamp;
    this.latLonToNorthingEasting();
    this.northingEastingToGrid();
  }

  setElevation(elev, accuracy) {
    this.elevation = elev;
    this.elevationAccuracy = accuracy;
  }
  
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = AbstractPosition;
}
