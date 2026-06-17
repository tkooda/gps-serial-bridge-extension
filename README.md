# GPS Serial Bridge (Chrome extension)
A simple [Chrome extension](https://github.com/tkooda/gps-serial-bridge-extension/releases/download/v1.0.2/gps-serial-bridge-v1.0.2.zip) for seeding the `navigator.geolocation` property with NEMA GPS location data from a USB serial GPS dongle.

This allows you to use an external USB GPS Serial Dongle (e.g. GlobalSat BU-353 Series, VK-162 / VK-172 G-Mouse Dongles, Garmin GPS 18x USB, Adafruit Ultimate GPS with USB) to provide a Chrome browser on a device (e.g. a Chromebook) without an internal GPS chip with accurate local GPS coordinate data.

# Install
You can install an [unpacked zip](https://github.com/tkooda/gps-serial-bridge-extension/releases/download/v1.0.2/gps-serial-bridge-v1.0.2.zip) from the [releases](https://github.com/tkooda/gps-serial-bridge-extension/releases), but Chrome will show you a persistent "Disable developer mode extensions" popup every time you start it.

The recommended method is to install it directly via the [Google Web Store](https://chrome.google.com/webstore/detail/jekeilmcchdcmodcmknhdehocdgdkcbl), to avoid the warning and to receive updates.

# Privacy & Data Usage
This extension reads GPS location data (NMEA sentences) directly from your locally connected USB hardware via the Web Serial API. All processing occurs locally within your browser. No data is ever transmitted, logged, or shared with external servers.
