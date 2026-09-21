// Tests for the grid reference conversions and PositionManager.
// Run with dev/test/run_tests.sh - see README.md.
import IrishGridPosition from 'IrishGridPosition';
import UKGridPosition from 'UKGridPosition';
import PositionManager from 'PositionManager';

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail ? "  -> " + detail : ""));
  if (!cond) failures++;
}

function ref(p) {
  return p.isInGrid() ? p.gridSquare + " " + p.gridEasting + " " + p.gridNorthing : "OUTSIDE";
}

function near(p, square, e, n, tol) {
  return p.gridSquare === square && Math.abs(p.gridEasting - e) <= tol && Math.abs(p.gridNorthing - n) <= tol;
}

// Known summits (WGS84) against published grid refs, within 50m
let benNevis = UKGridPosition.initWithGWSLatLon(56.79685, -5.00360);
check("UK: Ben Nevis ~ NN 16664 71253", near(benNevis, "NN", 16664, 71253, 50), ref(benNevis));

let snowdon = UKGridPosition.initWithGWSLatLon(53.06851, -4.07623);
check("UK: Snowdon ~ SH 60986 54375", near(snowdon, "SH", 60986, 54375, 50), ref(snowdon));

let carrauntoohil = IrishGridPosition.initWithGWSLatLon(51.99944, -9.74287);
check("Irish: Carrauntoohil ~ V 80375 84409", near(carrauntoohil, "V", 80375, 84409, 100), ref(carrauntoohil));

let slieveDonard = IrishGridPosition.initWithGWSLatLon(54.18029, -5.92106);
check("Irish: Slieve Donard ~ J 35800 27700", near(slieveDonard, "J", 35800, 27700, 150), ref(slieveDonard));

// Previously crashed: Irish grid north of 500km northing (Scotland)
let cairngorm, err = null;
try { cairngorm = IrishGridPosition.initWithGWSLatLon(57.1167, -3.6436); } catch (e) { err = e; }
check("Irish: Cairn Gorm does not throw", err === null, err && err.message);
check("Irish: Cairn Gorm is outside grid", cairngorm && !cairngorm.isInGrid(), cairngorm && ref(cairngorm));

// Previously gave an "undefined" square: Irish grid east of 500km easting (London)
let london = IrishGridPosition.initWithGWSLatLon(51.5074, -0.1278);
check("Irish: London is outside grid", !london.isInGrid(), ref(london));

// South of both grids (France)
let paris = UKGridPosition.initWithGWSLatLon(48.8566, 2.3522);
check("UK: Paris is outside grid", !paris.isInGrid(), ref(paris));
err = null;
try { IrishGridPosition.initWithGWSLatLon(48.8566, 2.3522); } catch (e) { err = e; }
check("Irish: Paris does not throw", err === null, err && err.message);

// Far north but still on the UK grid (Shetland, HP square)
let unst = UKGridPosition.initWithGWSLatLon(60.8, -0.85);
check("UK: Unst is in HP", unst.isInGrid() && unst.gridSquare === "HP", ref(unst));

let kirkwall = UKGridPosition.initWithGWSLatLon(58.9809, -2.9605);
check("UK: Kirkwall ~ HY 44885 10813", near(kirkwall, "HY", 44885, 10813, 50), ref(kirkwall));

// Every 100km square on the UK grid should map to the published two-letter code
const ukSquares = [
  // rows from northing 1200km (top) down to 0, eastings 0..600km
  ["HL","HM","HN","HO","HP","JL","JM"],
  ["HQ","HR","HS","HT","HU","JQ","JR"],
  ["HV","HW","HX","HY","HZ","JV","JW"],
  ["NA","NB","NC","ND","NE","OA","OB"],
  ["NF","NG","NH","NJ","NK","OF","OG"],
  ["NL","NM","NN","NO","NP","OL","OM"],
  ["NQ","NR","NS","NT","NU","OQ","OR"],
  ["NV","NW","NX","NY","NZ","OV","OW"],
  ["SA","SB","SC","SD","SE","TA","TB"],
  ["SF","SG","SH","SJ","SK","TF","TG"],
  ["SL","SM","SN","SO","SP","TL","TM"],
  ["SQ","SR","SS","ST","SU","TQ","TR"],
  ["SV","SW","SX","SY","SZ","TV","TW"],
];
let wrong = [];
for (let row = 0; row < ukSquares.length; row++) {
  for (let col = 0; col < 7; col++) {
    let p = new UKGridPosition({});
    p.easting = col * 100000 + 50000;
    p.northing = (12 - row) * 100000 + 50000;
    p.northingEastingToGrid();
    if (p.gridSquare !== ukSquares[row][col]) wrong.push(ukSquares[row][col] + " got " + p.gridSquare);
  }
}
check("UK: all 91 squares have the right letters", wrong.length === 0, wrong.join(", "));

// PositionManager ignores out-of-order positions
function gps(lat, lon, ts) {
  return { coords: { latitude: lat, longitude: lon, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: null }, timestamp: ts };
}
let pm = new PositionManager();
let seen = [];
pm.setNewPositionCallback((p) => seen.push(p.timestamp));
pm.setCoordinateSystem("Irish");
check("PM: no callback before first fix", seen.length === 0, JSON.stringify(seen));
pm.updatePosition(gps(53.35, -6.26, 2000));
pm.updatePosition(gps(53.36, -6.27, 1000));
check("PM: older position ignored", pm.currentPosition.timestamp === 2000 && pm.currentPosition.gpsLatitude === 53.35,
  "timestamp " + pm.currentPosition.timestamp);
pm.updatePosition(gps(53.37, -6.28, 3000));
check("PM: newer position applied", pm.currentPosition.timestamp === 3000, "timestamp " + pm.currentPosition.timestamp);
pm.setCoordinateSystem("UK");
check("PM: switching grid keeps last fix", pm.currentPosition.timestamp === 3000 && pm.currentPosition.gridSystem() === "UK",
  "timestamp " + pm.currentPosition.timestamp);

console.log(failures === 0 ? "\nAll checks passed" : "\n" + failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);
