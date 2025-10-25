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
let selectedTone = 'regular'; // Track currently selected tone for display
let selectedToneIntensity = 'strong'; // Track selected tone intensity

// Track selections in contenteditable
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    let currentNode = container.nodeType === 3 ? container.parentElement : container;
    
    // Find the contenteditable container
    while (currentNode) {
      if (currentNode.isContentEditable) {
        lastSelection = {
          text: selection.toString(),
          range: range.cloneRange(),
          container: currentNode,
          // Store element identifiers for verification
          elementId: currentNode.id || null,
          elementClass: currentNode.className || null,
          elementTagName: currentNode.tagName || null
        };
        console.log('[Content] Selection stored:', {
          text: lastSelection.text.substring(0, 50),
          tagName: currentNode.tagName,
          id: currentNode.id,
          className: currentNode.className
        });
        return;
      }
      currentNode = currentNode.parentElement;
    }
    
    // If not contenteditable, just store range
    lastSelection = {
      text: selection.toString(),
      range: range.cloneRange()
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
      const start = t.selectionStart ?? 0;
      const end = t.selectionEnd ?? 0;
      lastInputSelection = {
        element: t,
        start,
        end,
        valueSnapshot: t.value,
        text: typeof t.value === 'string' ? t.value.substring(start, end) : ''
      };
  }
}, true);

document.addEventListener('contextmenu', () => {
  const t = document.activeElement;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    const start = t.selectionStart ?? 0;
    const end = t.selectionEnd ?? 0;
    lastInputSelection = {
      element: t,
      start,
      end,
      valueSnapshot: t.value,
      text: typeof t.value === 'string' ? t.value.substring(start, end) : ''
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
        text: typeof t.value === 'string' ? t.value.substring(start, end) : '',
        valueSnapshot: t.value,
        // Store element identifiers for verification
        elementId: t.id || null,
        elementClass: t.className || null,
        elementName: t.name || null,
        elementPlaceholder: t.placeholder || null
      };
      console.log('[Content] Input selection stored:', {
        text: t.value.substring(start, end).substring(0, 50),
        tagName: t.tagName,
        id: t.id,
        name: t.name,
        placeholder: t.placeholder
      });
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
  
  console.log('[Content] Attempting replacement', {
    hasInputSelection: !!lastInputSelection?.element,
    inputElement: lastInputSelection?.element?.tagName,
    hasLastSelection: !!lastSelection,
    hasContainer: !!lastSelection?.container,
    hasRange: !!lastSelection?.range,
    activeElement: document.activeElement?.tagName
  });
  
  // Helper function for similarity check
  function quickSimilarityCheck(a, b) {
    const aw = a.toLowerCase().trim().split(/\s+/);
    const bw = b.toLowerCase().trim().split(/\s+/);
    const matches = aw.filter(word => bw.includes(word)).length;
    return matches / Math.max(aw.length, bw.length);
  }
  
  try {
    // TIER 1: INPUT/TEXTAREA (direct value manipulation)
    const inputEl = lastInputSelection?.element ?? document.activeElement;
    if (inputEl?.tagName === 'TEXTAREA' || inputEl?.tagName === 'INPUT') {
      // Check if element is still in DOM
      if (!document.body.contains(inputEl)) {
        console.log('[Content] Input element no longer in DOM');
      } else {
        // VERIFY this is the correct element
        const isCorrectElement = lastInputSelection?.element === inputEl || (
          inputEl.id === lastInputSelection?.elementId &&
          inputEl.name === lastInputSelection?.elementName
        );
        
        if (!isCorrectElement && lastInputSelection?.element) {
          console.warn('[Content] Element mismatch detected!', {
            expected: {
              id: lastInputSelection.elementId,
              name: lastInputSelection.elementName,
              placeholder: lastInputSelection.elementPlaceholder
            },
            actual: {
              id: inputEl.id,
              name: inputEl.name,
              placeholder: inputEl.placeholder
            }
          });
          showNotification('⚠️ Wrong input field detected. Please select text again and retry.', 'info');
          return false;
        }
        
        const start = lastInputSelection?.start ?? inputEl.selectionStart;
        const end = lastInputSelection?.end ?? inputEl.selectionEnd;
        
        if (typeof start === 'number' && typeof end === 'number') {
          // Verify the original text is still at this location
          const currentText = inputEl.value.substring(start, end);
          const similarity = quickSimilarityCheck(originalText, currentText);
          
          if (similarity < 0.7) {
            console.warn('[Content] Original text not found at expected location', {
              expected: originalText.substring(0, 50),
              found: currentText.substring(0, 50)
            });
            showNotification('⚠️ Text has changed. Please select again and retry.', 'info');
            return false;
          }
          
          // Focus the element first
          try {
            inputEl.focus({ preventScroll: true });
          } catch (e) {
            inputEl.focus();
          }
          
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
          
          showNotification('✓ Text replaced in correct location!', 'success');
          return true;
        }
      }
    }
    
    // TIER 2: ContentEditable - restore selection and replace
    if (lastSelection?.range && lastSelection?.container) {
      try {
        const container = lastSelection.container;
        
        // Verify container is still in DOM
        if (!document.body.contains(container)) {
          console.log('[Content] Container no longer in DOM');
        } else {
          // VERIFY this is the correct container
          const isCorrectContainer = (
            (!lastSelection.elementId || container.id === lastSelection.elementId) &&
            (!lastSelection.elementClass || container.className === lastSelection.elementClass)
          );
          
          if (!isCorrectContainer) {
            console.warn('[Content] Container mismatch detected!');
            showNotification('⚠️ Wrong element detected. Please select text again and retry.', 'info');
            return false;
          }
          
          const range = lastSelection.range;
          
          // Focus the contenteditable container
          if (container.focus) {
            try {
              container.focus({ preventScroll: true });
            } catch (e) {
              container.focus();
            }
          }
        
        // Restore selection
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Try execCommand first
        const success = document.execCommand('insertText', false, humanizedText);
        
        if (success) {
          showNotification('Text replaced!', 'success');
          
          lastReplacement = {
            originalText: originalText,
            humanizedText: humanizedText
          };
          
          return true;
        }
        
        // If execCommand failed, manually replace
        console.log('[Content] execCommand failed, trying manual replacement');
        range.deleteContents();
        const textNode = document.createTextNode(humanizedText);
        range.insertNode(textNode);
        
        // Move caret to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Dispatch input events
        container.dispatchEvent(new Event('input', { bubbles: true }));
        container.dispatchEvent(new Event('change', { bubbles: true }));
        container.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        
        showNotification('Text replaced!', 'success');
        
        lastReplacement = {
          originalText: originalText,
          humanizedText: humanizedText
        };
        
        return true;
        }
        
      } catch (e) {
        console.log('[Content] ContentEditable replacement failed:', e.message);
      }
    }
    
    // TIER 3: Search for original text in active element
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
      const value = activeEl.value;
      const index = value.indexOf(originalText);
      
      if (index !== -1) {
        console.log('[Content] Found original text in active element');
        activeEl.focus();
        activeEl.value = value.substring(0, index) + humanizedText + value.substring(index + originalText.length);
        activeEl.selectionStart = activeEl.selectionEnd = index + humanizedText.length;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        lastReplacement = {
          originalText: originalText,
          humanizedText: humanizedText,
          element: activeEl,
          startIndex: index,
          endIndex: index + humanizedText.length
        };
        
        showNotification('Text replaced!', 'success');
        return true;
      }
    }
    
    // TIER 4: Clipboard fallback (final resort)
    console.log('[Content] Auto-replace blocked, using clipboard');
    navigator.clipboard.writeText(humanizedText).catch(() => {});
    showNotification('Text copied to clipboard - paste manually', 'info');
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
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    padding: 24px;
    max-width: 420px;
    width: 420px;
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
        <option value="grammar">Grammar Fix - Correct errors only</option>
      </select>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">Tone intensity</label>
      <select id="sapienwrite-tone-intensity" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer;">
        <option value="strong">Strong — clear changes</option>
        <option value="medium">Medium — balanced</option>
        <option value="light">Light — subtle</option>
      </select>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; font-size: 14px; color: #333; cursor: pointer;">
        <input type="checkbox" id="sapienwrite-force-rewrite" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
        <span><strong>Force rewrite</strong> (allow sentence reordering for stronger tone)</span>
      </label>
      <p style="margin: 4px 0 0 26px; font-size: 12px; color: #666;">Enabling this allows reordering sentences within paragraphs for clearer tone expression.</p>
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
    background: rgba(0,0,0,0.05);
    z-index: 2147483646;
    pointer-events: none;
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
  
  // Preselect default tone intensity
  const intensitySelect = document.getElementById('sapienwrite-tone-intensity');
  if (intensitySelect) {
    intensitySelect.value = 'strong';
  }
  
  // Event listeners
  document.getElementById('sapienwrite-close').onclick = closeDialog;
  document.getElementById('sapienwrite-cancel').onclick = closeDialog;
  backdrop.onclick = closeDialog;
  
  document.getElementById('sapienwrite-humanize').onclick = () => {
    const tone = document.getElementById('sapienwrite-tone').value;
    const toneIntensity = document.getElementById('sapienwrite-tone-intensity')?.value || 'strong';
    selectedTone = tone; // Store globally so we can display it in result
    selectedToneIntensity = toneIntensity;
    console.log(`[Content] 🎨 User selected tone: "${tone}" — intensity: "${toneIntensity}"`);
    safeChromeMessage({
      action: 'humanizeWithTone',
      text: text,
      tone: tone,
      toneIntensity: toneIntensity
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
  console.log('[Content] 🎬 showProcessing() CALLED');
  console.log('[Content] Document ready state:', document.readyState);
  console.log('[Content] Body exists:', !!document.body);
  
  // Check if dialog exists, create minimal one if not
  let dialog = document.getElementById('sapienwrite-dialog');
  console.log('[Content] Existing dialog:', !!dialog);
  
  if (!dialog) {
    console.log('[Content] Creating new dialog...');
    dialog = document.createElement('div');
    dialog.id = 'sapienwrite-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647 !important;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      padding: 24px;
      max-width: 420px;
      width: 420px;
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
      background: rgba(0,0,0,0.05);
      z-index: 2147483646 !important;
      pointer-events: none;
    `;
    
    console.log('[Content] Appending backdrop and dialog to body...');
    safeAppendToBody(backdrop);
    safeAppendToBody(dialog);
    console.log('[Content] ✅ Dialog appended');
  }
  
  const content = document.getElementById('sapienwrite-dialog-content');
  if (!content) {
    console.error('[Content] ❌ No content div found!');
    return;
  }
  
  console.log('[Content] Setting spinner HTML...');
  content.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e0e0e0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p style="margin: 12px 0 0; color: #666; font-size: 14px;">Humanizing your text...</p>
      <button id="sapienwrite-cancel-processing" style="margin-top: 16px; padding: 8px 16px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
    </div>
  `;
  
  // Add cancel button handler
  const cancelBtn = document.getElementById('sapienwrite-cancel-processing');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      console.log('[Content] User clicked cancel');
      safeChromeMessage({ action: 'cancelHumanize' });
      closeDialog();
    };
  }
  
  // Add animation
  if (!document.getElementById('sapienwrite-spin-style')) {
    const style = document.createElement('style');
    style.id = 'sapienwrite-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    safeAppendToHead(style);
  }
  
  console.log('[Content] ✅ Spinner shown successfully');
  
  // Send acknowledgment that processing UI is rendered
  safeChromeMessage({ action: 'processingAck' });
  
  // Safety timeout: auto-close after 25 seconds if still showing spinner
  setTimeout(() => {
    const stillProcessing = document.getElementById('sapienwrite-cancel-processing');
    if (stillProcessing) {
      console.warn('[Content] Processing timeout - closing dialog');
      closeDialog();
      showNotification('Request timed out. Please try again.', 'error');
    }
  }, 25000);
}

// Simple word diff calculator
function getWordDiff(original, humanized) {
  const origWords = original.toLowerCase().split(/\s+/).filter(Boolean);
  const humWords = humanized.toLowerCase().split(/\s+/).filter(Boolean);
  const origSet = new Set(origWords);
  const humSet = new Set(humWords);
  
  const removed = origWords.filter(w => !humSet.has(w)).length;
  const added = humWords.filter(w => !origSet.has(w)).length;
  const total = Math.max(origWords.length, humWords.length);
  const changePct = Math.round(((removed + added) / (total * 2)) * 100);
  
  return { removed, added, changePct };
}

function showResult(originalText, humanizedText) {
  console.log('[Content] showResult() called with:', {
    originalLength: originalText?.length,
    humanizedLength: humanizedText?.length
  });
  
  let dialog = document.getElementById('sapienwrite-dialog');
  console.log('[Content] Existing dialog:', !!dialog);
  
  // If no dialog exists, create a minimal one (resilient for Gmail etc)
  if (!dialog) {
    console.log('[Content] No dialog exists, creating minimal container for result');
    dialog = document.createElement('div');
    dialog.id = 'sapienwrite-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      padding: 24px;
      max-width: 420px;
      width: 420px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">Humanize Result</h3>
        <button id="sapienwrite-close" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; color: #999;">×</button>
      </div>
      <div id="sapienwrite-dialog-content" style="min-height: 50px;"></div>
    `;
    
    const backdrop = document.createElement('div');
    backdrop.id = 'sapienwrite-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.05);
      z-index: 2147483646;
      pointer-events: none;
    `;
    
    safeAppendToBody(backdrop);
    safeAppendToBody(dialog);
    console.log('[Content] Dialog and backdrop appended to body');
    
    document.getElementById('sapienwrite-close').onclick = closeDialog;
    backdrop.onclick = closeDialog;
  }
  
  const content = dialog.querySelector('#sapienwrite-dialog-content') || document.getElementById('sapienwrite-dialog-content');
  if (!content) return;
  
  // Map tone to display name
  const toneDisplayNames = {
    'regular': 'Regular',
    'formal': 'Formal/Academic',
    'persuasive': 'Persuasive/Sales',
    'empathetic': 'Empathetic/Warm',
    'sarcastic': 'Sarcastic',
    'funny': 'Funny'
  };
  
  const intensityDisplayNames = {
    'strong': 'Strong',
    'medium': 'Medium',
    'light': 'Light'
  };
  
  const toneDisplay = toneDisplayNames[selectedTone] || selectedTone;
  const intensityDisplay = intensityDisplayNames[selectedToneIntensity] || selectedToneIntensity;
  
  // Calculate word diff
  const diff = getWordDiff(originalText, humanizedText);
  
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="background: #dbeafe; border-left: 4px solid #2563eb; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
        <p style="margin: 0; font-size: 12px; color: #1e40af; font-weight: 600;">✓ Humanized with ${toneDisplay} tone — ${intensityDisplay}</p>
      </div>
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px;">
        <p style="margin: 0; font-size: 12px; color: #166534;">
          📊 Changes: ~${diff.changePct}% of words changed (${diff.removed} removed, ${diff.added} added)
        </p>
      </div>
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5; max-height: 200px; overflow-y: auto;">${humanizedText}</p>
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
  
  console.log('[Content] Result content populated, dialog should be visible now');
  
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
  let dialog = document.getElementById('sapienwrite-dialog');
  
  // If no dialog exists, create a minimal one (resilient for Gmail etc)
  if (!dialog) {
    console.log('[Content] No dialog exists, creating minimal container for error');
    dialog = document.createElement('div');
    dialog.id = 'sapienwrite-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      padding: 24px;
      max-width: 420px;
      width: 420px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">Error</h3>
        <button id="sapienwrite-close" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; color: #999;">×</button>
      </div>
      <div id="sapienwrite-dialog-content" style="min-height: 50px;"></div>
    `;
    
    const backdrop = document.createElement('div');
    backdrop.id = 'sapienwrite-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.05);
      z-index: 2147483646;
      pointer-events: none;
    `;
    
    safeAppendToBody(backdrop);
    safeAppendToBody(dialog);
    
    document.getElementById('sapienwrite-close').onclick = closeDialog;
    backdrop.onclick = closeDialog;
  }
  
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
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    padding: 32px;
    max-width: 420px;
    width: 420px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  `;
  
  const planNames = {
    free: 'Free',
    pro: 'Pro',
    wordsmith: 'Pro'
  };
  
  dialog.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
    <h3 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #1a1a1a;">Chrome Extension is Premium</h3>
    <p style="margin: 0 0 24px; font-size: 15px; color: #666; line-height: 1.6;">
      Humanize text anywhere on the web with our Chrome Extension. Available with <strong>Extension-Only ($12.95/mo)</strong> or <strong>Ultra</strong> plans.
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
    background: rgba(0,0,0,0.05);
    z-index: 2147483646;
    pointer-events: none;
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
  
  // Return last selection for fallback
  if (message.action === 'getLastSelection') {
    let text = '';
    if (lastInputSelection?.element) {
      const val = lastInputSelection.valueSnapshot ?? lastInputSelection.element.value ?? '';
      const s = lastInputSelection.start ?? 0;
      const e = lastInputSelection.end ?? 0;
      if (e > s) text = val.substring(s, e);
    }
    if (!text && lastSelection?.text) text = lastSelection.text;
    console.log('[Content] Returning last selection:', text.substring(0, 50));
    sendResponse({ text });
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
    console.log('[Content] 🎬 SHOW PROCESSING MESSAGE RECEIVED');
    console.log('[Content] Current URL:', window.location.href);
    console.log('[Content] Frame:', window === window.top ? 'TOP' : 'IFRAME');
    try {
      showProcessing();
      console.log('[Content] ✅ showProcessing() completed');
      try { chrome.runtime.sendMessage({ action: 'processingAck' }); } catch {}
    } catch (e) {
      console.error('[Content] ❌ showProcessing() failed:', e);
    }
  }
  
  if (message.action === 'showResult') {
    console.log('[Content] ===== SHOW RESULT CALLED =====');
    console.log('[Content] originalText:', message.originalText?.substring(0, 50));
    console.log('[Content] humanizedText:', message.humanizedText?.substring(0, 50));
    console.log('[Content] tone:', message.tone);
    console.log('[Content] toneIntensity:', message.toneIntensity);
    
    try {
      // Update selected tone from message if provided
      if (message.tone) {
        selectedTone = message.tone;
        console.log('[Content] Set selectedTone:', selectedTone);
      }
      if (message.toneIntensity) {
        selectedToneIntensity = message.toneIntensity;
        console.log('[Content] Set selectedToneIntensity:', selectedToneIntensity);
      }
      
      if (message.warning) {
        console.log('[Content] Showing warning:', message.warning);
        showNotification(message.warning, 'info');
      }
      
      console.log('[Content] Calling showResult()...');
      showResult(message.originalText, message.humanizedText);
      console.log('[Content] showResult() completed');
    } catch (error) {
      console.error('[Content] ERROR in showResult handler:', error);
      showNotification('Failed to display result: ' + error.message, 'error');
    }
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
