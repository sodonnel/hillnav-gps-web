import PositionManager from 'PositionManager';

const GRID_SYSTEM_COOOKIE_NAME = "gridSystem";
const DEFAULT_GRID_SYSTEM = "Irish";
var x = document.getElementById("demo");
var y = document.getElementById("ref");
var accuracy = document.getElementById("accuracy");
var ts = document.getElementById("ts");
var elevation = document.getElementById("elevation");
var speed = document.getElementById("speed");

class HillNav {

    constructor() {
        let coordSystem = readCookie(GRID_SYSTEM_COOOKIE_NAME);
        if (!coordSystem) {
            coordSystem = DEFAULT_GRID_SYSTEM;
        }
        let pm = new PositionManager();
        pm.setNewPositionCallback((p) => {
            y.innerHTML = formatGridReference(p);
            accuracy.innerHTML = "Within "+ p.accuracy + " meters";
            this.updatePositionAge(p);
            this.updateElevationAndSpeed(p);
        });
        this.positionManager = pm;
        this.positionWatchID = null;
        this.setCoordinateSystem(coordSystem);
    }

    run() {
        this.getLocation();
        setInterval(() => {
            this.updatePositionAge(this.positionManager.currentPosition)
        }, 10000);
    }

    setCoordinateSystem(sys) {
        this.positionManager.setCoordinateSystem(sys);
        // TODO - need to lookup the title text as GPS will not fit in this pattern
        $("#systemHeading").html(sys + " Grid Reference");
    }

    getLocation() {
        if (navigator.geolocation) {
            if (this.positionWatchID != null) {
                navigator.geolocation.clearWatch(this.positionWatchID);
            }
            // maximumAge is supposed to be milli-seconds. So 1 minute is 60000
            this.positionWatchID = navigator.geolocation.watchPosition(this.positionManager.updatePosition.bind(this.positionManager),
                errorHandler, {enableHighAccuracy: true, maximumAge: 60000, timeout:300000});
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
        var age = Math.floor((now - position.timestamp) / 1000)
        if (age > 60) {
            this.getLocation();
        }
        ts.innerHTML = "Position updated "+age+" seconds ago"
    }

    updateElevationAndSpeed(p) {
        if (p.elevation != null) {
            elevation.innerHTML = "Elevation: "+Math.round(p.elevation)+"m (within  "+Math.round(p.elevationAccuracy)+"m)";
        } else {
            elevation.innerHTML = "Elevation: unavailable";
        }
        if (p.speed != null) {
            speed.innerHTML = "Speed: "+Math.round(p.speed)+" m/s";
        } else {
            speed.innerHTML = "Speed: unavailable";
        }
    }
}

function formatGridReference(pos) {
    return pos.gridSquare+" "+
        pos.majorEasting()+
        "<div style=\"display:inline; font-size: 20px\">"+pos.minorEasting()+"</div>&nbsp;&nbsp;"+
        pos.majorNorthing()+
        "<div style=\"display:inline; font-size: 20px\">"+pos.minorNorthing()+"</div>";
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

hillNav.run();

export {HillNav};
