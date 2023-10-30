import AbstractPosition from 'AbstractPosition';
import LatLonSystemMapper from 'LatLonSystemMapper';

class UKGridPosition extends AbstractPosition {
  constructor(params) {
    super(params);
  }

  static initWithGWSLatLon(lat, lon) {
    var I = new UKGridPosition({ gpsLatitude : lat, gpsLongitude : lon });
    I.latLonToNorthingEasting();
    I.northingEastingToGrid();
    return I;
  }


  gridSystem() {
    return "UK";
  }

  gridReference() {
    return this.gridSquare+" "+this.gridEasting/100+" "+this.gridNorthing/100;
  }

  latLonToNorthingEasting() {
    var systemLatLon = new LatLonSystemMapper().convertWGSToOS(this.gpsLatitude, this.gpsLongitude);
    this.systemLatitude  = systemLatLon[0];
    this.systemLongitude = systemLatLon[1];

    var rlat  = LatLonSystemMapper.degreesToRadians(this.systemLatitude);
    var rlong = LatLonSystemMapper.degreesToRadians(this.systemLongitude);

    var a = 6377563.396;
    var b = 6356256.910;
    var F0 = 0.9996012717;
    var lat0 = LatLonSystemMapper.degreesToRadians(49.0);
    var lon0 = LatLonSystemMapper.degreesToRadians(-2.0);
    var N0   = -100000.0;
    var E0   = 400000.0;
  
    var e2 = 1 - (b*b)/(a*a);
    var n = (a-b)/(a+b);
    var n2 = n*n;
    var n3 = n*n*n;
  
    var cosLat = Math.cos(rlat);
    var sinLat = Math.sin(rlat);
    var nu = a*F0/Math.sqrt(1.0-e2*sinLat*sinLat);
    var rho = a*F0*(1.0-e2)/Math.pow(1-e2*sinLat*sinLat, 1.5);
    var eta2 = nu/rho-1;
  
    var Ma = (1.0 + n + (5.0/4.0)*n2 + (5.0/4.0)*n3) * (rlat-lat0);
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

    var gridSquares = ['NA', 'NB', 'NC', 'ND', 'NF', 'NG', 'NH', 'NJ', 'NK',
      'NL', 'NM', 'NN', 'NO', 'NR', 'NS', 'NT', 'NU', 'NW', 'NX', 'NY', 'NZ', 'OV', 'SC', 'SD',
      'SE','SH','SJ','SK','SM','SN','SO','SP','SR','SS','ST','SU', 'SV','SW','SX',
		       'SY','SZ','TA','TF','TG','TL','TM','TQ','TR','TV'];

  
    var e100k = ~~(this.easting / 100000);
    var n100k = ~~(this.northing / 100000);
  
    var l1 = (19 - n100k) - (19 - n100k)%5 + (e100k+10)/5;
    var l2 = ((19 - n100k)*5)%25 + e100k % 5;
  
    if (l1 > 7) {
      l1 ++;
    }
    if (l2 > 7) {
      l2 ++;
    }
    l1 = l1 + 65;
    l2 = l2 + 65;
  
    this.gridSquare = String.fromCharCode(l1)+String.fromCharCode(l2);
    this.gridEasting  = ~~(this.easting % 100000);
    this.gridNorthing = ~~(this.northing % 100000);
  }
}

export default UKGridPosition;

