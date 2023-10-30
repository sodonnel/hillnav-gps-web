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

export default LatLonSystemMapper;
