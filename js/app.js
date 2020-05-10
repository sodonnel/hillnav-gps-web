(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HillNav = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = AbstractPosition;
}

},{}],2:[function(require,module,exports){
var AbstractPosition = require('./AbstractPosition.js');
var LatLonSystemMapper = require('./LatLonSystemMapper.js');

class IrishGridPosition extends AbstractPosition {
  constructor(params) {
    super(params);
//    latLonToNorthingEasting();
//    northingEastingToGrid();
  }

  static initWithGWSLatLon(lat, lon) {
    var I = new IrishGridPosition({ gpsLatitude : lat, gpsLongitude : lon });
    I.latLonToNorthingEasting()
    I.northingEastingToGrid()
    return I;
  }


  gridSystem() {
    return "Irish";
  }

  gridReference() {
    return this.gridSquare+" "+this.gridEasting/100+" "+this.gridNorthing/100;
  }

  latLonToNorthingEasting() {
    var systemLatLon = new LatLonSystemMapper().convertWGSToIRL(this.gpsLatitude, this.gpsLongitude);
    this.systemLatitude  = systemLatLon[0];
    this.systemLongitude = systemLatLon[1];

    var rlat  = LatLonSystemMapper.degreesToRadians(this.systemLatitude);
    var rlong = LatLonSystemMapper.degreesToRadians(this.systemLongitude);
 
    var a = 6377340.189;
    var b = 6356034.447;
    var F0 = 1.000035;
    var lat0 = LatLonSystemMapper.degreesToRadians(53.5);
    var lon0 = LatLonSystemMapper.degreesToRadians(-8.0);
    var N0   = 250000.0;
    var E0   = 200000.0;
  
    var e2 = 0.00667054015; // 1.0 - (b*b)/(a*a);
    var n = (a-b)/(a+b);
    var n2 = n*n;
    var n3 = n*n*n;
  
    var cosLat = Math.cos(rlat);
    var sinLat = Math.sin(rlat);
    var nu = a*F0/Math.sqrt(1-e2*sinLat*sinLat);
    var rho = a*F0*(1-e2)/Math.pow(1-e2*sinLat*sinLat, 1.5);
    var eta2 = (nu/rho)-1;
  
    var Ma = (1 + n + (5.0/4.0)*n2 + (5.0/4.0)*n3) * (rlat-lat0);
    var Mb = (3.0*n + 3.0*n*n + (21.0/8.0)*n3) * Math.sin(rlat-lat0) * Math.cos(rlat+lat0);
    var Mc = ((15.0/8.0)*n2 + (15.0/8.0)*n3) * Math.sin(2.0*(rlat-lat0)) * Math.cos(2.0*(rlat+lat0));
    var Md = (35.0/24.0)*n3 * Math.sin(3.0*(rlat-lat0)) * Math.cos(3.0*(rlat+lat0));
    var M = b * F0 * (Ma - Mb + Mc - Md);              // meridional arc
  
    var cos3lat = cosLat*cosLat*cosLat;
    var cos5lat = cos3lat*cosLat*cosLat;
    var tan2lat = Math.tan(rlat)*Math.tan(rlat);
    var tan4lat = tan2lat*tan2lat;
  
    var I = M + N0;
    var II = (nu/2.0)*sinLat*cosLat;
    var III = (nu/24.0)*sinLat*cos3lat*(5.0-tan2lat+9.0*eta2);
    var IIIA = (nu/720.0)*sinLat*cos5lat*(61.0-58.0*tan2lat+tan4lat);
    var IV = nu*cosLat;
    var V = (nu/6.0)*cos3lat*(nu/rho-tan2lat);
    var VI = (nu/120.0) * cos5lat * (5.0 - 18.0*tan2lat + tan4lat + 14.0*eta2 - 58.0*tan2lat*eta2);
  
    var dLon = rlong-lon0;
    var dLon2 = dLon*dLon, dLon3 = dLon2*dLon, dLon4 = dLon3*dLon, dLon5 = dLon4*dLon, dLon6 = dLon5*dLon;
  
    var N = I + II*dLon2 + III*dLon4 + IIIA*dLon6;
    var E = E0 + IV*dLon + V*dLon3 + VI*dLon5;
  
    this.northing = N;
    this.easting  = E;
  }

  northingEastingToGrid() {
    var gridSquares = [
      ['V', 'W', 'X', 'Y', 'Z'],
      ['Q', 'R', 'S', 'T', 'U'],     
      ['L', 'M', 'N', 'O', 'P'],     
      ['F', 'G', 'H', 'J', 'K'],     
      ['A', 'B', 'C', 'D', 'E']
    ];


    // ~~~ here is used to force integer operations so we get only the whole number
    var e100k = ~~(this.easting / 100000);
    var n100k = ~~(this.northing / 100000);
  
    this.gridSquare = gridSquares[n100k][e100k];
  
    this.gridEasting  = ~~(this.easting % 100000);
    this.gridNorthing = ~~(this.northing % 100000);

  }
  
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
   module.exports = IrishGridPosition;
}


},{"./AbstractPosition.js":1,"./LatLonSystemMapper.js":3}],3:[function(require,module,exports){
class LatLonSystemMapper {

  constructor() {

    this.WGS84        = [6378137.0,   6356752.3142,   1.0/298.257223563];
    this.GRS80        = [6378137.0,   6356752.314140, 1.0/298.257222101];
    this.Airy1830     = [6377563.396, 6356256.910,    1.0/299.3249646  ];
    this.AiryModified = [6377340.189, 6356034.448,    1.0/299.32496    ]; 
    this.Intl1924     = [6378388.000, 6356911.946,    1.0/297.0        ];

                       // tx  0     ty 1       tz  2    rx 3    ry 4     rz  5     s   6
    this.DATUMTX = [-446.448, 125.157, -542.060, -0.1502, -0.2470, -0.8421, 20.4894 ];
    this.IRL = [-482.530, 130.596, -564.557, 1.042, 0.214, 0.631, -8.15 ];
      
  }

  convertWGSToOS(la, lon) {
    return this.convertEllipsoid(la, lon, this.WGS84, this.DATUMTX, this.Airy1830);
  }

  convertWGSToIRL(la, lon) {
    return this.convertEllipsoid(la, lon, this.WGS84, this.IRL, this.AiryModified);
  }

  convertEllipsoid(la, ln, e1, t, e2) {
  
    var lat = this.degreesToRadians(la)
    var lon = this.degreesToRadians(ln)

    var a = e1[0]
    var b = e1[1]
  
    var sinPhi    = Math.sin(lat)
    var cosPhi    = Math.cos(lat)
    var sinLambda = Math.sin(lon)
    var cosLambda = Math.cos(lon)
    var H = 24.7; //24.7; // ??

    var eSq = (a*a - b*b) / (a*a)
    var nu = a / Math.sqrt(1.0 - eSq*sinPhi*sinPhi)
  
    var x1 = (nu+H) * cosPhi * cosLambda;
    var y1 = (nu+H) * cosPhi * sinLambda;
    var z1 = ((1.0-eSq)*nu + H) * sinPhi;
  
  // -- 2: apply helmert transform using appropriate params
  
    var tx = t[0], ty = t[1], tz = t[2];
    var rx = this.degreesToRadians(t[3]/3600.0);  // normalise seconds to radians
    var ry = this.degreesToRadians(t[4]/3600.0);
    var rz = this.degreesToRadians(t[5]/3600.0);
    var s1 = t[6]/1e6 + 1.0;          // normalise ppm to (s+1)
  
    // apply transform
    var x2 = tx + x1*s1 - y1*rz + z1*ry;
    var y2 = ty + x1*rz + y1*s1 - z1*rx;
    var z2 = tz - x1*ry + y1*rx + z1*s1;
  
    a = e2[0]
    b = e2[1];
    var precision = 4.0 / a;  // results accurate to around 4 metres
  
    eSq = (a*a - b*b) / (a*a);
    var p = Math.sqrt(x2*x2 + y2*y2);
    var phi = Math.atan2(z2, p*(1-eSq));
    var phiP = 2.0*Math.PI;
    //  while (fabs(phi-phiP) > 0.000000001) {
    while (Math.abs(phi-phiP) > precision) {
      nu = a / Math.sqrt(1.0 - eSq*Math.sin(phi)*Math.sin(phi));
      phiP = phi;
      phi = Math.atan2(z2 + eSq*nu*Math.sin(phi), p);
    }
    var lambda = Math.atan2(y2, x2);
    H = p/Math.cos(phi) - nu;
  
    return [this.radiansToDegrees(phi), this.radiansToDegrees(lambda)];
  }

  degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180.0;
  }

  radiansToDegrees(radians) {
    return (radians * 180.0) / Math.PI;
  }

  static degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180.0;
  }

  static radiansToDegrees(radians) {
    return (radians * 180.0) / Math.PI;
  }
    
}


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = LatLonSystemMapper;
}

},{}],4:[function(require,module,exports){
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

},{"./AbstractPosition.js":1,"./IrishGridPosition.js":2,"./LatLonSystemMapper.js":3}],5:[function(require,module,exports){
var LatLonSystemMapper = require('./LatLonSystemMapper.js');
var AbstractPosition = require('./AbstractPosition.js');
var IrishGridPosition = require('./IrishGridPosition.js');
var PositionManager = require('./PositionManager.js');

module.exports = {
  IrishGridPosition: IrishGridPosition,
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

},{"./AbstractPosition.js":1,"./IrishGridPosition.js":2,"./LatLonSystemMapper.js":3,"./PositionManager.js":4}]},{},[5])(5)
});
