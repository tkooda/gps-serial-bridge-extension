let currentPort = null;
let reader = null;
let keepReading = false;
let nmeaBuffer = "";
let lastLocationCache = null;

// Restore the last known fix from persistent storage so popup/options show the
// correct cached location even after the offscreen document itself was recreated
// (e.g. a full extension reload), not just after a service worker restart.
if (chrome.storage?.local) {
  chrome.storage.local.get(['lastLocation'], (res) => {
    if (res.lastLocation && !lastLocationCache) lastLocationCache = res.lastLocation;
  });
}

// Move helper to global scope so it's always accessible
function toDec(s, d) {
  if (!s) return "0.000000";
  const dot = s.indexOf('.');
  if (dot === -1) return "0.000000";
  const deg = parseFloat(s.substring(0, dot - 2));
  const min = parseFloat(s.substring(dot - 2));
  const val = deg + (min / 60);
  return (d === 'S' || d === 'W') ? (-val).toFixed(6) : val.toFixed(6);
}

async function disconnectDevice() {
  keepReading = false;
  if (reader) { 
    try { await reader.cancel(); } catch (e) {} 
    try { reader.releaseLock(); } catch (e) {}
    reader = null; 
  }
  if (currentPort) { 
    try { await currentPort.close(); } catch (e) {} 
    currentPort = null; 
  }
}

async function connectToDevice(requestedBaudRate) {
  await disconnectDevice();
  const ports = await navigator.serial.getPorts();
  if (ports.length === 0) return { success: false, state: 'DISCONNECTED' };

  // Prioritize the most recently granted port instead of always selecting index 0
  currentPort = ports[ports.length - 1];
  let finalBaudRate = requestedBaudRate ? parseInt(requestedBaudRate, 10) : 9600;

  // Use optional chaining for storage access
  if (chrome.storage?.local) {
    try {
      const res = await chrome.storage.local.get(['baudRate']);
      if (res.baudRate) finalBaudRate = parseInt(res.baudRate, 10);
    } catch (e) {}
  }

  try {
    if (!currentPort.opened) {
      await currentPort.open({ baudRate: finalBaudRate });
    }
    keepReading = true;
    readLoop();
    return { success: true, state: 'STREAMING' };
  } catch (err) {
    currentPort = null;
    return { success: false, state: 'DISCONNECTED' };
  }
}

async function readLoop() {
  if (!currentPort || !currentPort.readable) return;
  const textDecoder = new TextDecoderStream();
  try {
    currentPort.readable.pipeTo(textDecoder.writable).catch(()=>{});
    reader = textDecoder.readable.getReader();
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chrome.runtime.sendMessage({ type: 'SERIAL_DATA', data: value }).catch(() => {});
        nmeaBuffer += value;
        const lines = nmeaBuffer.split('\n');
        nmeaBuffer = lines.pop();
        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.length > 0) parseNMEASentence(cleanLine);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'NetworkError' && err.message !== 'The device has been lost.') console.error("Read loop failure:", err);
  } finally {
    await disconnectDevice();
    broadcastState();
  }
}

function parseNMEASentence(sentence) {
  const parts = sentence.split(',');
  const header = parts[0];
  if (header.match(/^\$[A-Z]{2}(GGA|RMC)/)) {
    let latStr, ns, lonStr, ew, hdop;
    if (header.endsWith('GGA')) { 
      latStr = parts[2]; ns = parts[3]; lonStr = parts[4]; ew = parts[5]; hdop = parseFloat(parts[8]); 
    } else if (header.endsWith('RMC')) { 
      latStr = parts[3]; ns = parts[4]; lonStr = parts[5]; ew = parts[6]; 
    }
    
    if (latStr && lonStr) {
      lastLocationCache = { lat: toDec(latStr, ns), lon: toDec(lonStr, ew), hdop: hdop, timestamp: Date.now() };
      chrome.runtime.sendMessage({ action: 'NEW_LOCATION', data: lastLocationCache }).catch(()=>{});
    }
  }
}

async function broadcastState() {
  let state = (currentPort && currentPort.readable) ? 'STREAMING' : 'DISCONNECTED';
  chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', state }).catch(()=>{});
  return state;
}

navigator.serial.addEventListener('disconnect', async () => { 
  await disconnectDevice();
  broadcastState(); 
});

async function supervisorLoop() {
  while (true) {
    await broadcastState();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'CONNECT') {
    connectToDevice(msg.baudRate).then(res => sendResponse(res));
    return true;
  }
  if (msg.action === 'DISCONNECT') {
    disconnectDevice().then(() => sendResponse({ state: 'DISCONNECTED' }));
    return true;
  }
  if (msg.action === 'GET_STATUS') {
    broadcastState().then(state => sendResponse({ state, location: lastLocationCache }));
    return true;
  }
});

supervisorLoop();