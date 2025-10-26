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
        const containerText = currentNode.textContent || currentNode.innerText || '';
        const selectionText = selection.toString();
        const idx = containerText.indexOf(selectionText);
        const preContext = idx > 0 ? containerText.slice(Math.max(0, idx - 20), idx) : '';
        const postContext = idx >= 0 ? containerText.slice(idx + selectionText.length, idx + selectionText.length + 20) : '';
        
        lastSelection = {
          text: selectionText,
          range: range.cloneRange(),
          container: currentNode,
          // Store element identifiers for verification
          elementId: currentNode.id || null,
          elementClass: currentNode.className || null,
          elementTagName: currentNode.tagName || null,
          textLength: selectionText.length,
          // Store context for better range recreation
          preContext: preContext,
          postContext: postContext
        };
        console.log('[Content] Selection stored:', {
          text: lastSelection.text.substring(0, 50),
          tagName: currentNode.tagName,
          id: currentNode.id,
          className: currentNode.className,
          hasContext: !!(preContext || postContext)
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
        // Preserve preContext and postContext from mouseup capture
        lastSelection = {
          ...lastSelection,
          text: sel.toString(),
          range: range.cloneRange(),
          container: currentNode
        };
        console.log('[Content] selectionchange preserved context:', { 
          hasPre: !!lastSelection.preContext, 
          hasPost: !!lastSelection.postContext 
        });
        break;
      }
      currentNode = currentNode.parentElement;
    }
  }
});

// Helper: Normalize text for consistent searching (handle NBSP, zero-width spaces)
function normalizeForSearch(s) {
  // Normalize spaces and various zero-width/formatting chars; also normalize quotes
  return (s || '')
    .replace(/\u00A0/g, ' ')   // NBSP -> space
    .replace(/\u200B/g, ' ')   // ZWSP -> space
    .replace(/\u200D/g, ' ')   // ZWJ -> space
    .replace(/\u2060/g, ' ')   // WORD JOINER -> space
    .replace(/\uFEFF/g, ' ')   // BOM/ZWNBS -> space
    .replace(/[“”]/g, '"')     // curly double -> straight
    .replace(/[‘’]/g, "'");   // curly single -> straight
}

// Helper: Re-resolve Gmail's contenteditable when container becomes stale
function resolveEditableContainer(prevContainer, selectionText, preContext, postContext) {
  console.log('[Content] Resolving editable container', {
    hasPrev: !!prevContainer,
    prevInDOM: prevContainer ? document.body.contains(prevContainer) : false,
    prevEditable: prevContainer ? prevContainer.isContentEditable : false
  });
  
  // 1) Prefer previous container if still valid
  if (prevContainer && document.body.contains(prevContainer) && prevContainer.isContentEditable) {
    console.log('[Content] Previous container still valid');
    return prevContainer;
  }

  // 2) Editor selectors (Gmail + Outlook + general)
  const gmailSelector = [
    'div[aria-label="Message body"][contenteditable="true"]',
    'div[aria-label="Message Body"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][g_editable="true"]',
    '.Am.Al.editable[contenteditable="true"]'
  ].join(',');

  const outlookSelector = [
    'div[aria-label="Message body"]',
    'div[aria-label="Message Body"]',
    '[contenteditable="true"][role="textbox"]'
  ].join(',');

  // 3) Collect all candidates
  const candidates = [
    ...document.querySelectorAll(gmailSelector),
    ...document.querySelectorAll(outlookSelector),
    ...document.querySelectorAll('[contenteditable="true"]')
  ].filter(el => {
    // Exclude our own dialog
    return el.id !== 'sapienwrite-dialog' && 
           el.closest('#sapienwrite-dialog') === null &&
           document.body.contains(el);
  });

  console.log('[Content] Found candidate editables:', candidates.length);

  if (candidates.length === 0) {
    console.warn('[Content] No editable candidates found');
    return prevContainer || null;
  }

  // 4) Score candidates based on text/context match
  const normalizedSel = normalizeForSearch(selectionText || '');
  const normalizedPre = normalizeForSearch(preContext || '');
  const normalizedPost = normalizeForSearch(postContext || '');
  
  let best = { el: null, score: -1 };
  
  for (const el of candidates) {
    const text = (el.textContent || el.innerText || '');
    const norm = normalizeForSearch(text);
    let score = 0;
    
    // Selection text match
    if (normalizedSel && norm.includes(normalizedSel)) {
      score += 2;
      console.log('[Content] Candidate contains selection text:', el.getAttribute('aria-label') || el.className);
    }
    
    // Pre-context match
    if (normalizedPre && norm.includes(normalizedPre)) {
      score += 1;
      console.log('[Content] Candidate contains pre-context');
    }
    
    // Post-context match
    if (normalizedPost && norm.includes(normalizedPost)) {
      score += 1;
      console.log('[Content] Candidate contains post-context');
    }
    
    // Favor visible/editable nodes and current active element
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) score += 0.5;
    const active = document.activeElement;
    if (active && (el === active || el.contains(active))) score += 1;
    if (score > best.score) {
      best = { el, score };
    }
  }
  
  if (best.el) {
    console.log('[Content] Best container found with score:', best.score, {
      tagName: best.el.tagName,
      ariaLabel: best.el.getAttribute('aria-label'),
      role: best.el.getAttribute('role'),
      className: best.el.className,
      id: best.el.id
    });
  } else {
    console.warn('[Content] No good candidate found, using first or prev');
  }
  
  return best.el || candidates[0] || prevContainer || null;
}

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
async function replaceSelectedText(originalText, humanizedText) {
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
    if (lastSelection?.range || lastSelection?.container) {
      try {
        // Re-resolve container using helper (handles stale containers)
        let container = resolveEditableContainer(
          lastSelection.container,
          lastSelection.text,
          lastSelection.preContext,
          lastSelection.postContext
        );
        
        if (!container) {
          console.warn('[Content] No contenteditable container found after resolution');
          throw new Error('No valid container');
        }
        
        console.log('[Content] Using container:', {
          tagName: container.tagName,
          ariaLabel: container.getAttribute('aria-label'),
          isContentEditable: container.isContentEditable
        });
        
        const range = lastSelection.range;
        const isGmail = window.location.hostname.includes('mail.google.com');
          
          // Gmail-specific: Re-focus composer and stabilize selection
          if (isGmail) {
            // Gmail uses complex editor structure - try to focus the actual contenteditable
            const gmailEditable = container.querySelector('[contenteditable="true"]') || container;
            if (gmailEditable.focus) {
              try {
                gmailEditable.focus({ preventScroll: true });
              } catch (e) {
                gmailEditable.focus();
              }
            }
            // Double rAF for deterministic stabilization instead of fixed timeout
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            console.log('[Content] Gmail focus stabilized with double rAF');
          } else {
            // Focus the contenteditable container for non-Gmail
            if (container.focus) {
              try {
                container.focus({ preventScroll: true });
              } catch (e) {
                container.focus();
              }
            }
          }
        
        // Restore selection
        const sel = window.getSelection();
        sel.removeAllRanges();
        
        let activeRange = null;
        
        // Try to add the stored range first
        try {
          sel.addRange(range);
          activeRange = range;
          console.log('[Content] Using stored range');
        } catch (e) {
          console.log('[Content] Stored range invalid, searching for text instead');
          
          // FALLBACK: Search for original text in container with normalization
          const rawContainerText = container.textContent || container.innerText || '';
          const containerText = normalizeForSearch(rawContainerText);
          const normalizedSelText = normalizeForSearch(lastSelection.text);
          
          console.log('[Content] Searching for text:', {
            containerLength: containerText.length,
            selectionLength: normalizedSelText.length,
            containerPreview: containerText.substring(0, 100)
          });
          
          let startIndex = containerText.indexOf(normalizedSelText);
          
          // Use context-based search if simple indexOf fails and context is available
          if (startIndex === -1 && (lastSelection.preContext || lastSelection.postContext)) {
            console.log('[Content] Using context-based search for text location');
            const normalizedPre = normalizeForSearch(lastSelection.preContext || '');
            const normalizedPost = normalizeForSearch(lastSelection.postContext || '');
            
            let best = { index: -1, score: -1 };
            let from = 0, pos;
            while ((pos = containerText.indexOf(normalizedSelText, from)) !== -1) {
              from = pos + 1;
              const pre = containerText.slice(Math.max(0, pos - 20), pos);
              const post = containerText.slice(pos + normalizedSelText.length, pos + normalizedSelText.length + 20);
              let score = 0;
              if (normalizedPre && pre.endsWith(normalizedPre)) score += 1;
              if (normalizedPost && post.startsWith(normalizedPost)) score += 1;
              if (score > best.score) best = { index: pos, score };
            }
            if (best.index !== -1) {
              startIndex = best.index;
              console.log('[Content] Context-based search found text at index', startIndex, 'with score', best.score);
            }
          }
          
          // If still not found, search across all editable candidates
          if (startIndex === -1) {
            console.log('[Content] Text not found in current container, searching other editables');
            const candidates = [
              ...document.querySelectorAll('[contenteditable="true"]')
            ].filter(el => el.id !== 'sapienwrite-dialog' && el.closest('#sapienwrite-dialog') === null);
            
            for (const candidate of candidates) {
              const candidateText = normalizeForSearch(candidate.textContent || candidate.innerText || '');
              const idx = candidateText.indexOf(normalizedSelText);
              if (idx !== -1) {
                console.log('[Content] Found text in alternative container:', {
                  tagName: candidate.tagName,
                  ariaLabel: candidate.getAttribute('aria-label')
                });
                container = candidate;
                startIndex = idx;
                break;
              }
            }
          }
          
          if (startIndex === -1) {
            console.warn('[Content] Original text not found in any container - text may have changed');
            throw new Error('Text not found in container');
          }
          
          console.log('[Content] Text found at normalized index:', startIndex);
          
          // Create new range by walking the DOM with length-preserving normalization
          const newRange = document.createRange();
          let charCount = 0;
          let foundStart = false;
          let foundEnd = false;
          
          // Helper to map normalized offset to raw offset
          function mapNormalizedOffsetToRaw(rawText, normalizedOffset) {
            let normCount = 0;
            for (let i = 0; i < rawText.length; i++) {
              if (normCount === normalizedOffset) {
                return i;
              }
              normCount += normalizeForSearch(rawText[i]).length;
            }
            return rawText.length;
          }
          
          function walkTextNodes(node) {
            if (foundEnd) return;
            
            if (node.nodeType === Node.TEXT_NODE) {
              const rawText = node.textContent || '';
              const normText = normalizeForSearch(rawText);
              const nodeLength = normText.length;
              
              if (!foundStart && charCount + nodeLength > startIndex) {
                const normalizedOffsetInNode = startIndex - charCount;
                const rawOffset = mapNormalizedOffsetToRaw(rawText, normalizedOffsetInNode);
                newRange.setStart(node, rawOffset);
                foundStart = true;
                console.log('[Content] Range start set at raw offset:', rawOffset, 'from normalized:', normalizedOffsetInNode);
              }
              
              if (foundStart && !foundEnd && charCount + nodeLength >= startIndex + normalizedSelText.length) {
                const normalizedOffsetInNode = startIndex + normalizedSelText.length - charCount;
                const rawOffset = mapNormalizedOffsetToRaw(rawText, normalizedOffsetInNode);
                newRange.setEnd(node, rawOffset);
                foundEnd = true;
                console.log('[Content] Range end set at raw offset:', rawOffset, 'from normalized:', normalizedOffsetInNode);
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
            try {
              sel.addRange(newRange);
              activeRange = newRange;
              console.log('[Content] ✓ Successfully created and added new range from text search');
            } catch (rangeError) {
              console.warn('[Content] Failed to add new range (attempt 1):', rangeError.message);
              // Try again after double rAF for Gmail stabilization
              await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
              try {
                sel.removeAllRanges();
                sel.addRange(newRange);
                activeRange = newRange;
                console.log('[Content] ✓ Range added successfully after double rAF stabilization');
              } catch (retryError) {
                console.error('[Content] ✗ Range add failed even after stabilization:', retryError.message);
                throw new Error('Could not create valid range');
              }
            }
          } else {
            console.warn('[Content] Could not find text boundaries in DOM');
            throw new Error('Could not find text boundaries');
          }
        }
        
          // Helper functions for Gmail HTML conversion
          function escapeHTML(s) {
            return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          }
          function textToGmailHTML(text) {
            // Preserve empty lines with <div><br></div>
            return text.split('\n').map(line => {
              const content = line.trim().length ? escapeHTML(line) : '<br>';
              return `<div>${content}</div>`;
            }).join('');
          }

          // At this point we have a valid activeRange and selection
          const isMultiline = /\n/.test(humanizedText) || /\n/.test(lastSelection?.text || '');
          
          // GMAIL: Always try insertHTML first (works reliably for both single and multi-line)
          if (isGmail) {
            console.log('[Content] Gmail path: trying insertHTML', { isMultiline });
            const html = isMultiline ? textToGmailHTML(humanizedText) : escapeHTML(humanizedText);
            const htmlSuccess = document.execCommand('insertHTML', false, html);
            console.log('[Content] Gmail insertHTML result:', htmlSuccess);
            
            if (htmlSuccess) {
              console.log('[Content] ✓ Success: Gmail insertHTML');
              showNotification('Text replaced!', 'success');
              
              lastReplacement = {
                originalText: originalText,
                humanizedText: humanizedText,
                container: container,
                range: activeRange
              };
              
              return true;
            } else {
              console.log('[Content] Gmail insertHTML failed, trying fallback methods');
            }
          }
          
          // Prefer modern beforeinput path for non-Gmail
          let beforeInputHandled = false;
          try {
            const ev = new InputEvent('beforeinput', {
              inputType: 'insertReplacementText',
              data: humanizedText,
              bubbles: true,
              cancelable: true
            });
            const dispatchResult = container.dispatchEvent(ev);
            if (ev.defaultPrevented === true || dispatchResult === false) {
              beforeInputHandled = true;
            }
          } catch (e) {}

          if (beforeInputHandled) {
            console.log('[Content] ✓ Success path: beforeinput handled');
            showNotification('Text replaced!', 'success');
            
            lastReplacement = {
              originalText: originalText,
              humanizedText: humanizedText,
              container: container,
              range: activeRange
            };
            
            return true;
          }

          // For single-line or if HTML failed: Try execCommand insertText NEXT
          const execSuccess = document.execCommand('insertText', false, humanizedText);
          console.log('[Content] execCommand insertText result:', execSuccess);
        
          if (execSuccess) {
            console.log('[Content] ✓ Success path: execCommand insertText');
            showNotification('Text replaced!', 'success');
            
            lastReplacement = {
              originalText: originalText,
              humanizedText: humanizedText,
              container: container,
              range: activeRange
            };
            
            return true;
          }
        
          // If execCommand failed, try manual replacement
          console.log('[Content] execCommand failed, trying manual replacement');
          
          // Ensure we have a range in the selection
          if (sel.rangeCount === 0 && activeRange) {
            sel.addRange(activeRange);
            console.log('[Content] Re-applied activeRange for manual replacement');
          }
          
          if (sel.rangeCount > 0) {
            const currentRange = activeRange ? activeRange.cloneRange() : sel.getRangeAt(0);
            currentRange.deleteContents();
            
            // Gmail: Insert raw text node to avoid red color issue
            // Other sites: Wrap in span for color inheritance
            let insertedNode;
            if (isGmail) {
              insertedNode = document.createTextNode(humanizedText);
              currentRange.insertNode(insertedNode);
            } else {
              const span = document.createElement('span');
              span.style.cssText = 'color: inherit !important; font-family: inherit !important;';
              span.appendChild(document.createTextNode(humanizedText));
              insertedNode = span;
              currentRange.insertNode(span);
            }
            
            // Robust caret placement: move caret directly after the inserted node
            currentRange.setStartAfter(insertedNode);
            currentRange.setEndAfter(insertedNode);
            sel.removeAllRanges();
            sel.addRange(currentRange);
            
            // Dispatch input events
            container.dispatchEvent(new Event('input', { bubbles: true }));
            container.dispatchEvent(new Event('change', { bubbles: true }));
            container.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            
            console.log('[Content] ✓ Success path: Manual TextNode insertion');
            showNotification('Text replaced!', 'success');
            
            lastReplacement = {
              originalText: originalText,
              humanizedText: humanizedText,
              container: container,
              range: activeRange
            };
            
            return true;
          }
          
          // Last resort: try insertHTML (may cause red text in Gmail)
          console.log('[Content] Manual replacement failed, trying insertHTML as last resort');
          const htmlSuccess = document.execCommand('insertHTML', false, humanizedText);
          if (htmlSuccess) {
            console.log('[Content] ✓ Success path: Last resort insertHTML');
            showNotification('Text replaced!', 'success');
            
            lastReplacement = {
              originalText: originalText,
              humanizedText: humanizedText,
              container: container,
              range: activeRange
            };
            
            return true;
          }
          console.warn('[Content] All replacement methods failed');
          throw new Error('All replacement methods failed');
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
    console.log('[Content] Auto-replace blocked, using clipboard fallback');
    try {
      await navigator.clipboard.writeText(humanizedText);
      console.log('[Content] Text copied to clipboard as fallback');
    } catch (e) {
      console.warn('[Content] Clipboard write failed:', e);
    }
    
    // Don't close dialog or show toast here - let the caller handle UI
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
async function restoreOriginalText() {
  if (!lastReplacement) {
    showNotification('No text to restore', 'error');
    return false;
  }
  
  try {
    const { originalText, humanizedText, element, startIndex, endIndex, container, range } = lastReplacement;
    
    // TIER 1: INPUT/TEXTAREA restoration
    if (element?.tagName === 'TEXTAREA' || element?.tagName === 'INPUT') {
      if (typeof startIndex === 'number' && typeof endIndex === 'number') {
        const value = element.value;
        element.value = value.substring(0, startIndex) + originalText + value.substring(endIndex);
        element.selectionStart = element.selectionEnd = startIndex + originalText.length;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        showNotification('✓ Original text restored!', 'success');
        lastReplacement = null;
        return true;
      }
    }
    
    // TIER 2: ContentEditable restoration (Gmail, Facebook, LinkedIn)
    if (container && document.body.contains(container)) {
      const containerText = container.textContent || container.innerText;
      const humanizedIndex = containerText.indexOf(humanizedText);
      
      if (humanizedIndex !== -1) {
        // Found the humanized text - replace it back with original
        const restoreRange = document.createRange();
        let charCount = 0;
        let foundStart = false;
        let foundEnd = false;
        
        function walkTextNodes(node) {
          if (foundEnd) return;
          
          if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.textContent.length;
            
            if (!foundStart && charCount + nodeLength > humanizedIndex) {
              restoreRange.setStart(node, humanizedIndex - charCount);
              foundStart = true;
            }
            
            if (foundStart && !foundEnd && charCount + nodeLength >= humanizedIndex + humanizedText.length) {
              restoreRange.setEnd(node, humanizedIndex + humanizedText.length - charCount);
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
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(restoreRange);
          
          // Try execCommand first
          const success = document.execCommand('insertText', false, originalText);
          
          if (!success) {
            // Manual replacement
            restoreRange.deleteContents();
            const textNode = document.createTextNode(originalText);
            restoreRange.insertNode(textNode);
            
            container.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          showNotification('✓ Original text restored!', 'success');
          lastReplacement = null;
          return true;
        }
      }
    }
    
    showNotification('Cannot restore - text may have been edited', 'info');
    lastReplacement = null;
    return false;
  } catch (error) {
    console.error('[Content] Error restoring text:', error);
    showNotification('Failed to restore text', 'error');
    return false;
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
  
  let preMarkerId = null;
  const humanizeBtn = document.getElementById('sapienwrite-humanize');
  humanizeBtn.onmousedown = () => {
    try {
      const res = markSelection();
      preMarkerId = (res && 'markerId' in res) ? res.markerId : null;
      console.log('[Content] 🏷 preMarkerId assigned on mousedown:', preMarkerId);
    } catch (e) {
      console.warn('[Content] markSelection() on mousedown failed:', e);
    }
  };
  
  humanizeBtn.onclick = () => {
    const tone = document.getElementById('sapienwrite-tone').value;
    const toneIntensity = document.getElementById('sapienwrite-tone-intensity')?.value || 'strong';
    selectedTone = tone;
    selectedToneIntensity = toneIntensity;
    console.log(`[Content] 🎨 User selected tone: "${tone}" — intensity: "${toneIntensity}"`);
    safeChromeMessage({
      action: 'humanizeWithTone',
      text: text,
      tone: tone,
      toneIntensity: toneIntensity,
      preMarkerId
    });
  };
}

function closeDialog(opts = {}) {
  const dialog = document.getElementById('sapienwrite-dialog');
  if (dialog) dialog.remove();
  if (!opts.preserveMarkers) {
    // Cleanup any leftover markers
    cleanupMarkers();
  }
  // No backdrop needed for compact toast style
}

function showProcessing() {
  console.log('[Content] 🎬 showProcessing() CALLED');
  closeDialog({ preserveMarkers: true }); // Remove any existing dialog first but keep markers
  
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

function showResult(originalText, humanizedText, markerId = null) {
  console.log('[Content] showResult() called', { markerId });
  closeDialog({ preserveMarkers: true }); // Remove any existing dialog but keep markers
  
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
  
  const isGmail = window.location.hostname.includes('mail.google.com');
  let replaceTriggered = false; // Prevent double execution
  
  const replaceBtn = document.getElementById('sapienwrite-replace');
  if (replaceBtn) {
    replaceBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0).cloneRange();
          let container = r.commonAncestorContainer;
          container = container && container.nodeType === 3 ? container.parentElement : container;
          while (container && !container.isContentEditable) {
            container = container.parentElement;
          }
          lastSelection = { ...(lastSelection || {}), text: sel.toString(), range: r, container };
          console.log('[Content] Selection captured on mousedown');
        }
      } catch (err) {
        console.warn('[Content] Failed to capture selection on mousedown:', err);
      }
      
      // For Gmail: trigger replacement immediately on mousedown to preserve selection
      if (isGmail && !replaceTriggered) {
        replaceTriggered = true;
        console.log('[Content] Gmail: triggering replacement on mousedown');
        requestAnimationFrame(async () => {
          // Try marker-based replacement first
          let replaced = false;
          if (markerId) {
            replaced = await replaceByMarker(markerId, humanizedText);
            console.log('[Content] Marker-based replacement:', replaced);
          }
          
          // Fallback to regular replacement if marker failed
          if (!replaced) {
            replaced = await replaceSelectedText(originalText, humanizedText);
          }
          
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
                <button id="sapienwrite-restore" style="flex: 1 !important; padding: 8px !important; background: #F59E0B !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">↶ Restore (15s)</button>
                <button id="sapienwrite-close-final" style="flex: 1 !important; padding: 8px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Close</button>
              </div>
            `;
            
            const restoreBtn = document.getElementById('sapienwrite-restore');
            const closeBtn = document.getElementById('sapienwrite-close-final');
            
            if (restoreBtn) restoreBtn.onclick = async () => { await restoreOriginalText(); closeDialog(); };
            if (closeBtn) closeBtn.onclick = closeDialog;
            
            let remainingSeconds = 15;
            const countdownInterval = setInterval(() => {
              remainingSeconds--;
              const restoreBtn = document.getElementById('sapienwrite-restore');
              if (restoreBtn && remainingSeconds > 0) {
                restoreBtn.textContent = `↶ Restore (${remainingSeconds}s)`;
              } else {
                clearInterval(countdownInterval);
                if (remainingSeconds <= 0) closeDialog();
              }
            }, 1000);
            
            if (closeBtn) {
              closeBtn.onclick = () => {
                clearInterval(countdownInterval);
                closeDialog();
              };
            }
          } else {
            try { 
              navigator.clipboard.writeText(humanizedText); 
              console.log('[Content] Text copied to clipboard after failed replacement');
            } catch (e) {
              console.warn('[Content] Failed to copy to clipboard:', e);
            }
            
            currentDialog.innerHTML = `
              <div style="color: #F59E0B; font-weight: 600; font-size: 13px;">⚠ Couldn't auto-replace</div>
              <div style="font-size: 12px; color: #D1D5DB; line-height: 1.5; margin-top: 4px;">
                The text was copied. Click your editor and press <strong>Ctrl/Cmd+V</strong> to paste.
              </div>
              <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button id="sapienwrite-copy-again" style="flex: 1; padding: 8px; background: #2563EB; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Copy again</button>
                <button id="sapienwrite-close-final" style="flex: 1; padding: 8px; background: #374151; color: #E5E7EB; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Close</button>
              </div>
            `;
            
            const copyBtn = document.getElementById('sapienwrite-copy-again');
            const closeBtn = document.getElementById('sapienwrite-close-final');
            if (copyBtn) copyBtn.onclick = () => {
              navigator.clipboard.writeText(humanizedText);
              showNotification('✓ Copied to clipboard', 'success');
            };
            if (closeBtn) closeBtn.onclick = closeDialog;
          }
        });
      }
    };
  }
  
  document.getElementById('sapienwrite-replace').onclick = async () => {
    // Skip if already triggered on mousedown (Gmail)
    if (replaceTriggered) {
      console.log('[Content] Replacement already triggered on mousedown, skipping onclick');
      return;
    }
    
    // Try marker-based replacement first
    let replaced = false;
    if (markerId) {
      replaced = await replaceByMarker(markerId, humanizedText);
      console.log('[Content] Marker-based replacement:', replaced);
    }
    
    // Fallback to regular replacement if marker failed
    if (!replaced) {
      replaced = await replaceSelectedText(originalText, humanizedText);
    }
    
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
          <button id="sapienwrite-restore" style="flex: 1 !important; padding: 8px !important; background: #F59E0B !important; color: #fff !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">↶ Restore (15s)</button>
          <button id="sapienwrite-close-final" style="flex: 1 !important; padding: 8px !important; background: #374151 !important; color: #E5E7EB !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; min-width: 80px !important; white-space: nowrap !important;">Close</button>
        </div>
      `;
      
      // Verify buttons exist before attaching listeners
      const restoreBtn = document.getElementById('sapienwrite-restore');
      const closeBtn = document.getElementById('sapienwrite-close-final');
      
      if (restoreBtn) restoreBtn.onclick = async () => { await restoreOriginalText(); closeDialog(); };
      if (closeBtn) closeBtn.onclick = closeDialog;
      
      // Countdown timer
      let remainingSeconds = 15;
      const countdownInterval = setInterval(() => {
        remainingSeconds--;
        const restoreBtn = document.getElementById('sapienwrite-restore');
        if (restoreBtn && remainingSeconds > 0) {
          restoreBtn.textContent = `↶ Restore (${remainingSeconds}s)`;
        } else {
          clearInterval(countdownInterval);
          if (remainingSeconds <= 0) closeDialog();
        }
      }, 1000);
      
      // Store interval ID for cleanup
      if (closeBtn) {
        closeBtn.onclick = () => {
          clearInterval(countdownInterval);
          closeDialog();
        };
      }
    } else {
      // Replacement failed - show helpful message and don't close dialog
      try { 
        navigator.clipboard.writeText(humanizedText); 
        console.log('[Content] Text copied to clipboard after failed replacement');
      } catch (e) {
        console.warn('[Content] Failed to copy to clipboard:', e);
      }
      
      currentDialog.innerHTML = `
        <div style="color: #F59E0B; font-weight: 600; font-size: 13px;">⚠ Couldn't auto-replace</div>
        <div style="font-size: 12px; color: #D1D5DB; line-height: 1.5; margin-top: 4px;">
          The text was copied. Click your editor and press <strong>Ctrl/Cmd+V</strong> to paste.
        </div>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button id="sapienwrite-copy-again" style="flex: 1; padding: 8px; background: #2563EB; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Copy again</button>
          <button id="sapienwrite-close-final" style="flex: 1; padding: 8px; background: #374151; color: #E5E7EB; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Close</button>
        </div>
      `;
      
      const copyBtn = document.getElementById('sapienwrite-copy-again');
      const closeBtn = document.getElementById('sapienwrite-close-final');
      if (copyBtn) copyBtn.onclick = () => {
        navigator.clipboard.writeText(humanizedText);
        showNotification('✓ Copied to clipboard', 'success');
      };
      if (closeBtn) closeBtn.onclick = closeDialog;
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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
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
  
  // Mark selection with invisible wrapper (for Gmail reliability)
  if (message.action === 'markSelection') {
    const result = markSelection();
    sendResponse(result);
    return true;
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
      showResult(message.originalText, message.humanizedText, message.markerId);
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
    const replaced = await replaceSelectedText(message.originalText, message.humanizedText);
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

// Track active markers for cleanup
let activeMarkers = new Set();

// Generate unique marker ID
function generateMarkerId() {
  return `sw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Mark selection with invisible wrapper
function markSelection() {
  console.log('[Content] markSelection() called');
  
  // INPUT/TEXTAREA: Can't wrap, return null (use existing input path)
  const activeEl = document.activeElement;
  if (activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'INPUT') {
    console.log('[Content] INPUT/TEXTAREA active, skipping marker');
    return { markerId: null };
  }
  
  // CONTENTEDITABLE: Wrap selection
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
    console.log('[Content] No valid selection to mark');
    return { markerId: null };
  }
  
  try {
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editable = container.nodeType === 3 ? container.parentElement : container;
    
    // Check if we're in contenteditable
    let currentNode = editable;
    let isContentEditable = false;
    while (currentNode) {
      if (currentNode.isContentEditable) {
        isContentEditable = true;
        break;
      }
      currentNode = currentNode.parentElement;
    }
    
    if (!isContentEditable) {
      console.log('[Content] Not in contenteditable, skipping marker');
      return { markerId: null };
    }
    
    const markerId = generateMarkerId();
    
    // Create invisible marker span
    const marker = document.createElement('span');
    marker.setAttribute('data-sw-marker', markerId);
    marker.style.cssText = 'all: unset !important; display: inline !important;';
    
    // Wrap selection contents
    try {
      const contents = range.extractContents();
      marker.appendChild(contents);
      range.insertNode(marker);
      
      // Restore selection to be inside the marker
      const newRange = document.createRange();
      newRange.selectNodeContents(marker);
      sel.removeAllRanges();
      sel.addRange(newRange);
      
      activeMarkers.add(markerId);
      console.log('[Content] ✓ Selection marked:', markerId);
      // Safety: auto-clean this marker after 30s if still present
      setTimeout(() => {
        if (activeMarkers.has(markerId)) {
          const m = document.querySelector(`[data-sw-marker="${markerId}"]`);
          if (m && m.parentNode) {
            while (m.firstChild) m.parentNode.insertBefore(m.firstChild, m);
            m.parentNode.removeChild(m);
          }
          activeMarkers.delete(markerId);
          console.log('[Content] ⏱️ Auto-cleaned stale marker:', markerId);
        }
      }, 30000);
      
      return { markerId };
    } catch (e) {
      console.warn('[Content] Failed to wrap selection:', e.message);
      return { markerId: null };
    }
  } catch (e) {
    console.error('[Content] markSelection error:', e);
    return { markerId: null };
  }
}

// Replace text using marker
async function replaceByMarker(markerId, humanizedText) {
  if (!markerId) return false;
  
  console.log('[Content] replaceByMarker:', markerId);
  
  // Find marker
  const marker = document.querySelector(`[data-sw-marker="${markerId}"]`);
  if (!marker) {
    console.warn('[Content] Marker not found:', markerId);
    return false;
  }
  
  try {
    const isGmail = window.location.hostname.includes('mail.google.com');
    const isMultiline = /\n/.test(humanizedText);
    
    // Find contenteditable container
    let container = marker;
    while (container && !container.isContentEditable) {
      container = container.parentElement;
    }
    
    if (!container) {
      console.warn('[Content] No contenteditable container found');
      return false;
    }
    
    // Gmail: Use HTML insertion for multiline, textContent for single-line
    if (isGmail && isMultiline) {
      const lines = humanizedText.split('\n');
      const escapeHTML = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const html = lines.map(line => {
        const content = line.trim().length ? escapeHTML(line) : '<br>';
        return `<div>${content}</div>`;
      }).join('');
      marker.innerHTML = html;
    } else {
      marker.textContent = humanizedText;
    }
    
    // Unwrap marker (replace with its children)
    const parent = marker.parentNode;
    while (marker.firstChild) {
      parent.insertBefore(marker.firstChild, marker);
    }
    parent.removeChild(marker);
    
    // Dispatch events
    container.dispatchEvent(new Event('input', { bubbles: true }));
    container.dispatchEvent(new Event('change', { bubbles: true }));
    container.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    activeMarkers.delete(markerId);
    console.log('[Content] ✓ Marker-based replacement successful');
    
    return true;
  } catch (e) {
    console.error('[Content] replaceByMarker error:', e);
    return false;
  }
}

// Cleanup leftover markers
function cleanupMarkers() {
  activeMarkers.forEach(markerId => {
    const marker = document.querySelector(`[data-sw-marker="${markerId}"]`);
    if (marker) {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
    }
  });
  activeMarkers.clear();
}

console.log('[Content] SapienWrite ready');
