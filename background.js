let offscreenCreated = false;

async function setupOffscreen() {
  if (offscreenCreated) return;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) {
    offscreenCreated = true;
    return;
  }
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Maintains background Web Serial port execution loop.'
  });
  offscreenCreated = true;
}

chrome.runtime.onInstalled.addListener(setupOffscreen);
chrome.runtime.onStartup.addListener(setupOffscreen);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GPS_PARSED') {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'GPS_COORDINATES', coords: message.coords }).catch(() => {});
        }
      }
    });
  }
});
