/**
 * AI Search Compare - Gemini Helper
 * Auto-fills the Gemini input box with query from URL parameter and auto-submits
 * Based on: gemini-url-prompt extension (gcooahlbfkojbacclfbofkcknbiopjan)
 */

(function() {
  'use strict';

  // Get prompt from URL parameters
  const params = new URLSearchParams(window.location.search);
  const promptText = params.get('prompt') || params.get('q');

  // If no prompt parameter, do nothing
  if (!promptText) return;

  console.log('[AI Search Compare] Gemini: Found prompt in URL, attempting to fill and submit...');

  /**
   * Find and fill the Gemini input box, then submit
   */
  function fillAndSubmitGeminiInput() {
    // Gemini's input box is a contenteditable div with role="textbox"
    const inputBox = document.querySelector('div[contenteditable="true"][role="textbox"]');
    
    if (inputBox) {
      // Focus the input
      inputBox.focus();
      
      // Set content
      inputBox.textContent = promptText;
      
      // Dispatch input event to trigger Gemini's internal state update
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
      inputBox.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('[AI Search Compare] Gemini: Successfully filled input box');
      
      // Wait a bit for Gemini to process the input, then submit
      setTimeout(() => {
        submitQuery(inputBox);
      }, 300);
      
      return true;
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
      'button.send-button',
      // Gemini's send button is often a button with an arrow/send icon
      'button[mattooltip*="Send"]',
      'button[mat-icon-button]'
    ];
    
    for (const selector of sendButtonSelectors) {
      const sendBtn = document.querySelector(selector);
      if (sendBtn && !sendBtn.disabled) {
        console.log('[AI Search Compare] Gemini: Found send button, clicking...');
        sendBtn.click();
        return;
      }
    }
    
    // Method 2: Find button near the input that looks like a send button
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const classList = btn.className.toLowerCase();
      
      if ((ariaLabel.includes('send') || ariaLabel.includes('submit') || 
           classList.includes('send')) && !btn.disabled) {
        console.log('[AI Search Compare] Gemini: Found send button via aria-label, clicking...');
        btn.click();
        return;
      }
    }
    
    // Method 3: Simulate Enter key press
    console.log('[AI Search Compare] Gemini: No send button found, simulating Enter key...');
    
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputBox.dispatchEvent(enterEvent);
    
    // Also try keyup
    const enterUpEvent = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputBox.dispatchEvent(enterUpEvent);
  }

  // Polling: Try to find input box (Gemini is a SPA, may take time to load)
  let attempts = 0;
  const maxAttempts = 20; // Max 10 seconds (20 * 500ms)
  
  const intervalId = setInterval(() => {
    attempts++;
    const success = fillAndSubmitGeminiInput();
    
    if (success || attempts >= maxAttempts) {
      clearInterval(intervalId);
      if (!success) {
        console.log('[AI Search Compare] Gemini: Could not find input box after', maxAttempts, 'attempts');
      }
    }
  }, 500);

})();
