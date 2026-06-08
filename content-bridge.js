const script = document.createElement('script');
script.textContent = `
  (() => {
    let currentCoords = null;
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'HW_GPS_TRANSIT') currentCoords = e.data.coords;
    });

    const routePosition = (success, error, options) => {
      if (currentCoords) {
        success({
          coords: {
            latitude: currentCoords.latitude,
            longitude: currentCoords.longitude,
            accuracy: currentCoords.accuracy,
            altitude: null, altitudeAccuracy: null, heading: null, speed: null
          },
          timestamp: Date.now()
        });
      } else {
        navigator._nativeGeo.getCurrentPosition(success, error, options);
      }
    };

    if (!navigator._nativeGeo) {
      navigator._nativeGeo = {
        getCurrentPosition: navigator.geolocation.getCurrentPosition.bind(navigator.geolocation),
        watchPosition: navigator.geolocation.watchPosition.bind(navigator.geolocation),
        clearWatch: navigator.geolocation.clearWatch.bind(navigator.geolocation)
      };
      navigator.geolocation.getCurrentPosition = routePosition;
      navigator.geolocation.watchPosition = (success, error, options) => {
        routePosition(success, error, options);
        return setInterval(() => routePosition(success, error, options), 1000);
      };
      navigator.geolocation.clearWatch = (id) => clearInterval(id);
    }
  })();
`;
document.documentElement.appendChild(script);
script.remove();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GPS_COORDINATES') {
    window.postMessage({ type: 'HW_GPS_TRANSIT', coords: message.coords }, '*');
  }
});
