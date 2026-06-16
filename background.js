chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'NEW_LOCATION') {
    chrome.storage.local.set({ lastLocation: message.data }).catch(() => {});
    chrome.tabs.query({}, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_LOCATION', data: message.data }).catch(() => {});
      }
    });
  }
});

async function setupOffscreen() {
  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existingContexts.length > 0) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Hardware communication'
    });
  } catch (err) {
    if (!err.message.includes('single offscreen document')) {
      console.error('Offscreen setup error:', err);
    }
  }
}

setupOffscreen();