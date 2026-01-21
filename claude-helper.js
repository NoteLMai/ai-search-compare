/**
 * AI Search Compare - Claude Helper
 * Auto-fills the Claude input box with query from URL parameter and auto-submits
 */

(function() {
  'use strict';

  // Get prompt from URL parameters
  const params = new URLSearchParams(window.location.search);
  const promptText = params.get('prompt') || params.get('q');

  // If no prompt parameter, do nothing
  if (!promptText) return;

  console.log('[AI Search Compare] Claude: Found prompt in URL, attempting to fill and submit...');

  let inputBoxRef = null;

  /**
   * Find and fill the Claude input box
   */
  function fillClaudeInput() {
    // Claude's input is typically a contenteditable div or textarea
    // Try multiple selectors
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Reply"]',
      'textarea'
    ];
    
    for (const selector of selectors) {
      const inputBox = document.querySelector(selector);
      
      if (inputBox && isVisible(inputBox)) {
        inputBoxRef = inputBox;
        
        // Focus the input
        inputBox.focus();
        
        if (inputBox.tagName.toLowerCase() === 'textarea') {
          // For textarea elements
          inputBox.value = promptText;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
          inputBox.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // For contenteditable divs (ProseMirror, etc.)
          // Clear existing content
          inputBox.innerHTML = '';
          
          // Create a paragraph with the text
          const p = document.createElement('p');
          p.textContent = promptText;
          inputBox.appendChild(p);
          
          // Dispatch input event
          inputBox.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: promptText,
          }));
        }
        
        console.log('[AI Search Compare] Claude: Successfully filled input box');
        
        // Wait for Claude to process the input, then submit
        setTimeout(() => {
          submitQuery(inputBox);
        }, 300);
        
        return true;
      }
    }
    return false;
  }

  /**
   * Submit the query by clicking send button or pressing Enter
   */
  function submitQuery(inputBox) {
    // Method 1: Try to find and click the send button
    const sendButtonSelectors = [
      'button[aria-label*="Send"]',
      'button[aria-label*="Submit"]',
      'button[data-testid="send-button"]',
      'button[type="submit"]',
      // Claude often has a send button near the input
      'button svg[data-icon="arrow-up"]',
      'button svg[data-icon="send"]'
    ];
    
    for (const selector of sendButtonSelectors) {
      let sendBtn = document.querySelector(selector);
      
      // If we found an SVG, get the parent button
      if (sendBtn && sendBtn.tagName.toLowerCase() === 'svg') {
        sendBtn = sendBtn.closest('button');
      }
      
      if (sendBtn && !sendBtn.disabled && isVisible(sendBtn)) {
        console.log('[AI Search Compare] Claude: Found send button, clicking...');
        sendBtn.click();
        return;
      }
    }
    
    // Method 2: Find button near the input that looks like a send button
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      if ((ariaLabel.includes('send') || ariaLabel.includes('submit')) && 
          !btn.disabled && isVisible(btn)) {
        console.log('[AI Search Compare] Claude: Found send button via aria-label, clicking...');
        btn.click();
        return;
      }
    }
    
    // Method 3: Simulate Enter key press (without Shift for send)
    console.log('[AI Search Compare] Claude: No send button found, simulating Enter key...');
    
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      shiftKey: false
    });
    inputBox.dispatchEvent(enterEvent);
  }

  /**
   * Check if element is visible
   */
  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  // Polling: Try to find input box (Claude is a SPA, may take time to load)
  let attempts = 0;
  const maxAttempts = 20; // Max 10 seconds (20 * 500ms)
  
  const intervalId = setInterval(() => {
    attempts++;
    const success = fillClaudeInput();
    
    if (success || attempts >= maxAttempts) {
      clearInterval(intervalId);
      if (!success) {
        console.log('[AI Search Compare] Claude: Could not find input box after', maxAttempts, 'attempts');
      }
    }
  }, 500);

})();
