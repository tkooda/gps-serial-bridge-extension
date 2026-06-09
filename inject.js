(function() {
  let currentPos = null;
  const watchCallbacks = new Map();
  let watchIdCounter = 1;
  let staleThresholdMs = 300000; 

  function hasFreshHardwareData() {
    return currentPos && (staleThresholdMs === -1 || (Date.now() - currentPos.timestamp < staleThresholdMs));
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'gps-bridge') return;
    if (event.data.action === 'UPDATE_SETTINGS') staleThresholdMs = event.data.data.cacheDuration;
    if (event.data.action === 'UPDATE_LOCATION') {
      currentPos = { coords: { latitude: parseFloat(event.data.data.lat), longitude: parseFloat(event.data.data.lon), accuracy: 5 }, timestamp: Date.now() };
      for (let watcher of watchCallbacks.values()) watcher.customCallback(currentPos);
    }
  });

  const originalGeolocation = navigator.geolocation;
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: (success, error, options) => hasFreshHardwareData() ? success(currentPos) : originalGeolocation.getCurrentPosition(success, error, options),
      watchPosition: (success, error, options) => {
        const id = watchIdCounter++;
        const nativeId = originalGeolocation.watchPosition((pos) => { if (!hasFreshHardwareData()) success(pos); }, error, options);
        watchCallbacks.set(id, { customCallback: success, nativeId });
        if (hasFreshHardwareData()) success(currentPos);
        return id;
      },
      clearWatch: (id) => { if (watchCallbacks.has(id)) { originalGeolocation.clearWatch(watchCallbacks.get(id).nativeId); watchCallbacks.delete(id); } }
    },
    configurable: false, writable: false
  });
})();