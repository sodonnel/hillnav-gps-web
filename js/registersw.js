const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker
          .register("/sw.js", { scope: "./", updateViaCache: "none" });
      registration.addEventListener("updatefound", () => {
          console.log("New worker being installed => ", registration.installing)
      })
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};

registerServiceWorker();