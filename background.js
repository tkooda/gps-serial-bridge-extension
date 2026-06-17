chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'NEW_LOCATION') {
    chrome.storage.local.set({ lastLocation: message.data }).catch(() => {});
    chrome.tabs.query({}, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_LOCATION', data: message.data }).catch(() => {});
      }
    });
  }
});

async function setupOffscreen() {
  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existingContexts.length > 0) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Hardware communication'
    });
  } catch (err) {
    if (!err.message.includes('single offscreen document')) {
      console.error('Offscreen setup error:', err);
    }
  }
}

setupOffscreen();
// Also create the offscreen document as soon as the browser launches, rather than
// waiting for the first runtime message to wake this service worker - that wait
// is what let popup/options query GET_STATUS before the offscreen document existed.
chrome.runtime.onStartup.addListener(setupOffscreen);

// Toolbar icon reflects whether a non-expired cached fix exists, so the user
// knows at a glance whether they need to connect a GPS dongle or raise the
// cache duration in options.
const ICON_OK = { 16: 'icons/icon128.png', 48: 'icons/icon128.png', 128: 'icons/icon128.png' };
const ICON_STALE = { 16: 'icons/icon128-nodata.png', 48: 'icons/icon128-nodata.png', 128: 'icons/icon128-nodata.png' };
const DEFAULT_CACHE_DURATION_MS = 900000; // keep in sync with options.js default
const HEARTBEAT_ALARM = 'gps-icon-heartbeat';
const STALE_ALARM = 'gps-icon-stale-at';

async function updateIcon() {
  const { lastLocation, cacheDuration } = await chrome.storage.local.get(['lastLocation', 'cacheDuration']);
  const duration = cacheDuration === undefined ? DEFAULT_CACHE_DURATION_MS : cacheDuration;
  const fresh = !!lastLocation && (duration === -1 || (Date.now() - lastLocation.timestamp) < duration);
  chrome.action.setIcon({ path: fresh ? ICON_OK : ICON_STALE }).catch(() => {});

  // Schedule a one-shot alarm for the exact moment the cached fix expires, so the
  // icon flips promptly instead of waiting for the next heartbeat alarm.
  chrome.alarms.clear(STALE_ALARM);
  if (lastLocation && duration !== -1) {
    const staleAt = lastLocation.timestamp + duration;
    if (staleAt > Date.now()) chrome.alarms.create(STALE_ALARM, { when: staleAt });
  }
}

chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM || alarm.name === STALE_ALARM) updateIcon();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.lastLocation || changes.cacheDuration)) updateIcon();
});

updateIcon();
