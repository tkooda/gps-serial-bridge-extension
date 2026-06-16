const authBtn = document.getElementById('auth-btn');
const statusEl = document.getElementById('status');
const parsedDataContainer = document.getElementById('parsed-data-container');
const latLonEl = document.getElementById('lat-lon');
const plusCodeEl = document.getElementById('plus-code');
const coordHeader = document.getElementById('coord-header');
const copyLatLonBtn = document.getElementById('copy-latlon-btn');
const copyPlusBtn = document.getElementById('copy-plus-btn');

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

function updateAgeTimer() {
  if (!lastLocationData) return;
  const ageSecs = Math.floor((Date.now() - lastLocationData.timestamp) / 1000);
  
  if (currentDeviceState === 'STREAMING' && ageSecs < 4) {
    coordHeader.innerText = "Live GPS coordinates:";
  } else {
    coordHeader.innerText = `Last known GPS coordinates (${ageSecs} seconds ago):`;
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
  
  if (state === 'STREAMING') {
    statusEl.className = 'success';
    statusEl.innerText = "GPS Serial Bridge Active.";
    authBtn.innerText = "Disconnect GPS Device";
    parsedDataContainer.style.display = "block";
  } else {
    statusEl.className = 'error';
    statusEl.innerText = "USB GPS Device disconnected.";
    authBtn.innerText = "Connect GPS Device";
    if (!lastLocationData) parsedDataContainer.style.display = "none";
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
  } else {
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      await chrome.runtime.sendMessage({ action: 'CONNECT' });
    } else {
      chrome.runtime.openOptionsPage();
    }
  }
});

chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
  if (res) {
    updateUI(res.state);
    if (res.location) updateLocationUI(res.location);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'STATUS_UPDATE') updateUI(msg.state);
  if (msg.action === 'NEW_LOCATION') updateLocationUI(msg.data);
});