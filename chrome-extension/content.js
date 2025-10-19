// Content Script - Injects UI and handles text replacement

console.log('[Content] SapienWrite content script loaded');

// Extension context validation
let extensionContextValid = true;

function isExtensionContextValid() {
  try {
    const id = chrome.runtime?.id;
    if (!id) {
      extensionContextValid = false;
      return false;
    }
    return true;
  } catch (e) {
    extensionContextValid = false;
    return false;
  }
}

function safeChromeMessage(message, callback) {
  if (!isExtensionContextValid()) {
    showNotification('Extension updated. Please refresh this page.', 'info');
    return;
  }
  
  try {
    chrome.runtime.sendMessage(message, callback);
  } catch (error) {
    if (error.message?.includes('Extension context invalidated')) {
      extensionContextValid = false;
      showNotification('Extension updated. Please refresh this page.', 'info');
    } else {
      console.error('[Content] Message error:', error);
    }
  }
}

// Safe DOM append helpers
function safeAppendToHead(node) {
  if (document.head) {
    document.head.appendChild(node);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.head) document.head.appendChild(node);
    }, { once: true });
  }
}

function safeAppendToBody(node) {
  if (document.body) {
    document.body.appendChild(node);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) document.body.appendChild(node);
    }, { once: true });
  }
}

console.log('[Content] Starting session request broadcast (10 attempts over 5s)');
let requestAttempts = 0;
const maxAttempts = 10;
const requestInterval = setInterval(() => {
  if (requestAttempts >= maxAttempts) {
    console.log('[Content] Session request broadcast complete');
    clearInterval(requestInterval);
    return;
  }
  
  requestAttempts++;
  console.log(`[Content] Requesting session from web app (attempt ${requestAttempts}/${maxAttempts})`);
  window.postMessage({
    type: 'SAPIENWRITE_REQUEST_SESSION'
  }, '*');
}, 500);

// Create notification container
function createNotificationContainer() {
  const existing = document.getElementById('sapienwrite-notification-container');
  if (existing) return existing;
  
  const container = document.createElement('div');
  container.id = 'sapienwrite-notification-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    pointer-events: none;
  `;
  safeAppendToBody(container);
  return container;
}

// Show notification
function showNotification(message, type = 'info') {
  const container = createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `sapienwrite-notification sapienwrite-${type}`;
  notification.style.cssText = `
    background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#dbeafe'};
    color: ${type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af'};
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    animation: slideIn 0.3s ease;
    max-width: 320px;
  `;
  
  notification.textContent = message;
  container.appendChild(notification);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
safeAppendToHead(style);

// Track last selected range
let lastSelection = null;
let lastReplacement = null; // Track last replacement for undo
let lastInputSelection = null; // { element, start, end, valueSnapshot }

// Track selections in contenteditable
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    lastSelection = {
      text: selection.toString(),
      range: selection.getRangeAt(0).cloneRange()
    };
  }
});

// Keep selection fresh on selection change for contenteditable
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    let currentNode = container.nodeType === 3 ? container.parentElement : container;
    
    while (currentNode) {
      if (currentNode.isContentEditable) {
        lastSelection = {
          text: sel.toString(),
          range: range.cloneRange(),
          container: currentNode
        };
        break;
      }
      currentNode = currentNode.parentElement;
    }
  }
});

// Track selections in INPUT/TEXTAREA
document.addEventListener('select', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    lastInputSelection = {
      element: t,
      start: t.selectionStart ?? 0,
      end: t.selectionEnd ?? 0,
      valueSnapshot: t.value
    };
  }
}, true);

document.addEventListener('contextmenu', () => {
  const t = document.activeElement;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    lastInputSelection = {
      element: t,
      start: t.selectionStart ?? 0,
      end: t.selectionEnd ?? 0,
      valueSnapshot: t.value
    };
  } else {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      lastSelection = {
        text: sel.toString(),
        range: sel.getRangeAt(0).cloneRange()
      };
    }
  }
}, true);

document.addEventListener('keyup', () => {
  const t = document.activeElement;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    const start = t.selectionStart ?? 0;
    const end = t.selectionEnd ?? 0;
    if (end > start) {
      lastInputSelection = {
        element: t,
        start: start,
        end: end,
        valueSnapshot: t.value
      };
    }
  }
}, true);

// Simplified text replacement with 3-tier fallback
function replaceSelectedText(originalText, humanizedText) {
  closeDialog();
  
  if (!humanizedText?.trim()) {
    showNotification('Empty result, cannot replace', 'error');
    return false;
  }
  
  console.log('[Content] Attempting replacement');
  
  try {
    // TIER 1: INPUT/TEXTAREA (direct value manipulation)
    const inputEl = lastInputSelection?.element ?? document.activeElement;
    if (inputEl?.tagName === 'TEXTAREA' || inputEl?.tagName === 'INPUT') {
      const start = lastInputSelection?.start ?? inputEl.selectionStart;
      const end = lastInputSelection?.end ?? inputEl.selectionEnd;
      
      if (typeof start === 'number' && typeof end === 'number') {
        const value = inputEl.value;
        inputEl.value = value.substring(0, start) + humanizedText + value.substring(end);
        inputEl.selectionStart = inputEl.selectionEnd = start + humanizedText.length;
        
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        lastReplacement = {
          originalText: originalText,
          humanizedText: humanizedText,
          element: inputEl,
          startIndex: start,
          endIndex: start + humanizedText.length
        };
        
        showNotification('Text replaced!', 'success');
        return true;
      }
    }
    
    // TIER 2: ContentEditable with execCommand
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      try {
        const success = document.execCommand('insertText', false, humanizedText);
        
        if (success) {
          showNotification('Text replaced!', 'success');
          
          lastReplacement = {
            originalText: originalText,
            humanizedText: humanizedText
          };
          
          return true;
        }
      } catch (e) {
        console.log('[Content] execCommand blocked:', e.message);
      }
    }
    
    // TIER 3: Clipboard fallback
    console.log('[Content] Auto-replace blocked, using clipboard');
    navigator.clipboard.writeText(humanizedText).catch(() => {});
    return false;
    
  } catch (error) {
    console.error('[Content] Replacement error:', error);
    try {
      navigator.clipboard.writeText(humanizedText).catch(() => {});
    } catch {}
    return false;
  }
}

// Restore original text after replacement
function restoreOriginalText() {
  if (!lastReplacement) {
    showNotification('No text to restore', 'error');
    return;
  }
  
  try {
    const { originalText, humanizedText, element, startIndex, endIndex } = lastReplacement;
    
    if (element?.tagName === 'TEXTAREA' || element?.tagName === 'INPUT') {
      if (typeof startIndex === 'number' && typeof endIndex === 'number') {
        const value = element.value;
        element.value = value.substring(0, startIndex) + originalText + value.substring(endIndex);
        element.selectionStart = element.selectionEnd = startIndex + originalText.length;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        showNotification('Original text restored!', 'success');
        lastReplacement = null;
        return;
      }
    }
    
    showNotification('Undo not available for this editor', 'info');
    lastReplacement = null;
  } catch (error) {
    console.error('[Content] Error restoring text:', error);
    showNotification('Failed to restore text', 'error');
  }
}

// Create humanize dialog
function createDialog(text, wordCount, wordBalance, selectedTone = null) {
  // Remove existing dialog
  const existing = document.getElementById('sapienwrite-dialog');
  if (existing) existing.remove();
  
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999999;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    padding: 24px;
    max-width: 500px;
    width: 90%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;
  
  dialog.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
      <div>
        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">Humanize Text</h3>
        <p id="sapienwrite-usage-info" style="margin: 4px 0 0; font-size: 14px; color: #666;">${wordCount} words • ${wordBalance} remaining</p>
      </div>
      <button id="sapienwrite-close" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; color: #999;">×</button>
    </div>
    
    <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px; max-height: 100px; overflow-y: auto;">
      <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">${truncatedText}</p>
    </div>
    
    <div style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.4;">
        💡 Some editors block auto-replacement. Use <strong>Copy</strong> if needed.
      </p>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">Tone</label>
      <select id="sapienwrite-tone" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer;">
        <option value="regular">Regular - Natural, balanced</option>
        <option value="formal">Formal - Professional, scholarly</option>
        <option value="persuasive">Persuasive - Compelling, convincing</option>
        <option value="empathetic">Empathetic - Understanding, caring</option>
        <option value="sarcastic">Sarcastic - Witty, ironic</option>
        <option value="funny">Funny - Humorous, entertaining</option>
      </select>
    </div>
    
    <div id="sapienwrite-dialog-content" style="min-height: 50px;">
      <div style="display: flex; gap: 12px;">
        <button id="sapienwrite-humanize" style="flex: 1; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
          Humanize
        </button>
        <button id="sapienwrite-cancel" style="flex: 1; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  
  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sapienwrite-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999998;
  `;
  
  safeAppendToBody(backdrop);
  safeAppendToBody(dialog);
  
  // Set selected tone if provided
  if (selectedTone) {
    const toneSelect = document.getElementById('sapienwrite-tone');
    if (toneSelect) {
      toneSelect.value = selectedTone;
    }
  }
  
  // Event listeners
  document.getElementById('sapienwrite-close').onclick = closeDialog;
  document.getElementById('sapienwrite-cancel').onclick = closeDialog;
  backdrop.onclick = closeDialog;
  
  document.getElementById('sapienwrite-humanize').onclick = () => {
    const tone = document.getElementById('sapienwrite-tone').value;
    safeChromeMessage({
      action: 'humanizeWithTone',
      text: text,
      tone: tone
    });
  };
}

function closeDialog() {
  const dialog = document.getElementById('sapienwrite-dialog');
  const backdrop = document.getElementById('sapienwrite-backdrop');
  if (dialog) dialog.remove();
  if (backdrop) backdrop.remove();
}

function showProcessing() {
  // Check if dialog exists, create minimal one if not
  let dialog = document.getElementById('sapienwrite-dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'sapienwrite-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 24px;
      max-width: 500px;
      width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    dialog.innerHTML = `<div id="sapienwrite-dialog-content"></div>`;
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'sapienwrite-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999998;
    `;
    
    safeAppendToBody(backdrop);
    safeAppendToBody(dialog);
  }
  
  const content = document.getElementById('sapienwrite-dialog-content');
  if (!content) return;
  
  content.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e0e0e0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p style="margin: 12px 0 0; color: #666; font-size: 14px;">Humanizing your text...</p>
    </div>
  `;
  
  // Add animation
  if (!document.getElementById('sapienwrite-spin-style')) {
    const style = document.createElement('style');
    style.id = 'sapienwrite-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    safeAppendToHead(style);
  }
}

function showResult(originalText, humanizedText) {
  const dialog = document.getElementById('sapienwrite-dialog');
  if (!dialog) return;
  
  const content = dialog.querySelector('#sapienwrite-dialog-content') || document.getElementById('sapienwrite-dialog-content');
  if (!content) return;
  
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">${humanizedText}</p>
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="sapienwrite-replace" style="flex: 1; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
        Replace Text
      </button>
      <button id="sapienwrite-copy" style="flex: 1; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
        Copy
      </button>
      <button id="sapienwrite-close-result" style="flex: 1; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
        Close
      </button>
    </div>
  `;
  
  document.getElementById('sapienwrite-replace').onclick = () => {
    const replaced = replaceSelectedText(originalText, humanizedText);
    
    if (replaced) {
      // Show post-replacement UI with Restore option
      content.innerHTML = `
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 600;">✓ Text replaced successfully!</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="sapienwrite-restore" style="flex: 1; padding: 12px; background: #f59e0b; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ↶ Restore Original
          </button>
          <button id="sapienwrite-close-final" style="flex: 1; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            Close
          </button>
        </div>
      `;
      
      document.getElementById('sapienwrite-restore').onclick = () => {
        restoreOriginalText();
        closeDialog();
      };
      
      document.getElementById('sapienwrite-close-final').onclick = closeDialog;
      
      // Auto-close after 8 seconds
      setTimeout(closeDialog, 8000);
    } else {
      closeDialog();
    }
  };
  
  document.getElementById('sapienwrite-copy').onclick = () => {
    navigator.clipboard.writeText(humanizedText);
    showNotification('Copied to clipboard!', 'success');
    closeDialog();
  };
  
  document.getElementById('sapienwrite-close-result').onclick = closeDialog;
}

function showError(errorMessage) {
  const content = document.getElementById('sapienwrite-dialog-content');
  if (!content) return;
  
  content.innerHTML = `
    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;">${errorMessage}</p>
    </div>
    <button id="sapienwrite-close-error" style="width: 100%; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
      Close
    </button>
  `;
  
  document.getElementById('sapienwrite-close-error').onclick = closeDialog;
}


// Show upgrade required dialog
function showUpgradeRequiredDialog(currentPlan) {
  // Remove existing dialog
  const existing = document.getElementById('sapienwrite-dialog');
  if (existing) existing.remove();
  
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999999;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    padding: 32px;
    max-width: 480px;
    width: 90%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  `;
  
  const planNames = {
    free: 'Free',
    pro: 'Pro',
    wordsmith: 'Pro'
  };
  
  dialog.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
    <h3 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #1a1a1a;">Upgrade Required</h3>
    <p style="margin: 0 0 24px; font-size: 15px; color: #666; line-height: 1.6;">
      The Chrome Extension is available for <strong>Extension-Only</strong> and <strong>Ultra</strong> subscribers.
    </p>
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        Your current plan: <strong>${planNames[currentPlan] || currentPlan}</strong>
      </p>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="sapienwrite-view-upgrade" style="flex: 1; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
        View Upgrade Options
      </button>
      <button id="sapienwrite-cancel-upgrade" style="flex: 1; padding: 14px; background: #f5f5f5; color: #666; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
        Cancel
      </button>
    </div>
  `;
  
  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sapienwrite-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999998;
  `;
  
  safeAppendToBody(backdrop);
  safeAppendToBody(dialog);
  
  // Event listeners
  document.getElementById('sapienwrite-view-upgrade').onclick = () => {
    window.open('https://sapienwrite.com/pricing?from=extension', '_blank');
    closeDialog();
  };
  
  document.getElementById('sapienwrite-cancel-upgrade').onclick = closeDialog;
  backdrop.onclick = closeDialog;
}

// Listen for messages from background script
// Listen for messages from web page (fallback for session handoff)
window.addEventListener('message', (event) => {
  console.log('[Content] Message received:', event.data?.type);
  
  // Security: verify message is from same window
  if (event.source !== window) return;
  
  if (event.data.type === 'SAPIENWRITE_SESSION') {
    console.log('[Content] Received session from web app (fallback)');
    safeChromeMessage({
      action: 'storeSession',
      session: event.data.session
    });
  }
  
  if (event.data.type === 'SUBSCRIPTION_UPDATED') {
    console.log('[Content] Subscription updated, notifying background');
    safeChromeMessage({ action: 'subscriptionUpdated' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Message received:', message);
  
  // Relay session request from background to web page
  if (message.type === 'SAPIENWRITE_REQUEST_SESSION') {
    console.log('[Content] Relaying session request to web page');
    window.postMessage({ type: 'SAPIENWRITE_REQUEST_SESSION' }, '*');
    sendResponse({ received: true });
    return;
  }
  
  if (message.action === 'showNotification') {
    showNotification(message.message, message.type || 'info');
  }
  
  if (message.action === 'showDialog') {
    createDialog(message.text, message.wordCount, message.wordBalance, message.tone);
  }
  
  if (message.action === 'updateDialogUsage') {
    const usageInfo = document.getElementById('sapienwrite-usage-info');
    if (usageInfo) {
      const wordCount = usageInfo.textContent.split(' ')[0];
      usageInfo.textContent = `${wordCount} words • ${message.wordBalance} remaining`;
    }
  }
  
  if (message.action === 'showProcessing') {
    showProcessing();
  }
  
  if (message.action === 'showResult') {
    showResult(message.originalText, message.humanizedText);
  }
  
  if (message.action === 'showError') {
    showError(message.message);
  }
  
  if (message.action === 'replaceText') {
    const replaced = replaceSelectedText(message.originalText, message.humanizedText);
    if (!replaced) {
      // If replacement failed, show result dialog with copy option
      console.log('[Content] Replacement blocked, showing result dialog');
      showResult(message.originalText, message.humanizedText);
    }
  }
  
  if (message.action === 'showUpgradeRequired') {
    showUpgradeRequiredDialog(message.currentPlan);
  }
  
  sendResponse({ received: true });
});


console.log('[Content] SapienWrite ready');
