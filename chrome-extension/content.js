// Content Script - Injects UI and handles text replacement

console.log('[Content] SapienWrite content script loaded');

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

// Helper functions for DOM path-based selection restoration
function getNodePath(node, root) {
  const path = [];
  let n = node;
  while (n && n !== root) {
    const p = n.parentNode;
    if (!p) break;
    const idx = Array.from(p.childNodes).indexOf(n);
    if (idx === -1) break;
    path.unshift(idx);
    n = p;
  }
  return path;
}

function getNodeFromPath(root, path) {
  let n = root;
  for (const i of path) {
    n = n?.childNodes?.[i];
    if (!n) break;
  }
  return n;
}

function firstTextNodeIn(node) {
  if (!node) return null;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  return walker.nextNode();
}

function lastTextNodeIn(node) {
  if (!node) return null;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let last = null;
  let cur;
  while (cur = walker.nextNode()) last = cur;
  return last;
}

// Request session from web app on load - repeat for 5 seconds
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
    // Enhanced selection tracking for contenteditable with DOM path capture
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      const range = sel.getRangeAt(0);
      const selectedText = sel.toString();
      
      // Find the contenteditable container
      let container = range.commonAncestorContainer;
      let editableElement = null;
      let currentNode = container.nodeType === 3 ? container.parentElement : container;
      
      while (currentNode && !editableElement) {
        if (currentNode.isContentEditable) {
          editableElement = currentNode;
          break;
        }
        currentNode = currentNode.parentElement;
      }
      
      if (editableElement) {
        // Capture exact DOM paths for reliable restoration
        const sc = range.startContainer;
        const ec = range.endContainer;
        
        // Get text nodes if not already
        const startTextNode = sc.nodeType === 3 ? sc : firstTextNodeIn(sc) || sc;
        const endTextNode = ec.nodeType === 3 ? ec : lastTextNodeIn(ec) || ec;
        
        const startPath = getNodePath(startTextNode, editableElement);
        const endPath = getNodePath(endTextNode, editableElement);
        
        // Get surrounding context for fallback text matching
        const fullText = editableElement.innerText || editableElement.textContent || '';
        const selectedIndex = fullText.indexOf(selectedText);
        
        lastSelection = {
          text: selectedText,
          range: range.cloneRange(),
          container: editableElement,
          startPath: startPath,
          endPath: endPath,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          textBefore: selectedIndex >= 0 ? fullText.substring(Math.max(0, selectedIndex - 50), selectedIndex) : '',
          textAfter: selectedIndex >= 0 ? fullText.substring(selectedIndex + selectedText.length, selectedIndex + selectedText.length + 50) : '',
          timestamp: Date.now()
        };
        
        console.log('[Content] Path-based selection captured:', {
          textLength: selectedText.length,
          hasContainer: !!editableElement,
          hasPaths: startPath.length > 0 && endPath.length > 0
        });
      } else {
        // Fallback to simple selection
        lastSelection = {
          text: selectedText,
          range: range.cloneRange()
        };
      }
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

// Replace text in DOM - with path-based selection restoration
function replaceSelectedText(originalText, humanizedText) {
  closeDialog();
  
  // Safety check
  if (!humanizedText || humanizedText.trim() === '') {
    console.error('[Content] Empty humanized text, aborting');
    showNotification('Replacement failed: empty result', 'error');
    return false;
  }
  
  console.log('[Content] Attempting replacement:', {
    originalLength: originalText.length,
    humanizedLength: humanizedText.length,
    hasLastSelection: !!lastSelection,
    hasLastInputSelection: !!lastInputSelection
  });
  
  try {
    // PATH 1: INPUT/TEXTAREA (already works reliably)
    const useEl = lastInputSelection?.element ?? (
      (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') 
        ? document.activeElement 
        : null
    );
    const start = lastInputSelection?.start ?? useEl?.selectionStart;
    const end = lastInputSelection?.end ?? useEl?.selectionEnd;
    
    if (useEl && typeof start === 'number' && typeof end === 'number' && end >= start) {
      const value = useEl.value;
      useEl.value = value.substring(0, start) + humanizedText + value.substring(end);
      useEl.selectionStart = useEl.selectionEnd = start + humanizedText.length;
      useEl.dispatchEvent(new Event('input', { bubbles: true }));
      useEl.dispatchEvent(new Event('change', { bubbles: true }));
      useEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      lastReplacement = {
        originalText: originalText,
        humanizedText: humanizedText,
        element: useEl,
        startIndex: start,
        endIndex: start + humanizedText.length
      };
      console.log('[Content] ✓ Replaced in INPUT/TEXTAREA');
      showNotification('Text replaced successfully!', 'success');
      return true;
    }
    
    // PATH 2A: CONTENTEDITABLE with path-based restoration (PRIMARY)
    if (lastSelection?.container && lastSelection?.startPath && lastSelection?.endPath) {
      const editableElement = lastSelection.container;
      
      console.log('[Content] Trying path-based restoration');
      
      let startNode = getNodeFromPath(editableElement, lastSelection.startPath);
      let endNode = getNodeFromPath(editableElement, lastSelection.endPath);
      
      if (startNode && endNode) {
        // Ensure we have text nodes
        if (startNode.nodeType !== 3) {
          startNode = firstTextNodeIn(startNode) || startNode;
        }
        if (endNode.nodeType !== 3) {
          endNode = lastTextNodeIn(endNode) || endNode;
        }
        
        // Validate nodes are text nodes
        if (startNode.nodeType === 3 && endNode.nodeType === 3) {
          try {
            const range = document.createRange();
            const safeStartOffset = Math.min(lastSelection.startOffset, startNode.textContent?.length ?? 0);
            const safeEndOffset = Math.min(lastSelection.endOffset, endNode.textContent?.length ?? 0);
            
            range.setStart(startNode, safeStartOffset);
            range.setEnd(endNode, safeEndOffset);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            let success = false;
            
            // Try execCommand first
            try {
              success = document.execCommand('insertText', false, humanizedText);
              if (success) {
                console.log('[Content] ✓ path-restore via execCommand');
              }
            } catch (e) {
              console.log('[Content] execCommand failed:', e.message);
            }
            
            // Fallback to manual insertion
            if (!success) {
              range.deleteContents();
              const textNode = document.createTextNode(humanizedText);
              range.insertNode(textNode);
              
              // Move caret after inserted text
              range.setStartAfter(textNode);
              range.setEndAfter(textNode);
              selection.removeAllRanges();
              selection.addRange(range);
              
              console.log('[Content] ✓ path-restore via manual insertion');
            }
            
            // Trigger editor events
            editableElement.dispatchEvent(new Event('input', { bubbles: true }));
            editableElement.dispatchEvent(new Event('change', { bubbles: true }));
            editableElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            
            lastReplacement = {
              originalText: originalText,
              humanizedText: humanizedText,
              element: editableElement
            };
            
            showNotification('Text replaced successfully!', 'success');
            return true;
            
          } catch (e) {
            console.log('[Content] Path-based restoration failed:', e.message);
          }
        }
      }
    }
    
    // PATH 2B: CONTENTEDITABLE with context-based text matching (FALLBACK)
    if (lastSelection && lastSelection.container && lastSelection.text) {
      const editableElement = lastSelection.container;
      
      console.log('[Content] Path-restore failed, trying context-based matching');
      
      const fullText = editableElement.innerText || editableElement.textContent || '';
      let targetIndex = -1;
      
      // Try to find using context
      if (lastSelection.textBefore || lastSelection.textAfter) {
        const searchText = lastSelection.textBefore + lastSelection.text + lastSelection.textAfter;
        const searchIndex = fullText.indexOf(searchText);
        
        if (searchIndex !== -1) {
          targetIndex = searchIndex + lastSelection.textBefore.length;
          console.log('[Content] Found text using context matching');
        }
      }
      
      // Fallback: direct text search
      if (targetIndex === -1) {
        targetIndex = fullText.indexOf(lastSelection.text);
        console.log('[Content] Using direct text search, found at:', targetIndex);
      }
      
      if (targetIndex !== -1) {
        // Create new Range by walking the text nodes
        const range = document.createRange();
        let charCount = 0;
        let startNode = null, startOffset = 0;
        let endNode = null, endOffset = 0;
        let found = false;
        
        const walker = document.createTreeWalker(
          editableElement,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          const nodeLength = node.textContent.length;
          
          if (!startNode && charCount + nodeLength > targetIndex) {
            startNode = node;
            startOffset = targetIndex - charCount;
          }
          
          if (startNode && charCount + nodeLength >= targetIndex + lastSelection.text.length) {
            endNode = node;
            endOffset = (targetIndex + lastSelection.text.length) - charCount;
            found = true;
            break;
          }
          
          charCount += nodeLength;
        }
        
        if (found && startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          let success = false;
          
          // Try execCommand first
          try {
            success = document.execCommand('insertText', false, humanizedText);
            if (success) {
              console.log('[Content] ✓ context-restore via execCommand');
            }
          } catch (e) {
            console.log('[Content] execCommand failed:', e.message);
          }
          
          // Fallback to manual insertion
          if (!success) {
            range.deleteContents();
            const textNode = document.createTextNode(humanizedText);
            range.insertNode(textNode);
            
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            
            console.log('[Content] ✓ context-restore via manual insertion');
          }
          
          // Trigger editor events
          editableElement.dispatchEvent(new Event('input', { bubbles: true }));
          editableElement.dispatchEvent(new Event('change', { bubbles: true }));
          editableElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          
          lastReplacement = {
            originalText: originalText,
            humanizedText: humanizedText,
            element: editableElement
          };
          
          showNotification('Text replaced successfully!', 'success');
          return true;
        }
      }
    }
    
    // PATH 3: Clipboard fallback
    console.log('[Content] clipboard-fallback: No replacement method worked');
    try {
      navigator.clipboard.writeText(humanizedText);
      showNotification('Text copied to clipboard. Paste it to replace.', 'info');
    } catch (err) {
      showNotification('Please select the text again and try.', 'error');
    }
    return false;
    
  } catch (error) {
    console.error('[Content] Replacement error:', error);
    try {
      navigator.clipboard.writeText(humanizedText);
      showNotification('Text copied to clipboard. Paste it to replace.', 'info');
    } catch (err) {
      showNotification('Replacement failed. Please try again.', 'error');
    }
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
    
    // Use precise index-based restoration for INPUT/TEXTAREA
    if ((element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') && 
        typeof startIndex === 'number' && typeof endIndex === 'number') {
      const value = element.value;
      element.value = value.substring(0, startIndex) + originalText + value.substring(endIndex);
      element.selectionStart = element.selectionEnd = startIndex + originalText.length;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      showNotification('Original text restored!', 'success');
      lastReplacement = null;
      return;
    }
    
    // Fallback for contenteditable - use string replacement
    if (element.isContentEditable) {
      const textContent = element.textContent;
      const humanizedIndex = textContent.indexOf(humanizedText);
      
      if (humanizedIndex !== -1) {
        element.textContent = textContent.substring(0, humanizedIndex) + originalText + textContent.substring(humanizedIndex + humanizedText.length);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        showNotification('Original text restored!', 'success');
      } else {
        showNotification('Could not find text to restore', 'error');
      }
    }
    
    lastReplacement = null;
  } catch (error) {
    console.error('[Content] Error restoring text:', error);
    showNotification('Failed to restore text', 'error');
  }
}

// Create humanize dialog
function createDialog(text, wordCount, wordBalance) {
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
        <p style="margin: 4px 0 0; font-size: 14px; color: #666;">${wordCount} words • ${wordBalance} remaining</p>
      </div>
      <button id="sapienwrite-close" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; color: #999;">×</button>
    </div>
    
    <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 16px; max-height: 100px; overflow-y: auto;">
      <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">${truncatedText}</p>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">Tone</label>
      <select id="sapienwrite-tone" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer;">
        <option value="regular">Regular</option>
        <option value="professional">Professional</option>
        <option value="casual">Casual</option>
        <option value="academic">Academic</option>
        <option value="creative">Creative</option>
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
  
  // Event listeners
  document.getElementById('sapienwrite-close').onclick = closeDialog;
  document.getElementById('sapienwrite-cancel').onclick = closeDialog;
  backdrop.onclick = closeDialog;
  
  document.getElementById('sapienwrite-humanize').onclick = () => {
    const tone = document.getElementById('sapienwrite-tone').value;
    chrome.runtime.sendMessage({
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

// Show replacement notification with undo option
function showReplacementNotification(originalText, humanizedText) {
  const container = createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
    color: #166534;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;
  
  notification.innerHTML = `
    <span>✓ Text replaced!</span>
    <button id="sapienwrite-undo-btn" style="
      background: #ffffff;
      border: 1px solid #22c55e;
      color: #166534;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    ">Undo</button>
  `;
  
  container.appendChild(notification);
  
  // Undo button handler
  const undoBtn = notification.querySelector('#sapienwrite-undo-btn');
  undoBtn.onclick = () => {
    restoreOriginalText();
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  };
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 8000);
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
    chrome.runtime.sendMessage({
      action: 'storeSession',
      session: event.data.session
    });
  }
  
  if (event.data.type === 'SUBSCRIPTION_UPDATED') {
    console.log('[Content] Subscription updated, notifying background');
    chrome.runtime.sendMessage({ action: 'subscriptionUpdated' });
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
    createDialog(message.text, message.wordCount, message.wordBalance);
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
    if (replaced) {
      showReplacementNotification(message.originalText, message.humanizedText);
    }
  }
  
  if (message.action === 'showUpgradeRequired') {
    showUpgradeRequiredDialog(message.currentPlan);
  }
  
  sendResponse({ received: true });
});

console.log('[Content] SapienWrite ready');
