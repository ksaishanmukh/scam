// popup.js



// popup.js - Efficient, smooth, and robust popup rendering

// HTML escape utility
const escapeHTML = str => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Promisified sendMessage
const sendMessageToTab = (tabId, msg) => new Promise(resolve => {
  try {
    chrome.tabs.sendMessage(tabId, msg, resolve);
  } catch {
    resolve(undefined);
  }
});

// Render function for the popup
async function renderPopup(feedbackMsg = "") {
  const resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = `<div style="color:#888;padding:16px 0;">Loading...</div>`;

  // Get active tab
  let tab;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error();
    tab = activeTab;
  } catch {
    resultsDiv.innerHTML = `<div style="color:#b3261e;padding:16px 0;">Error: Unable to find active tab.</div>`;
    return;
  }

  // Get localStorage items from content script
  let response;
  try {
    response = await sendMessageToTab(tab.id, { type: 'AUDIT_LOCAL_STORAGE' });
  } catch {
    resultsDiv.innerHTML = `<div style="color:#b3261e;padding:16px 0;">Could not access local storage on this page.</div>`;
    return;
  }
  if (chrome.runtime.lastError || !response || !Array.isArray(response.items)) {
    resultsDiv.innerHTML = `<div style="color:#b3261e;padding:16px 0;">Could not access local storage on this page.</div>`;
    return;
  }

  // Extract <id> from URL (query param 'id' or last path segment)
  let urlId = '';
  try {
    const url = new URL(tab.url);
    urlId = url.searchParams.get('id') || url.pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    urlId = '';
  }
  if (!urlId) {
    resultsDiv.innerHTML = `<div style="color:#b3261e;padding:16px 0;">No ID found in the URL. Nothing to load.</div>`;
    return;
  }

  // Find the relevant localStorage item
  const key = `https://capgemini.tekstac.com_${urlId}`;
  const item = response.items.find(i => i && i.key === key);
  if (!item) {
    resultsDiv.innerHTML = `<div style="color:#b3261e;padding:16px 0;">No local storage item found with key "${escapeHTML(key)}".</div>`;
    return;
  }

  // Show only the question id (urlId) as the label, using theme color
  resultsDiv.innerHTML = `
    <label for="ls-value" style="font-weight:600;display:block;margin-bottom:8px;color:var(--fluent-text);">Question ID: <span style="color:var(--fluent-accent);">${escapeHTML(urlId)}</span></label>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="clipboard-toggle" style="accent-color:var(--fluent-accent);width:16px;height:16px;" />
        <span>Sync with Clipboard</span>
      </label>
      <span id="clipboard-status" style="font-size:12px;color:var(--fluent-text-secondary);"></span>
    </div>
    <textarea id="ls-value" style="width:100%;min-height:120px;max-height:320px;resize:vertical;font-family:Consolas,monospace;font-size:1em;padding:8px;border-radius:8px;border:1.5px solid var(--fluent-border);box-sizing:border-box;color:var(--fluent-text);background:var(--fluent-surface);">${escapeHTML(item.value)}</textarea>
    <button id="save-ls-value" class="fluent-save-btn" style="margin-top:12px;float:right;background:#888;cursor:not-allowed;" disabled>Save</button>
    <div style="clear:both"></div>
    ${feedbackMsg ? `<div style=\"color:${feedbackMsg.includes('Failed') ? '#b3261e' : 'var(--fluent-accent)'};padding:8px 0;\">${feedbackMsg}</div>` : ''}
  `;

  const textarea = document.getElementById('ls-value');
  const saveBtn = document.getElementById('save-ls-value');
  const clipboardToggle = document.getElementById('clipboard-toggle');
  const clipboardStatus = document.getElementById('clipboard-status');
  let originalValue = textarea.value;
  let clipboardInterval = null;

  textarea.addEventListener('input', () => {
    if (textarea.value !== originalValue) {
      saveBtn.disabled = false;
      saveBtn.style.background = '#0078d4';
      saveBtn.style.cursor = 'pointer';
    } else {
      saveBtn.disabled = true;
      saveBtn.style.background = '#888';
      saveBtn.style.cursor = 'not-allowed';
    }
  });

  function startClipboardSync() {
    clipboardStatus.textContent = 'Syncing...';
    clipboardStatus.style.color = 'var(--fluent-accent)';
    clipboardInterval = setInterval(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (typeof text === 'string' && textarea.value !== text) {
          textarea.value = text;
          textarea.dispatchEvent(new Event('input'));
          clipboardStatus.textContent = 'Synced!';
          clipboardStatus.style.color = 'var(--fluent-accent)';
        }
      } catch (e) {
        clipboardStatus.textContent = 'Clipboard access denied.';
        clipboardStatus.style.color = '#b3261e';
        stopClipboardSync();
      }
    }, 1000);
  }

  function stopClipboardSync() {
    if (clipboardInterval) {
      clearInterval(clipboardInterval);
      clipboardInterval = null;
    }
    clipboardStatus.textContent = '';
  }

  if (clipboardToggle) {
    clipboardToggle.addEventListener('change', () => {
      if (clipboardToggle.checked) {
        startClipboardSync();
      } else {
        stopClipboardSync();
      }
    });
  }

  saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;
    const newValue = textarea.value;
    let resp;
    try {
      resp = await sendMessageToTab(tab.id, { type: 'UPDATE_LOCAL_STORAGE', key, value: newValue });
    } catch {
      renderPopup('Failed to update local storage.');
      return;
    }
    if (chrome.runtime.lastError || !resp || !resp.success) {
      renderPopup('Failed to update local storage.');
    } else {
      renderPopup('Value updated!');
    }
  };
}

// Add refresh button event listener after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => renderPopup());
  }
  renderPopup();
});
