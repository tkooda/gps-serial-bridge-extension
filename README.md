# gps-serial-bridge-extension
A simple [Chrome extension](https://github.com/tkooda/gps-serial-bridge-extension/releases/download/v1.0.1/gps-serial-bridge-v1.0.1.zip) for seeding the navigator.geolocation property with NEMA GPS location data from a USB serial GPS dongle.

This allows you to use an external USB GPS Serial Dongle (e.g. GlobalSat BU-353 Series, VK-162 / VK-172 G-Mouse Dongles, Garmin GPS 18x USB, Adafruit Ultimate GPS with USB) to provide a Chrome browser on a device (e.g. a Chromebook) without an internal GPS chip with accurate local GPS coordinate data.

# Privacy & Data Usage
This extension reads GPS location data (NMEA sentences) directly from your locally connected USB hardware via the Web Serial API. All processing occurs locally within your browser. No data is ever transmitted, logged, or shared with external servers.
