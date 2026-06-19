const authBtn = document.getElementById('auth-btn');
const statusEl = document.getElementById('status');
const controls = document.getElementById('controls-container');
const parsedDataContainer = document.getElementById('parsed-data-container');
const dataLogEl = document.getElementById('serial-data-log');
const latLonEl = document.getElementById('lat-lon');
const plusCodeEl = document.getElementById('plus-code');
const coordHeader = document.getElementById('coord-header');
const copyLatLonBtn = document.getElementById('copy-latlon-btn');
const copyPlusBtn = document.getElementById('copy-plus-btn');
const toggleDataBtn = document.getElementById('toggle-data-btn');
const baudSelect = document.getElementById('baud-rate');
const cacheSelect = document.getElementById('cache-duration');

let isShowingData = false;
let lastLocationData = null;
let currentDeviceState = 'DISCONNECTED';

// Standard 10-character Plus Code encoder
function encodePlusCode(lat, lon) {
  const ALPHABET = "23456789CFGHJMPQRVWX";
  let latNorm = Math.max(-90, Math.min(90, lat)) + 90;
  let lonNorm = lon + 180;
  const steps = [20, 1, 0.05, 0.0025, 0.000125];
  let code = "";
  
  for (let i = 0; i < 5; i++) {
    let latDigit = Math.floor(latNorm / steps[i]);
    let lonDigit = Math.floor(lonNorm / steps[i]);
    code += ALPHABET[latDigit] + ALPHABET[lonDigit];
    latNorm -= latDigit * steps[i];
    lonNorm -= lonDigit * steps[i];
    if (i === 3) code += "+";
  }
  return code;
}

// Initialize settings
chrome.storage.local.get(['baudRate', 'cacheDuration'], (res) => {
  if (res.baudRate) baudSelect.value = res.baudRate;
  
  // Set default to 900000 (15 minutes) if no cache duration is stored
  const defaultCache = "900000";
  if (res.cacheDuration) {
    const val = res.cacheDuration.toString();
    cacheSelect.value = Array.from(cacheSelect.options).some(o => o.value === val) ? val : defaultCache;
  } else {
    cacheSelect.value = defaultCache;
  }
});

function formatDuration(totalSecs) {
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return `${parts.join(', ')} ago`;
}

function updateAgeTimer() {
  if (!lastLocationData) return;
  const ageSecs = Math.floor((Date.now() - lastLocationData.timestamp) / 1000);

  if (currentDeviceState === 'STREAMING' && ageSecs < 4) {
    coordHeader.innerText = "Live GPS coordinates:";
  } else {
    coordHeader.innerText = `Last known GPS coordinates (${formatDuration(ageSecs)}):`;
  }
}

setInterval(updateAgeTimer, 1000);

function updateLocationUI(loc) {
  if (!loc) return;
  lastLocationData = loc;
  
  latLonEl.innerText = `${loc.lat}, ${loc.lon}`;
  copyLatLonBtn.style.display = 'inline-block';
  
  plusCodeEl.innerText = encodePlusCode(parseFloat(loc.lat), parseFloat(loc.lon));
  copyPlusBtn.style.display = 'inline-block';

  updateAgeTimer();
  parsedDataContainer.style.display = "block";
}

function updateUI(state) {
  currentDeviceState = state;
  updateAgeTimer(); 
  
  controls.style.display = "flex";
  
  if (state === 'STREAMING') {
    statusEl.className = "success"; 
    statusEl.innerText = "GPS Serial Bridge Active.";
    authBtn.innerText = "Disconnect GPS Serial Device";
    toggleDataBtn.style.display = "inline-block";
    parsedDataContainer.style.display = "block";
  } else {
    statusEl.className = "error"; 
    statusEl.innerText = "USB GPS Serial Device disconnected.";
    authBtn.innerText = "Connect GPS Serial Device";
    toggleDataBtn.style.display = "none";
    if (!lastLocationData) parsedDataContainer.style.display = "none";
    dataLogEl.style.display = "none";
  }
}

function handleCopy(btn, textToCopy) {
  navigator.clipboard.writeText(textToCopy);
  const oldText = btn.innerText;
  btn.innerText = "Copied!";
  setTimeout(() => btn.innerText = oldText, 2000);
}

copyLatLonBtn.addEventListener('click', () => handleCopy(copyLatLonBtn, latLonEl.innerText));
copyPlusBtn.addEventListener('click', () => handleCopy(copyPlusBtn, plusCodeEl.innerText));

authBtn.addEventListener('click', async () => {
  if (authBtn.innerText.includes("Disconnect")) { 
    await chrome.runtime.sendMessage({ action: 'DISCONNECT' }); 
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      try { await port.forget(); } catch(e) {}
    }
    location.reload(); 
  } else { 
    try {
      await navigator.serial.requestPort(); 
      await chrome.runtime.sendMessage({ action: 'CONNECT', baudRate: baudSelect.value });
    } catch (e) {
      console.log("User cancelled selection or error:", e);
    }
  }
});

toggleDataBtn.addEventListener('click', () => {
  isShowingData = !isShowingData;
  dataLogEl.style.display = isShowingData ? 'block' : 'none';
  toggleDataBtn.innerText = isShowingData ? 'Hide serial data' : 'Show serial data';
});

baudSelect.addEventListener('change', () => { chrome.storage.local.set({ baudRate: baudSelect.value }).catch(() => {}); });

cacheSelect.addEventListener('change', () => {
  const val = parseInt(cacheSelect.value, 10);
  chrome.storage.local.set({ cacheDuration: val }).catch(() => {});
  chrome.tabs.query({}, (tabs) => {
    for (let tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_SETTINGS', data: { cacheDuration: val } }).catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'NEW_LOCATION') updateLocationUI(msg.data);
  if (msg.action === 'STATUS_UPDATE') updateUI(msg.state);
  if (msg.type === 'SERIAL_DATA' && isShowingData) {
    dataLogEl.value += msg.data;
    dataLogEl.scrollTop = dataLogEl.scrollHeight;
  }
});

// Read the cached fix straight from storage so it shows up immediately even if the
// offscreen document hasn't been (re)created yet (e.g. right after a browser restart),
// instead of depending solely on the GET_STATUS round trip below.
chrome.storage.local.get(['lastLocation'], (res) => {
  if (res.lastLocation) updateLocationUI(res.lastLocation);
});

chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
  if (chrome.runtime.lastError) return;
  if (res) {
    updateUI(res.state);
    if (res.location) updateLocationUI(res.location);
  }
});