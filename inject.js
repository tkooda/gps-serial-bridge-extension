(function() {
  // Guard against double injection (e.g. bfcache restores re-running the script tag).
  // Without this, a second pass would capture our own override as "originalGeolocation"
  // and wire up duplicate watchers/timers on top of it.
  if (window.__gpsBridgeInjected) return;
  window.__gpsBridgeInjected = true;

  let currentPos = null;
  const watchCallbacks = new Map();
  let watchIdCounter = 1;
  let staleThresholdMs = 300000; 

  function hasFreshHardwareData() {
    if (!currentPos) return false;
    if (staleThresholdMs === -1) return true;
    return (Date.now() - currentPos.timestamp) < staleThresholdMs;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'gps-bridge') return;
    if (event.data.action === 'UPDATE_SETTINGS') staleThresholdMs = event.data.data.cacheDuration;
    if (event.data.action === 'UPDATE_LOCATION') {
      currentPos = { 
        coords: { 
          latitude: parseFloat(event.data.data.lat), 
          longitude: parseFloat(event.data.data.lon), 
          accuracy: event.data.data.hdop ? parseFloat(event.data.data.hdop) * 5 : 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: NaN,
          speed: NaN
        }, 
        timestamp: parseInt(event.data.data.timestamp, 10) || Date.now() 
      };
      
      // Make sure we didn't corrupt the data by parseFloat'ing a NaN:
      if (isNaN(currentPos.coords.latitude) || isNaN(currentPos.coords.longitude)) {
          currentPos = null;
          return; // Skip notifying watchers with a null/corrupt position
      }
      
      for (let watcher of watchCallbacks.values()) watcher.customCallback(currentPos);
    }
    // We must ensure the queue flushing happens after BOTH settings and location have a chance to be set.
    // If the content script sends UPDATE_SETTINGS then UPDATE_LOCATION, we wait until UPDATE_LOCATION or STORAGE_INITIALIZED.
    if (event.data.action === 'STORAGE_INITIALIZED') {
      if (!initializedFromStorage) {
        initializedFromStorage = true;
        for (let req of pendingGetRequests) {
          if (hasFreshHardwareData()) {
            setTimeout(() => req.success(currentPos), 0);
          } else if (!req.isWatch) {
            originalGeolocation.getCurrentPosition.call(originalGeolocation, req.success, req.error || function(){}, req.options);
          }
          // isWatch with no fresh data: native watchPosition was already started in the watchPosition
          // interceptor and will deliver updates, so no further action is needed here.
        }
        pendingGetRequests.length = 0;
      }
    }
  });

  const originalGeolocation = navigator.geolocation;
  let initializedFromStorage = false;
  const pendingGetRequests = [];

  // Fallback: if STORAGE_INITIALIZED never arrives (e.g. content script blocked), unblock after 1s.
  setTimeout(() => {
    if (initializedFromStorage) return;
    initializedFromStorage = true;
    for (let req of pendingGetRequests) {
      if (hasFreshHardwareData()) {
        setTimeout(() => req.success(currentPos), 0);
      } else if (!req.isWatch) {
        originalGeolocation.getCurrentPosition.call(originalGeolocation, req.success, req.error || function(){}, req.options);
      }
    }
    pendingGetRequests.length = 0;
  }, 1000);

  // Safely override geolocation on the prototype if necessary
  const targetObj = navigator.geolocation ? navigator : Navigator.prototype;
  try {
    Object.defineProperty(targetObj, 'geolocation', {
    value: {
      getCurrentPosition: (success, error, options) => {
        if (hasFreshHardwareData()) return setTimeout(() => success(currentPos), 0);
        if (!initializedFromStorage) {
          pendingGetRequests.push({ success, error, options });
          return;
        }
        originalGeolocation.getCurrentPosition.call(originalGeolocation, success, error, options);
      },
      watchPosition: (success, error, options) => {
        const id = watchIdCounter++;
        const nativeId = originalGeolocation.watchPosition.call(originalGeolocation, (pos) => { if (!hasFreshHardwareData()) success(pos); }, (err) => { if (!hasFreshHardwareData() && error) error(err); }, options);
        watchCallbacks.set(id, { customCallback: success, nativeId });
        if (hasFreshHardwareData()) {
          setTimeout(() => success(currentPos), 0);
        } else if (!initializedFromStorage) {
          pendingGetRequests.push({ success, error, options, isWatch: true });
        }
        return id;
      },
      clearWatch: (id) => { if (watchCallbacks.has(id)) { originalGeolocation.clearWatch.call(originalGeolocation, watchCallbacks.get(id).nativeId); watchCallbacks.delete(id); } }
    },
    configurable: false, writable: false
    });
  } catch(e) { console.error("GPS-Bridge Error: Could not bind Geolocation", e); }
})();