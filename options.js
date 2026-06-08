const authBtn = document.getElementById('auth-btn');
const statusEl = document.getElementById('status');
const controlsContainer = document.getElementById('controls-container');
const toggleDataBtn = document.getElementById('toggle-data-btn');
const baudSelect = document.getElementById('baud-rate');
const dataLogEl = document.getElementById('serial-data-log');

let currentPort = null;
let reader = null;
let isShowingData = false;
let keepReading = false;

// Load saved baud rate from storage, default to 9600
chrome.storage.local.get(['baudRate'], (result) => {
  if (result.baudRate) {
    baudSelect.value = result.baudRate;
  } else {
    baudSelect.value = "9600";
  }
});

// Updates the top-level UI based on selected hardware
async function updateUI() {
  const ports = await navigator.serial.getPorts();
  
  if (ports.length > 0) {
    currentPort = ports[0];
    const info = currentPort.getInfo();
    const vid = info.usbVendorId ? info.usbVendorId.toString(16).toUpperCase().padStart(4, '0') : '????';
    const pid = info.usbProductId ? info.usbProductId.toString(16).toUpperCase().padStart(4, '0') : '????';
    
    authBtn.innerText = "Disconnect GPS Serial Device";
    statusEl.className = "success";
    statusEl.innerText = `USB serial device selected: VID 0x${vid} / PID 0x${pid}`;
    controlsContainer.style.display = "flex";
  } else {
    currentPort = null;
    authBtn.innerText = "Select GPS Serial Device";
    statusEl.className = "error";
    statusEl.innerText = "USB serial device not selected.";
    controlsContainer.style.display = "none";
    dataLogEl.style.display = "none";
    isShowingData = false;
    keepReading = false;
  }
}

// Safely close the port and reader
async function disconnectSerial() {
  keepReading = false;
  
  if (reader) {
    try {
      await reader.cancel();
    } catch (e) {
      console.log("Reader already cancelled:", e);
    }
    reader = null;
  }
  
  if (currentPort) {
    try {
      await currentPort.close();
    } catch (e) {
      // Ignore the error if the port is already closed
      console.log("Port already closed:", e);
    }
  }
}

// The Keep-Alive and Data Processing Loop
async function readSerialData() {
  if (!currentPort) return;

  try {
    const baudRate = parseInt(baudSelect.value, 10);
    
    if (!currentPort.readable) {
      await currentPort.open({ baudRate: baudRate });
    }

    const textDecoder = new TextDecoderStream();
    currentPort.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();
    keepReading = true;

    while (keepReading) {
      const { value, done } = await reader.read();
      
      if (done) {
        reader.releaseLock();
        break;
      }
      
      if (value && isShowingData) {
        dataLogEl.value += value;
        dataLogEl.scrollTop = dataLogEl.scrollHeight;
        
        if (dataLogEl.value.length > 10000) {
          dataLogEl.value = dataLogEl.value.substring(dataLogEl.value.length - 5000);
        }
      }
    }
  } catch (error) {
    console.error("Serial read error:", error);
    statusEl.className = "error";
    statusEl.innerText = "Serial connection lost: " + error.message;
    await disconnectSerial();
  }
}

// Handle Baud Rate changes dynamically
baudSelect.addEventListener('change', async () => {
  chrome.storage.local.set({ baudRate: baudSelect.value });
  
  // If the port is actively open, restart the connection with the new baud rate
  if (currentPort && currentPort.readable) {
    dataLogEl.value += `\n[System] Restarting connection at ${baudSelect.value} baud...\n`;
    await disconnectSerial();
    setTimeout(() => {
      if (isShowingData || toggleDataBtn.innerText === "Hide serial data") {
         readSerialData();
      }
    }, 500);
  }
});

// Handle the Show/Hide button logic
toggleDataBtn.addEventListener('click', async () => {
  isShowingData = !isShowingData;

  if (isShowingData) {
    toggleDataBtn.innerText = "Hide serial data";
    dataLogEl.style.display = "block";
    
    if (dataLogEl.value === "") {
        dataLogEl.value = `Witing for NMEA data at ${baudSelect.value} baud...\n`;
    }

    if (!reader || !keepReading) {
      readSerialData();
    }
  } else {
    toggleDataBtn.innerText = "Show serial data";
    dataLogEl.style.display = "none";
  }
});

// Handle Hardware Authorization / Disconnect
authBtn.addEventListener('click', async () => {
  try {
    if (currentPort) {
      // User is connected, they want to disconnect
      await disconnectSerial();
      
      // Revoke the browser's permission to use this serial device
      if (typeof currentPort.forget === 'function') {
        await currentPort.forget();
      }
      currentPort = null;
    } else {
      // User is not connected, prompt the picker
      await navigator.serial.requestPort();
    }
    
    // Reset data viewer state for both actions
    dataLogEl.value = "";
    isShowingData = false;
    toggleDataBtn.innerText = "Show serial data";
    dataLogEl.style.display = "none";
    
    updateUI();
  } catch (e) {
    statusEl.className = "error";
    statusEl.innerText = "Error: " + e.message;
  }
});

// Run on load
document.addEventListener('DOMContentLoaded', updateUI);
