// Content Script - Injects UI and handles text replacement

console.log('[Content] SapienWrite content script loaded');

// Create notification container
function createNotificationContainer() {
  if (document.getElementById('sapienwrite-notification-container')) {
    return document.getElementById('sapienwrite-notification-container');
  }
  
  const container = document.createElement('div');
  container.id = 'sapienwrite-notification-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    pointer-events: none;
  `;
  document.body.appendChild(container);
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
document.head.appendChild(style);

// Track last selected range
let lastSelection = null;

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    lastSelection = {
      text: selection.toString(),
      range: selection.getRangeAt(0)
    };
  }
});

// Replace text in DOM
function replaceSelectedText(originalText, humanizedText) {
  const selection = window.getSelection();
  
  if (!selection.rangeCount) {
    console.log('[Content] No selection range');
    // Try to use last selection
    if (lastSelection && lastSelection.text === originalText) {
      const range = lastSelection.range;
      range.deleteContents();
      range.insertNode(document.createTextNode(humanizedText));
      showNotification('Text humanized successfully!', 'success');
      return;
    }
    showNotification('Could not replace text. Please try again.', 'error');
    return;
  }
  
  const range = selection.getRangeAt(0);
  
  // Verify selected text matches
  if (range.toString() === originalText) {
    range.deleteContents();
    range.insertNode(document.createTextNode(humanizedText));
    showNotification('Text humanized successfully!', 'success');
    
    // Clear selection
    selection.removeAllRanges();
  } else {
    // Text doesn't match, try to find and replace in editable elements
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const text = activeElement.value;
      
      if (text.substring(start, end) === originalText) {
        activeElement.value = text.substring(0, start) + humanizedText + text.substring(end);
        showNotification('Text humanized successfully!', 'success');
        return;
      }
    }
    
    // Try contenteditable
    if (activeElement && activeElement.isContentEditable) {
      const text = activeElement.innerText;
      if (text.includes(originalText)) {
        activeElement.innerText = text.replace(originalText, humanizedText);
        showNotification('Text humanized successfully!', 'success');
        return;
      }
    }
    
    console.log('[Content] Could not find matching text to replace');
    showNotification('Could not replace text. Please copy the result from clipboard.', 'info');
    
    // Copy to clipboard as fallback
    navigator.clipboard.writeText(humanizedText).then(() => {
      showNotification('Humanized text copied to clipboard!', 'success');
    });
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Message received:', message);
  
  if (message.action === 'showNotification') {
    showNotification(message.message, message.type || 'info');
  }
  
  if (message.action === 'replaceText') {
    replaceSelectedText(message.originalText, message.humanizedText);
  }
  
  sendResponse({ received: true });
});

console.log('[Content] SapienWrite ready');
