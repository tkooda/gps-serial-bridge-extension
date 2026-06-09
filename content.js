const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(s);

if (chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['cacheDuration'], (res) => {
    if (res.cacheDuration) {
      window.postMessage({ source: 'gps-bridge', action: 'UPDATE_SETTINGS', data: { cacheDuration: parseInt(res.cacheDuration, 10) } }, '*');
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_LOCATION' || message.action === 'UPDATE_SETTINGS') {
    window.postMessage({ source: 'gps-bridge', ...message }, '*');
  }
});