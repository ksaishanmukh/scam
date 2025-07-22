// content.js
// This script runs in the context of the web page and can access localStorage

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.type === 'AUDIT_LOCAL_STORAGE') {
      const items = Object.keys(localStorage).map(key => ({ key, value: localStorage.getItem(key) }));
      sendResponse({ items });
      return true;
    }
    if (request.type === 'UPDATE_LOCAL_STORAGE') {
      try {
        localStorage.setItem(request.key, request.value);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e && e.message ? e.message : 'Unknown error' });
      }
      return true;
    }
  } catch (e) {
    sendResponse({ success: false, error: e && e.message ? e.message : 'Unknown error' });
    return true;
  }
  return false;
});
