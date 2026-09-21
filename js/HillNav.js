import PositionManager from 'PositionManager';

const GRID_SYSTEM_SETTING = "gridSystem";
const DEFAULT_GRID_SYSTEM = "Irish";
const KEEP_SCREEN_ON_SETTING = "keepScreenOn";
var gridRef = $("#ref");
var gpsPos = $("#gpsPos");
var accuracy = $("#accuracy");
var ts = $("#ts");
var elevation = $("#elevation");
var speed = $("#speed");
var locationError = $("#locationError");
// Values greyed out when the position is stale
var positionValues = $("#ref, #gpsPos, #accuracy, #elevation, #speed");
// A position older than this many seconds is shown as stale
const STALE_AGE_SECONDS = 20;

class HillNav {

    constructor() {
        let coordSystem = readSetting(GRID_SYSTEM_SETTING);
        if (!coordSystem) {
            coordSystem = DEFAULT_GRID_SYSTEM;
        }
        let pm = new PositionManager();
        pm.setNewPositionCallback((p) => {
            locationError.prop("hidden", true);
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
        this.keepScreenOn = readSetting(KEEP_SCREEN_ON_SETTING) === "true";
        this.wakeLock = null;
        this.wakeLockPending = false;
        this.setCoordinateSystem(coordSystem);
    }

    run() {
        this.getLocation();
        if ("wakeLock" in navigator) {
            $("#keepScreenOnItem").prop("hidden", false);
            this.updateKeepScreenOnLabel();
            this.requestWakeLock();
        }
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
        // The browser releases the wake lock whenever the page is hidden
        this.requestWakeLock();
    }

    setKeepScreenOn(on) {
        this.keepScreenOn = on;
        if (on) {
            this.requestWakeLock();
        } else if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
        this.updateKeepScreenOnLabel();
    }

    updateKeepScreenOnLabel() {
        $("#toggleKeepScreenOn").html("Keep Screen On: " + (this.keepScreenOn ? "On" : "Off"));
    }

    async requestWakeLock() {
        if (!("wakeLock" in navigator) || !this.keepScreenOn || this.wakeLock || this.wakeLockPending
                || document.visibilityState !== "visible") {
            return;
        }
        this.wakeLockPending = true;
        try {
            let lock = await navigator.wakeLock.request("screen");
            if (!this.keepScreenOn) {
                // Turned off while the request was in progress
                lock.release();
                return;
            }
            lock.addEventListener("release", () => {
                if (this.wakeLock === lock) {
                    this.wakeLock = null;
                }
            });
            this.wakeLock = lock;
        } catch (e) {
            // For example in low power mode. The setting stays on and is retried on resume.
            console.log("Unable to keep the screen on: "+e.name+": "+e.message);
        } finally {
            this.wakeLockPending = false;
        }
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
                showLocationError, {enableHighAccuracy: true, maximumAge: 0, timeout:300000});
        } else {
            locationError.html("This browser cannot provide your location.").prop("hidden", false);
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

// Errors are shown in the card rather than with alert(), which blocks the app, and are cleared
// when the next position arrives. The watch is restarted while waiting for a first fix and
// when the app returns to the foreground, so it recovers if location is allowed later.
function showLocationError(e) {
    console.log("Unable to get the geolocation position. Error code is: "+e.code+", message: "+e.message);
    let message;
    if (e.code == e.PERMISSION_DENIED) {
        message = "Location access is not allowed. On iPhone, check Settings > Privacy & Security > "+
            "Location Services is on, and that Safari Websites is set to allow location.";
    } else if (e.code == e.POSITION_UNAVAILABLE) {
        message = "Your position is unavailable. Check that Location Services is turned on.";
    } else {
        message = "Still waiting for a GPS fix. This can take longer indoors or under heavy cover.";
    }
    locationError.html(message).prop("hidden", false);
}

// Settings are kept in localStorage. Earlier versions used cookies, so a setting still in a
// cookie is moved across the first time it is read.
function readSetting(name) {
    try {
        let value = localStorage.getItem(name);
        if (value === null) {
            value = readCookie(name);
            if (value !== null) {
                localStorage.setItem(name, value);
                eraseCookie(name);
            }
        }
        return value;
    } catch (e) {
        // Storage can be unavailable, and the app works with its defaults
        console.log("Unable to read setting "+name+": "+e.message);
        return null;
    }
}

function saveSetting(name, value) {
    try {
        localStorage.setItem(name, value);
    } catch (e) {
        console.log("Unable to save setting "+name+": "+e.message);
    }
}

// Cookie handling, only used to move settings saved by earlier versions
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
    saveSetting(GRID_SYSTEM_SETTING, "Irish");
    hillNav.setCoordinateSystem("Irish");
    $("#navbarSupportedContent").collapse('hide');
});

$( "#setSystemUK" ).click(function() {
    saveSetting(GRID_SYSTEM_SETTING, "UK");
    hillNav.setCoordinateSystem("UK");
    $("#navbarSupportedContent").collapse('hide');
});

$( "#setSystemGPS" ).click(function() {
    saveSetting(GRID_SYSTEM_SETTING, "GPS");
    hillNav.setCoordinateSystem("GPS");
    $("#navbarSupportedContent").collapse('hide');
});

$( "#toggleKeepScreenOn" ).click(function() {
    let on = !hillNav.keepScreenOn;
    saveSetting(KEEP_SCREEN_ON_SETTING, on ? "true" : "false");
    hillNav.setKeepScreenOn(on);
    $("#navbarSupportedContent").collapse('hide');
});

hillNav.run();

export {HillNav};
