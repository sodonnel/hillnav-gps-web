import PositionManager from 'PositionManager';

const GRID_SYSTEM_COOOKIE_NAME = "gridSystem";
const DEFAULT_GRID_SYSTEM = "Irish";
var gridRef = $("#ref");
var gpsPos = $("#gpsPos");
var accuracy = $("#accuracy");
var ts = $("#ts");
var elevation = $("#elevation");
var speed = $("#speed");
// Values greyed out when the position is stale
var positionValues = $("#ref, #gpsPos, #accuracy, #elevation, #speed");
// A position older than this many seconds is shown as stale
const STALE_AGE_SECONDS = 20;

class HillNav {

    constructor() {
        let coordSystem = readCookie(GRID_SYSTEM_COOOKIE_NAME);
        if (!coordSystem) {
            coordSystem = DEFAULT_GRID_SYSTEM;
        }
        let pm = new PositionManager();
        pm.setNewPositionCallback((p) => {
            gridRef.html(formatGridReference(p));
            gpsPos.html(formatGPSPosition(p));
            accuracy.html("Within "+ p.accuracy + " meters");
            this.updatePositionAge(p);
            this.updateElevationAndSpeed(p);
        });
        this.positionManager = pm;
        this.positionWatchID = null;
        this.watchStartTime = Date.now();
        this.freshPositionPending = false;
        this.setCoordinateSystem(coordSystem);
    }

    run() {
        this.getLocation();
        setInterval(() => {
            this.updatePositionAge(this.positionManager.currentPosition);
        }, 1000);
        setInterval(() => {
            this.checkPosition();
        }, 10000);
        // iOS suspends the page when it is backgrounded or the screen locks, and the
        // position watch is often dead when it comes back. Stop watching while hidden
        // and restart the watch as soon as the page is visible again.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                this.resume();
            } else {
                this.stopLocation();
            }
        });
        window.addEventListener("pageshow", (e) => {
            if (e.persisted) {
                this.resume();
            }
        });
    }

    resume() {
        this.getLocation();
        this.updatePositionAge(this.positionManager.currentPosition);
    }

    checkPosition() {
        let position = this.positionManager.currentPosition;
        if (!position) {
            return;
        }
        let age = this.updatePositionAge(position);
        if (position.timestamp == null) {
            // Still waiting on the first fix, so the watch may never have started properly
            if (age > 60) {
                this.getLocation();
            }
        } else if (age > STALE_AGE_SECONDS) {
            // iOS often stops sending watch updates while stationary. Rather than tearing
            // down the watch, ask for a single fresh fix alongside it.
            this.requestFreshPosition();
        }
    }

    requestFreshPosition() {
        if (!navigator.geolocation || this.freshPositionPending) {
            return;
        }
        this.freshPositionPending = true;
        navigator.geolocation.getCurrentPosition((pos) => {
            this.freshPositionPending = false;
            this.positionManager.updatePosition(pos);
        }, (e) => {
            // The watch reports errors to the user, so just log them here
            this.freshPositionPending = false;
            console.log("Unable to get a fresh position. Error code is: "+e.code);
        }, {enableHighAccuracy: true, maximumAge: 0, timeout: 30000});
    }

    setCoordinateSystem(sys) {
        this.positionManager.setCoordinateSystem(sys);
        if (sys === "GPS") {
            gridRef.hide();
            gpsPos.show();
            $("#systemHeading").html("GPS Coordinates");
        } else {
            gridRef.show();
            gpsPos.hide();
            $("#systemHeading").html(sys + " Grid Reference");
        }
    }

    stopLocation() {
        if (this.positionWatchID != null) {
            navigator.geolocation.clearWatch(this.positionWatchID);
            this.positionWatchID = null;
        }
    }

    getLocation() {
        if (navigator.geolocation) {
            this.stopLocation();
            this.watchStartTime = Date.now();
            // maximumAge of 0 stops the browser handing back a cached position, which on
            // iOS can be from before the app was suspended.
            this.positionWatchID = navigator.geolocation.watchPosition(this.positionManager.updatePosition.bind(this.positionManager),
                errorHandler, {enableHighAccuracy: true, maximumAge: 0, timeout:300000});
        } else {
            x.innerHTML = "Geolocation is not supported by this browser.";
        }
    }

    updatePositionAge(position) {
        if (!position) {
            return;
        }
        var d = new Date();
        var now = d.getTime();
        if (position.timestamp == null) {
            // No fix received yet. Report how long the current watch has been waiting,
            // so the caller can restart it if nothing ever arrives.
            var waiting = Math.floor((now - this.watchStartTime) / 1000);
            ts.html("Waiting for location for "+waiting+" seconds");
            return waiting;
        }
        var age = Math.floor((now - position.timestamp) / 1000)
        var stale = age > STALE_AGE_SECONDS;
        positionValues.toggleClass("text-muted", stale);
        ts.toggleClass("text-danger font-weight-bold", stale);
        if (stale) {
            ts.html("Position is "+age+" seconds old and may be out of date");
        } else {
            ts.html("Position updated "+age+" seconds ago");
        }
        return age;
    }

    updateElevationAndSpeed(p) {
        if (p.elevation != null) {
            elevation.html("Elevation: "+Math.round(p.elevation)+"m (within  "+Math.round(p.elevationAccuracy)+"m)");
        } else {
            elevation.html("Elevation: unavailable");
        }
        if (p.speed != null) {
            speed.html("Speed: "+Math.round(p.speed)+" m/s");
        } else {
            speed.html("Speed: unavailable");
        }
    }
}

function formatGridReference(pos) {
    if (!pos.isInGrid()) {
        return "Outside "+pos.gridSystem()+" Grid";
    }
    return pos.gridSquare+" "+
        pos.majorEasting()+
        "<div style=\"display:inline; font-size: 20px\">"+pos.minorEasting()+"</div>&nbsp;&nbsp;"+
        pos.majorNorthing()+
        "<div style=\"display:inline; font-size: 20px\">"+pos.minorNorthing()+"</div>";
}

function formatGPSPosition(pos) {
    return "Lat: "+pos.gpsLatitude+"&nbsp;&nbsp;Lon: "+pos.gpsLongitude;
}

function errorHandler(e) {
    console.log("Unable to get the geolocation position. Error code is: "+e.code);
    console.log("The error message is: "+e.message);
    if (e.code == 1) {
        alert("The browser denied location access. On Mac OS and OS X ensure location services are enabled in System Preferences -> Security and Privacy");
    } else if (e.code == 2) {
        alert("The position is unavailable. On Mac OS and OS X ensure location services are enabled in System Preferences -> Security and Privacy");
    } else if (e.code == 3) {
        alert("Unable to get the position within the timeout");
    }
}

// Simple cookie handling functions
function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    } else var expires = "";

    document.cookie = name + "=" + value + expires + "; SameSite=Strict; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

let hillNav = new HillNav();

$( "#setSystemIrish" ).click(function() {
    createCookie(GRID_SYSTEM_COOOKIE_NAME, "Irish", 700);
    hillNav.setCoordinateSystem("Irish");
    $("#navbarSupportedContent").collapse('hide');
});

$( "#setSystemUK" ).click(function() {
    createCookie(GRID_SYSTEM_COOOKIE_NAME, "UK", 700);
    hillNav.setCoordinateSystem("UK");
    $("#navbarSupportedContent").collapse('hide');
});

$( "#setSystemGPS" ).click(function() {
    createCookie(GRID_SYSTEM_COOOKIE_NAME, "GPS", 700);
    hillNav.setCoordinateSystem("GPS");
    $("#navbarSupportedContent").collapse('hide');
});

hillNav.run();

export {HillNav};
