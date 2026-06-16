const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');

// inject.js loads asynchronously (it's a real <script src>), so it may not have
// registered its message listener yet when the storage read below resolves.
// Wait for both before posting, otherwise the initial state can be silently dropped.
let scriptLoaded = false;
let storageResult = null;
function sendInitialState() {
  if (!scriptLoaded || !storageResult) return;
  const res = storageResult;
  // Default to 15 minutes if not explicitly set yet
  let parsedDuration = 900000;
  if (res.cacheDuration !== undefined && res.cacheDuration !== null) {
    parsedDuration = typeof res.cacheDuration === 'number' ? res.cacheDuration : parseInt(res.cacheDuration, 10);
  }
  window.postMessage({ source: 'gps-bridge', action: 'UPDATE_SETTINGS', data: { cacheDuration: parsedDuration } }, '*');
  if (res.lastLocation) {
    // Just in case it's a proxy object or missing timestamp... we ensure JSON serialization passes it perfectly
    const cleanData = JSON.parse(JSON.stringify(res.lastLocation));
    window.postMessage({ source: 'gps-bridge', action: 'UPDATE_LOCATION', data: cleanData }, '*');
  }
  window.postMessage({ source: 'gps-bridge', action: 'STORAGE_INITIALIZED' }, '*');
}

s.onload = function() { this.remove(); scriptLoaded = true; sendInitialState(); };
(document.head || document.documentElement).appendChild(s);

if (chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['cacheDuration', 'lastLocation'], (res) => {
    storageResult = res;
    sendInitialState();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_LOCATION' || message.action === 'UPDATE_SETTINGS') {
    window.postMessage({ source: 'gps-bridge', ...message }, '*');
  }
});