chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'NEW_LOCATION') {
    chrome.tabs.query({}, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_LOCATION', data: message.data }).catch(() => {});
      }
    });
  }
});

async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Hardware communication'
  });
}

setupOffscreen();