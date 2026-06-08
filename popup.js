async function updateStatus() {
  const statusEl = document.getElementById('status');
  const ports = await navigator.serial.getPorts();
  
  if (ports.length > 0) {
    const info = ports[0].getInfo();
    const vid = info.usbVendorId ? info.usbVendorId.toString(16).toUpperCase().padStart(4, '0') : '????';
    const pid = info.usbProductId ? info.usbProductId.toString(16).toUpperCase().padStart(4, '0') : '????';
    statusEl.className = 'success';
    statusEl.innerText = `USB serial device selected: VID 0x${vid} / PID 0x${pid}`;
  } else {
    statusEl.className = 'error';
    statusEl.innerText = "USB serial device not selected.";
  }
}

document.addEventListener('DOMContentLoaded', updateStatus);
