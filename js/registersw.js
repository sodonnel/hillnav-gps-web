// Registers the service worker, and offers to reload when a new version of the app is ready.
const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  let registration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch (error) {
    console.error(`Registration failed with ${error}`);
    return;
  }

  keepOfflineCache();

  let updateAccepted = false;
  const offerUpdate = (worker) => {
    document.getElementById("updateButton").onclick = () => {
      updateAccepted = true;
      worker.postMessage("SKIP_WAITING");
    };
    document.getElementById("updateBanner").hidden = false;
  };

  // A new version may already be waiting from an earlier visit
  if (registration.waiting && navigator.serviceWorker.controller) {
    offerUpdate(registration.waiting);
  }
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker.addEventListener("statechange", () => {
      // With no controller this is the first install, which needs no reload
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        offerUpdate(worker);
      }
    });
  });

  // The first install also changes the controller, so only reload for an accepted update
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateAccepted) {
      window.location.reload();
    }
  });

  // iOS home screen apps are rarely reloaded, so the browser's own update check on page load
  // seldom runs. Check again whenever the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registration.update().catch((error) => console.log(`Update check failed with ${error}`));
    }
  });
};

// Browsers can clear a site's storage, including the offline cache, when the device is short of
// space. Ask for it to be kept, but only for the installed app: some browsers prompt for this, and
// a visitor in a browser tab does not need it. Chrome often grants it to installed apps silently.
const keepOfflineCache = async () => {
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!installed || !navigator.storage || !navigator.storage.persist) {
    return;
  }
  try {
    if (await navigator.storage.persisted()) {
      return;
    }
    const granted = await navigator.storage.persist();
    console.log(`Persistent storage ${granted ? "granted" : "not granted"}`);
  } catch (error) {
    console.log(`Persistent storage request failed with ${error}`);
  }
};

registerServiceWorker();
