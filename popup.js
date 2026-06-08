document.getElementById('connect').addEventListener('click', async () => {
  try {
    await navigator.serial.requestPort();
    document.getElementById('status').innerText = "Port authorized.\nConnecting...";
    chrome.runtime.sendMessage({ type: 'PORT_AUTHORIZED' });
  } catch (err) {
    document.getElementById('status').innerText = `Error: ${err.message}`;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GPS_PARSED') {
    document.getElementById('status').innerText = `Active Fix:\nLat: ${message.coords.latitude.toFixed(5)}\nLng: ${message.coords.longitude.toFixed(5)}`;
  }
});
