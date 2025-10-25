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

// DOM-based structured text extraction (preserves paragraphs)
function extractStructuredText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  
  const range = selection.getRangeAt(0);
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());
  
  const paragraphs = [];
  let currentParagraph = '';
  
  // Recursive DOM walker
  function walk(node) {
    // Text node - append text
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) currentParagraph += (currentParagraph ? ' ' : '') + text;
      return;
    }
    
    // Element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toUpperCase();
      
      // Block-level elements = paragraph boundary
      const isBlock = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'TD', 'ARTICLE', 'SECTION'].includes(tagName);
      
      // BR tags = soft break (2+ = paragraph break)
      if (tagName === 'BR') {
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
        return;
      }
      
      // Process children first
      for (const child of node.childNodes) {
        walk(child);
      }
      
      // After processing children, if this is a block element, flush paragraph
      if (isBlock && currentParagraph) {
        paragraphs.push(currentParagraph);
        currentParagraph = '';
      }
    }
  }
  
  walk(container);
  
  // Flush any remaining text
  if (currentParagraph) {
    paragraphs.push(currentParagraph);
  }
  
  // Join with double newlines
  const structured = paragraphs.filter(p => p.trim()).join('\n\n');
  
  console.log('[Content] Extracted structured text:');
  console.log('  - Paragraphs found:', paragraphs.length);
  console.log('  - First 100 chars:', structured.substring(0, 100));
  
  return structured || selection.toString(); // Fallback to plain text
}

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
          elementTagName: currentNode.tagName || null,
          textLength: selection.toString().length  // NEW: for validation
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
  if (!humanizedText?.trim()) {
    showNotification('Empty result, cannot replace', 'error');
    return false;
  }
  
  console.log('[Content] Attempting replacement', {
    url: window.location.href,
    domain: window.location.hostname,
    hasInputSelection: !!lastInputSelection?.element,
    inputElement: lastInputSelection?.element?.tagName,
    hasLastSelection: !!lastSelection,
    hasContainer: !!lastSelection?.container,
    hasRange: !!lastSelection?.range,
    lastSelectionText: lastSelection?.text?.substring(0, 50),
    activeElement: document.activeElement?.tagName,
    activeElementType: document.activeElement?.getAttribute('contenteditable'),
    originalTextLength: originalText?.length,
    humanizedTextLength: humanizedText?.length
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
        
        // Try to add the stored range
        try {
          sel.addRange(range);
        } catch (e) {
          console.log('[Content] Stored range invalid, searching for text instead');
          
          // FALLBACK: Search for original text in container
          const containerText = container.textContent || container.innerText;
          const originalText = lastSelection.text;
          const startIndex = containerText.indexOf(originalText);
          
          if (startIndex === -1) {
            console.warn('[Content] Original text not found in container');
            // Continue to next tier
          } else {
            // Create new range by walking the DOM and finding the text position
            const newRange = document.createRange();
            let charCount = 0;
            let foundStart = false;
            let foundEnd = false;
            
            function walkTextNodes(node) {
              if (foundEnd) return;
              
              if (node.nodeType === Node.TEXT_NODE) {
                const nodeLength = node.textContent.length;
                
                if (!foundStart && charCount + nodeLength > startIndex) {
                  newRange.setStart(node, startIndex - charCount);
                  foundStart = true;
                }
                
                if (foundStart && !foundEnd && charCount + nodeLength >= startIndex + originalText.length) {
                  newRange.setEnd(node, startIndex + originalText.length - charCount);
                  foundEnd = true;
                }
                
                charCount += nodeLength;
              } else {
                for (const child of node.childNodes) {
                  walkTextNodes(child);
                }
              }
            }
            
            walkTextNodes(container);
            
            if (foundStart && foundEnd) {
              sel.addRange(newRange);
              console.log('[Content] Successfully created new range from text search');
            }
          }
        }
        
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
        
        // If execCommand failed, manually replace with color inheritance
        console.log('[Content] execCommand failed, trying manual replacement');
        
        // Get current selection (might be the new one we created)
        if (sel.rangeCount > 0) {
          const currentRange = sel.getRangeAt(0);
          currentRange.deleteContents();
          
          // Wrap text in span to force black color (fixes Gmail red text bug)
          const span = document.createElement('span');
          span.style.cssText = 'color: inherit !important; font-family: inherit !important;';
          const textNode = document.createTextNode(humanizedText);
          span.appendChild(textNode);
          currentRange.insertNode(span);
          
          // Move caret to end of inserted text
          currentRange.setStartAfter(span);
          currentRange.setEndAfter(span);
          sel.removeAllRanges();
          sel.addRange(currentRange);
          
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
        }
        
      } catch (e) {
        console.log('[Content] ContentEditable replacement failed:', e.message);
      }
    }
    
    // TIER 2.5: Shadow DOM support
    if (document.activeElement?.shadowRoot) {
      try {
        const shadowRoot = document.activeElement.shadowRoot;
        console.log('[Content] Checking Shadow DOM');
        
        // Search for contenteditable or input elements in shadow DOM
        const shadowEditables = shadowRoot.querySelectorAll('[contenteditable="true"], textarea, input');
        for (const el of shadowEditables) {
          const elText = el.value || el.textContent || el.innerText || '';
          if (elText.includes(originalText)) {
            console.log('[Content] Found text in Shadow DOM element:', el.tagName);
            
            // Try to replace
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
              const index = el.value.indexOf(originalText);
              if (index !== -1) {
                el.focus();
                el.value = el.value.substring(0, index) + humanizedText + el.value.substring(index + originalText.length);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                
                showNotification('Text replaced in Shadow DOM!', 'success');
                lastReplacement = { originalText, humanizedText };
                return true;
              }
            } else {
              // ContentEditable in shadow DOM
              const sel = shadowRoot.getSelection ? shadowRoot.getSelection() : window.getSelection();
              if (sel) {
                const range = document.createRange();
                const textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.includes(originalText));
                if (textNode) {
                  const index = textNode.textContent.indexOf(originalText);
                  range.setStart(textNode, index);
                  range.setEnd(textNode, index + originalText.length);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  
                  const success = document.execCommand('insertText', false, humanizedText);
                  if (success) {
                    showNotification('Text replaced in Shadow DOM!', 'success');
                    lastReplacement = { originalText, humanizedText };
                    return true;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('[Content] Shadow DOM replacement failed:', e.message);
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
    closeDialog(); // Close the result dialog before showing clipboard toast
    navigator.clipboard.writeText(humanizedText).catch(() => {});
    
    // Show dark toast notification (matching result dialog style)
    const toast = document.createElement('div');
    toast.id = 'sapienwrite-dialog';
    toast.style.cssText = `
      all: initial;
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      background: #111827 !important;
      color: #F9FAFB !important;
      padding: 14px !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      max-width: 350px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 8px !important;
    `;
    
    toast.innerHTML = `
      <div style="color: #10B981; font-size: 16px;">✓</div>
      <div style="flex: 1; line-height: 1.4;">Text copied to clipboard - paste manually</div>
    `;
    
    safeAppendToBody(toast);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
    
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

// Create humanize dialog - KEEP FULL VERSION (this is the initial picker)
function createDialog(text, wordCount, wordBalance, selectedTone = null) {
  closeDialog(); // Remove existing dialog
  
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #111827 !important;
    color: #F9FAFB !important;
    padding: 16px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    max-width: 360px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  `;
  
  const truncatedText = text.length > 80 ? text.substring(0, 80) + '...' : text;
  
  dialog.innerHTML = `
    <div>
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Humanize Text</div>
      <div style="font-size: 11px; color: #9CA3AF;">${wordCount} words • ${wordBalance} remaining</div>
    </div>
    
    <div style="background: #1F2937; padding: 10px; border-radius: 6px; max-height: 70px; overflow-y: auto;">
      <div style="font-size: 12px; line-height: 1.4; color: #D1D5DB;">${truncatedText}</div>
    </div>
    
    <div style="background: #374151; padding: 8px; border-radius: 6px; font-size: 11px; color: #FDE68A;">
      💡 Some editors block replacement. Use Copy if needed.
    </div>
    
    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Tone</label>
      <select id="sapienwrite-tone" style="width: 100%; padding: 8px; border: 1px solid #374151; border-radius: 6px; font-size: 12px; background: #1F2937; color: #F9FAFB; cursor: pointer;">
        <option value="regular">Regular</option>
        <option value="formal">Formal</option>
        <option value="persuasive">Persuasive</option>
        <option value="empathetic">Empathetic</option>
        <option value="sarcastic">Sarcastic</option>
        <option value="grammar">Grammar Fix</option>
      </select>
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Intensity</label>
      <select id="sapienwrite-tone-intensity" style="width: 100%; padding: 8px; border: 1px solid #374151; border-radius: 6px; font-size: 12px; background: #1F2937; color: #F9FAFB; cursor: pointer;">
        <option value="strong">Strong</option>
        <option value="medium">Medium</option>
        <option value="light">Light</option>
      </select>
    </div>
    
    <div style="display: flex; gap: 6px; margin-top: 4px;">
      <button id="sapienwrite-humanize" style="flex: 1 !important; padding: 10px !important; background: #7C3AED !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">
        Humanize
      </button>
      <button id="sapienwrite-cancel" style="flex: 1 !important; padding: 10px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">
        Cancel
      </button>
    </div>
  `;
  
  safeAppendToBody(dialog);
  
  // Set selected tone if provided
  if (selectedTone) {
    const toneSelect = document.getElementById('sapienwrite-tone');
    if (toneSelect) toneSelect.value = selectedTone;
  }
  
  // Preselect default tone intensity
  const intensitySelect = document.getElementById('sapienwrite-tone-intensity');
  if (intensitySelect) intensitySelect.value = 'strong';
  
  // Event listeners
  document.getElementById('sapienwrite-cancel').onclick = closeDialog;
  
  document.getElementById('sapienwrite-humanize').onclick = () => {
    const tone = document.getElementById('sapienwrite-tone').value;
    const toneIntensity = document.getElementById('sapienwrite-tone-intensity')?.value || 'strong';
    selectedTone = tone;
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
  if (dialog) dialog.remove();
  // No backdrop needed for compact toast style
}

function showProcessing() {
  console.log('[Content] 🎬 showProcessing() CALLED');
  closeDialog(); // Remove any existing dialog first
  
  // Create compact dark toast (LinkedIn style)
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #111827CC !important;
    color: #F9FAFB !important;
    padding: 12px 16px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    max-width: 300px !important;
  `;
  
  dialog.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 20px; height: 20px; border: 3px solid #374151; border-top-color: #7C3AED; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div>Processing...</div>
    </div>
  `;
  
  safeAppendToBody(dialog);
  
  // Add animation
  if (!document.getElementById('sapienwrite-spin-style')) {
    const style = document.createElement('style');
    style.id = 'sapienwrite-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    safeAppendToHead(style);
  }
  
  console.log('[Content] ✅ Compact processing toast shown');
  safeChromeMessage({ action: 'processingAck' });
  
  // Safety timeout
  setTimeout(() => {
    const stillExists = document.getElementById('sapienwrite-dialog');
    if (stillExists && stillExists.textContent.includes('Processing')) {
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
  console.log('[Content] showResult() called');
  closeDialog(); // Remove any existing dialog
  
  // SANITIZE humanizedText one more time before rendering (final safety)
  humanizedText = humanizedText.replace(/\[?\s*PARAGRAPH[_\s-]?\d+\s*\]?/gi, '');
  humanizedText = humanizedText.replace(/\n{3,}/g, '\n\n').trim();
  
  console.log('[Content] Sanitized humanizedText:', humanizedText.substring(0, 100));
  
  // Create compact dark toast (LinkedIn style)
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #111827 !important;
    color: #F9FAFB !important;
    padding: 14px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    max-width: 380px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  `;
  
  const toneDisplayNames = {
    'regular': 'Regular',
    'formal': 'Formal',
    'persuasive': 'Persuasive',
    'empathetic': 'Empathetic',
    'sarcastic': 'Sarcastic',
    'grammar': 'Grammar'
  };
  
  const toneDisplay = toneDisplayNames[selectedTone] || selectedTone;
  
  dialog.innerHTML = `
    <div style="font-size: 11px; color: #9CA3AF; font-weight: 600;">✓ ${toneDisplay} ${selectedToneIntensity || ''}</div>
    <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #F9FAFB; line-height: 1.5; max-height: 250px; overflow-y: auto;">${humanizedText}</pre>
    <div style="display: flex; gap: 6px; margin-top: 4px;">
      <button id="sapienwrite-replace" style="flex: 1 !important; padding: 8px !important; background: #7C3AED !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Replace</button>
      <button id="sapienwrite-copy" style="flex: 1 !important; padding: 8px !important; background: #2563EB !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Copy</button>
      <button id="sapienwrite-close-result" style="flex: 1 !important; padding: 8px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Close</button>
    </div>
  `;
  
  safeAppendToBody(dialog);
  console.log('[Content] Result dialog rendered');
  
  document.getElementById('sapienwrite-replace').onclick = () => {
    const replaced = replaceSelectedText(originalText, humanizedText);
    
    // Check if dialog still exists before updating
    const currentDialog = document.getElementById('sapienwrite-dialog');
    if (!currentDialog) {
      console.warn('[Content] Dialog was removed, cannot show success UI');
      return;
    }
    
    if (replaced) {
      currentDialog.innerHTML = `
        <div style="color: #10B981; font-weight: 600; font-size: 13px;">✓ Text replaced!</div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button id="sapienwrite-restore" style="flex: 1 !important; padding: 8px !important; background: #F59E0B !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">↶ Restore</button>
          <button id="sapienwrite-close-final" style="flex: 1 !important; padding: 8px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Close</button>
        </div>
      `;
      
      // Verify buttons exist before attaching listeners
      const restoreBtn = document.getElementById('sapienwrite-restore');
      const closeBtn = document.getElementById('sapienwrite-close-final');
      
      if (restoreBtn) restoreBtn.onclick = () => { restoreOriginalText(); closeDialog(); };
      if (closeBtn) closeBtn.onclick = closeDialog;
      
      setTimeout(closeDialog, 8000);
    } else {
      closeDialog();
    }
  };
  
  document.getElementById('sapienwrite-copy').onclick = () => {
    navigator.clipboard.writeText(humanizedText);
    closeDialog();
    
    // Show dark toast confirmation (matching result dialog style)
    const toast = document.createElement('div');
    toast.id = 'sapienwrite-dialog';
    toast.style.cssText = `
      all: initial;
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      background: #111827 !important;
      color: #F9FAFB !important;
      padding: 14px !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      max-width: 350px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 8px !important;
    `;
    
    toast.innerHTML = `
      <div style="color: #10B981; font-size: 16px;">✓</div>
      <div style="flex: 1; line-height: 1.4;">Text copied to clipboard - paste manually</div>
    `;
    
    safeAppendToBody(toast);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  };
  
  document.getElementById('sapienwrite-close-result').onclick = closeDialog;
}

function showError(errorMessage) {
  closeDialog(); // Remove any existing dialog
  
  // Create compact dark toast (LinkedIn style)
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #111827 !important;
    color: #F9FAFB !important;
    padding: 14px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    max-width: 350px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  `;
  
  dialog.innerHTML = `
    <div style="color: #EF4444; font-weight: 600;">⚠ Error</div>
    <div style="line-height: 1.5;">${errorMessage}</div>
    <button id="sapienwrite-close-error" style="padding: 8px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Close</button>
  `;
  
  safeAppendToBody(dialog);
  document.getElementById('sapienwrite-close-error').onclick = closeDialog;
}


// Show upgrade required dialog
function showUpgradeRequiredDialog(currentPlan) {
  closeDialog(); // Remove existing dialog
  
  // Create compact dark toast (LinkedIn style)
  const dialog = document.createElement('div');
  dialog.id = 'sapienwrite-dialog';
  dialog.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #111827 !important;
    color: #F9FAFB !important;
    padding: 16px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    max-width: 360px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  `;
  
  const planNames = { free: 'Free', pro: 'Pro', wordsmith: 'Pro' };
  
  dialog.innerHTML = `
    <div style="font-size: 24px;">🚀</div>
    <div>
      <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Extension is Premium</div>
      <div style="font-size: 12px; line-height: 1.5; color: #D1D5DB;">Use anywhere on the web. Available with Extension-Only ($12.95/mo) or Ultra plans.</div>
      <div style="margin-top: 8px; padding: 8px; background: #374151; border-radius: 6px; font-size: 11px; color: #FDE68A;">
        Your plan: <strong>${planNames[currentPlan] || currentPlan}</strong>
      </div>
    </div>
    <div style="display: flex; gap: 6px;">
      <button id="sapienwrite-view-upgrade" style="flex: 1 !important; padding: 10px !important; background: #7C3AED !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Upgrade</button>
      <button id="sapienwrite-cancel-upgrade" style="flex: 1 !important; padding: 10px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Cancel</button>
    </div>
  `;
  
  safeAppendToBody(dialog);
  
  document.getElementById('sapienwrite-view-upgrade').onclick = () => {
    window.open('https://sapienwrite.com/pricing?from=extension', '_blank');
    closeDialog();
  };
  
  document.getElementById('sapienwrite-cancel-upgrade').onclick = closeDialog;
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
    // Try structured extraction first
    const structuredText = extractStructuredText();
    if (structuredText) {
      console.log('[Content] Returning structured text:', structuredText.substring(0, 50));
      sendResponse({ text: structuredText });
      return;
    }
    
    // Fallback to stored selection
    let text = '';
    if (lastInputSelection?.element) {
      const val = lastInputSelection.valueSnapshot ?? lastInputSelection.element.value ?? '';
      const s = lastInputSelection.start ?? 0;
      const e = lastInputSelection.end ?? 0;
      if (e > s) text = val.substring(s, e);
    }
    if (!text && lastSelection?.text) text = lastSelection.text;
    if (!text) {
      const sel = window.getSelection();
      text = sel?.toString() || '';
    }
    console.log('[Content] Returning fallback selection:', text.substring(0, 50));
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
