let activePort = null;
let reader = null;

async function autoConnect() {
  const ports = await navigator.serial.getPorts();
  if (ports.length > 0 && !activePort) {
    connectToPort(ports[0]);
  }
}

async function connectToPort(port) {
  try {
    activePort = port;
    await port.open({ baudRate: 9600 });
    readStream(port);
  } catch (err) {
    activePort = null;
    console.error("Serial connection failed:", err);
  }
}

async function readStream(port) {
  const decoder = new TextDecoderStream();
  const inputDone = port.readable.pipeTo(decoder.writable);
  reader = decoder.readable.getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        let lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          parseNMEA(line);
        }
      }
    }
  } catch (err) {
    console.error("Stream reader error:", err);
  } finally {
    reader.releaseLock();
    activePort = null;
  }
}

function parseNMEA(line) {
  if (!line.startsWith('$')) return;
  const parts = line.split(',');
  const type = parts[0];
  let lat = null, lng = null;

  if (type.endsWith('RMC') && parts[2] === 'A') {
    lat = convertToDecimal(parts[3], parts[4]);
    lng = convertToDecimal(parts[5], parts[6]);
  } else if (type.endsWith('GGA') && parseInt(parts[6]) > 0) {
    lat = convertToDecimal(parts[2], parts[3]);
    lng = convertToDecimal(parts[4], parts[5]);
  }

  if (lat !== null && lng !== null) {
    chrome.runtime.sendMessage({
      type: 'GPS_PARSED',
      coords: { latitude: lat, longitude: lng, accuracy: 3 }
    });
  }
}

function convertToDecimal(nmeaVal, direction) {
  if (!nmeaVal || !direction) return null;
  const dotIdx = nmeaVal.indexOf('.');
  if (dotIdx === -1) return null;
  const degLen = dotIdx - 2;
  const degrees = parseFloat(nmeaVal.substring(0, degLen));
  const minutes = parseFloat(nmeaVal.substring(degLen));
  let decimal = degrees + (minutes / 60);
  return (direction === 'S' || direction === 'W') ? -decimal : decimal;
}

setInterval(autoConnect, 5000); // Poll for connection if not established
autoConnect();
