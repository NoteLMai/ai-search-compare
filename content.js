/**
 * AI Search Compare - Content Script
 * Injects tab bar above Google search box for quick AI search engine switching
 */

(function() {
  'use strict';

  // ============================================
  // DOM SELECTORS
  // ============================================
  const SELECTORS = {
    // Search input - multiple fallback selectors for different Google layouts
    input: 'textarea[name="q"], input[name="q"]',
    inputAlt: 'textarea[aria-label*="Search"], input[aria-label*="Search"], .gLFyf',
    
    // Search form
    searchForm: 'form[action="/search"], form[role="search"], #tsf',
    
    // Search box containers (for insertion point)
    searchBox: '.RNNXgb, .SDkEP, .a4bIc, [class*="search-box"]',
    
    // Google native tabs (All, Images, Videos, News, etc.)
    // Insert our AI switcher before these tabs
    nativeTabs: '#hdtb, .MUFPAc, #hdtb-msb, .T47uwc, [role="navigation"], .crJ18e, .IUOThf',
    
    // Search header container (above the tabs)
    searchHeader: '.sfbg, .Fh5muf, #searchform',
    
    // AI Mode detection
    aiModeContainer: '[data-scope-id="turn"]',
    aiOverviewContainer: '.mZJni.Dn7Fzd, [data-container-id="main-col"], .pOOWX',
    
    // Loading/Error states
    loadingIndicator: '.sFWyX, [aria-busy="true"]',
    captcha: '#captcha-form, iframe[src*="recaptcha"], #challenge-running',
  };

  // ============================================
  // SEARCH ENGINE CONFIGURATIONS
  // Updated URLs verified as of 2026
  // ============================================
  const SEARCH_ENGINES = {
    'google': {
      name: 'Google',
      icon: '🔍',
      color: '#4285f4',
      // Standard Google search
      buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    'google-ai': {
      name: 'AI Mode',
      icon: '✨',
      color: '#8e44ad',
      // AI Mode uses udm=50 parameter (verified from GoogleAIModeAdapter)
      buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=50`
    },
    'perplexity': {
      name: 'Perplexity',
      icon: '🟣',
      color: '#7c3aed',
      // Perplexity direct search URL format: /search?q=
      buildUrl: (query) => `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`
    },
    'chatgpt': {
      name: 'ChatGPT',
      icon: '💬',
      color: '#10a37f',
      // ChatGPT Search - hints=search forces search mode
      // Format: ?hints=search&q=query
      buildUrl: (query) => `https://chatgpt.com/?q=${encodeURIComponent(query)}`
    },
    'claude': {
      name: 'Claude',
      icon: '🧡',
      color: '#d97706',
      // Claude: use ?q= param, our claude-helper.js will fill the input
      buildUrl: (query) => `https://claude.ai/new?q=${encodeURIComponent(query)}`
    },
    'gemini': {
      name: 'Gemini',
      icon: '💎',
      color: '#4285f4',
      // Gemini: use ?prompt= param, our gemini-helper.js will fill the input
      buildUrl: (query) => `https://gemini.google.com/app?prompt=${encodeURIComponent(query)}`
    }
  };

  // Engine order for display
  const DEFAULT_ENGINE_ORDER = ['google', 'google-ai', 'gemini', 'chatgpt', 'claude', 'perplexity'];

  // ============================================
  // STATE VARIABLES
  // ============================================
  let currentEngine = 'google';
  let settings = null;
  let keyboardListenerAdded = false;
  let mutationObserver = null;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Check if an element is visible
   */
  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  /**
   * Check if current page is in AI Mode
   * AI Mode uses udm=50 parameter
   */
  function isAIModePage() {
    return window.location.search.includes('udm=50');
  }

  /**
   * Check if page has CAPTCHA
   */
  function hasCaptcha() {
    return !!document.querySelector(SELECTORS.captcha);
  }

  /**
   * Simple delay utility
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log with prefix for debugging
   */
  function log(message) {
    console.log(`[AI Search Compare] ${message}`);
  }

  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================
  
  async function loadSettings() {
    try {
      settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    } catch (e) {
      log('Using default settings');
      settings = {
        enabledEngines: DEFAULT_ENGINE_ORDER,
        defaultEngine: 'google',
        lastUsedEngine: 'google'
      };
    }
    
    // On Google search page, current engine is always Google
    currentEngine = 'google';
  }

  // ============================================
  // DOM FINDER FUNCTIONS
  // ============================================

  /**
   * Find the main search form on Google
   * Uses multiple fallback selectors for different Google layouts
   */
  function findSearchForm() {
    // Split the selector string and try each one
    const selectors = SELECTORS.searchForm.split(', ');
    
    for (const selector of selectors) {
      const form = document.querySelector(selector);
      if (form && isElementVisible(form)) return form;
    }
    
    // Fallback: find form containing search input
    const input = findSearchInput();
    if (input) {
      const form = input.closest('form');
      if (form) return form;
    }
    
    return null;
  }

  /**
   * Find the search input element
   * Handles both textarea (new UI) and input (classic UI)
   */
  function findSearchInput() {
    // Try primary selectors
    const primarySelectors = SELECTORS.input.split(', ');
    for (const selector of primarySelectors) {
      const input = document.querySelector(selector);
      if (input && isElementVisible(input)) return input;
    }
    
    // Try alternative selectors
    const altSelectors = SELECTORS.inputAlt.split(', ');
    for (const selector of altSelectors) {
      const input = document.querySelector(selector);
      if (input && isElementVisible(input)) return input;
    }
    
    return null;
  }

  /**
   * Find the best insertion point for the tab bar
   * Target: Insert between search box area and native Google navigation tabs
   */
  function findInsertionPoint(searchForm) {
    // Debug: Log all potential elements
    const hdtb = document.getElementById('hdtb');
    const hdtbMenus = document.getElementById('hdtbMenus');
    const appbar = document.getElementById('appbar');
    
    log(`DOM check: hdtb=${!!hdtb}, hdtbMenus=${!!hdtbMenus}, appbar=${!!appbar}`);
    
    // Strategy 1: Look for the tab row inside hdtb and use prepend
    // The tabs are usually in a div inside #hdtb
    if (hdtb) {
      // Find the first div that contains the actual navigation tabs
      const tabsDiv = hdtb.querySelector('.MUFPAc, .IUOThf, [role="navigation"], .crJ18e');
      if (tabsDiv) {
        log(`Found tabs inside hdtb: ${tabsDiv.className}`);
        // Insert before this tabs div within hdtb
        return { parent: hdtb, before: tabsDiv };
      }
      // If no specific tabs found, prepend to hdtb
      log('Prepending to #hdtb');
      return { parent: hdtb, before: hdtb.firstChild };
    }
    
    // Strategy 2: Find #appbar and insert at the beginning
    if (appbar) {
      log('Prepending to #appbar');
      return { parent: appbar, before: appbar.firstChild };
    }
    
    // Strategy 3: Find the search form container and append after it
    if (searchForm) {
      // Look for the form's grandparent which might be the search section
      const searchSection = searchForm.closest('.sfbg') || searchForm.closest('[data-hveid]') || searchForm.parentNode;
      if (searchSection && searchSection.nextElementSibling) {
        log('Inserting after search section');
        return { parent: searchSection.parentNode, before: searchSection.nextElementSibling };
      }
    }
    
    // Strategy 4: Find #rcnt (main result container) and prepend
    const rcnt = document.getElementById('rcnt');
    if (rcnt) {
      log('Prepending to #rcnt');
      return { parent: rcnt, before: rcnt.firstChild };
    }
    
    // Fallback
    log('Using fallback insertion');
    return { parent: document.body, before: document.body.firstElementChild };
  }

  // ============================================
  // TAB BAR UI CREATION
  // ============================================

  /**
   * Create and inject the tab bar UI
   * Now uses a compact inline button style between search box and native tabs
   */
  function createTabBar() {
    // Check if already exists
    const existingBar = document.getElementById('ai-switcher-bar');
    if (existingBar) return;

    // Check for CAPTCHA (don't inject on CAPTCHA pages)
    if (hasCaptcha()) {
      log('CAPTCHA detected, skipping tab bar injection');
      return;
    }

    const searchForm = findSearchForm();
    if (!searchForm) {
      log('Search form not found');
      return;
    }

    const tabBar = document.createElement('div');
    tabBar.id = 'ai-switcher-bar';
    tabBar.className = 'ai-switcher-inline';

    // Add label
    const label = document.createElement('span');
    label.className = 'ai-switcher-label';
    label.textContent = 'AI Search Compare:';
    tabBar.appendChild(label);

    // Get enabled engines in order
    const enabledEngines = settings?.enabledEngines || DEFAULT_ENGINE_ORDER;
    
    enabledEngines.forEach((engineId, index) => {
      const engine = SEARCH_ENGINES[engineId];
      if (!engine) return;

      const tab = document.createElement('button');
      tab.type = 'button'; // Prevent form submission
      tab.className = `ai-switcher-btn${engineId === currentEngine ? ' active' : ''}`;
      tab.dataset.engine = engineId;
      tab.title = `${engine.name} (Alt+${index + 1})`;
      tab.innerHTML = `<span class="btn-name">${engine.name}</span>`;
      
      // Use mousedown to prevent focus change issues
      tab.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectEngine(engineId);
      });

      tabBar.appendChild(tab);
    });

    // Append to body and position above search box using CSS
    document.body.appendChild(tabBar);
    log('Tab bar appended to body');
    
    // Position the bar above the search input
    positionTabBar(tabBar);
    
    // Re-position on scroll and resize
    window.addEventListener('scroll', () => positionTabBar(tabBar), { passive: true });
    window.addEventListener('resize', () => positionTabBar(tabBar), { passive: true });

    // Intercept form submission (use capture to run before Google's handler)
    searchForm.addEventListener('submit', handleSearch, true);

    // Add keyboard shortcut listener (only once)
    if (!keyboardListenerAdded) {
      document.addEventListener('keydown', handleKeyboardShortcut);
      keyboardListenerAdded = true;
    }
  }

  /**
   * Position the tab bar above the search input
   */
  function positionTabBar(tabBar) {
    const searchInput = findSearchInput();
    if (!searchInput) return;
    
    // Get the search input's container (usually the search box wrapper)
    const searchBox = searchInput.closest('.RNNXgb') || 
                      searchInput.closest('.SDkEP') || 
                      searchInput.closest('[data-gsfi]')?.parentNode ||
                      searchInput.parentNode;
    
    if (!searchBox) return;
    
    const rect = searchBox.getBoundingClientRect();
    const barHeight = tabBar.offsetHeight;
    
    // Calculate top position, ensure minimum of 4px from top
    let topPos = rect.top - barHeight - 4; // 4px gap below the bar
    topPos = Math.max(4, topPos); // Ensure at least 4px from top of viewport
    
    // Position above the search box, offset to align with straight edge (skip rounded corner)
    tabBar.style.position = 'fixed';
    tabBar.style.top = `${topPos}px`;
    tabBar.style.left = `${rect.left + 24}px`;
    tabBar.style.zIndex = '9999';
    
    // Hide if search box is completely out of view
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      tabBar.style.opacity = '0';
      tabBar.style.pointerEvents = 'none';
    } else {
      tabBar.style.opacity = '1';
      tabBar.style.pointerEvents = 'auto';
    }
  }

  /**
   * Get current query from URL or input
   */
  function getCurrentQuery() {
    // First try URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const queryFromUrl = urlParams.get('q');
    if (queryFromUrl) return queryFromUrl;
    
    // Fallback to input field
    const input = findSearchInput();
    return input?.value?.trim() || '';
  }

  /**
   * Select an engine and open in split view
   * Note: We're always on Google search page, so highlight stays on Google
   */
  function selectEngine(engineId) {
    if (!SEARCH_ENGINES[engineId]) {
      log(`Invalid engine: ${engineId}`);
      return;
    }
    
    const engine = SEARCH_ENGINES[engineId];
    const query = getCurrentQuery();
    
    log(`Engine selected: ${engine.name}, query: "${query}"`);

    // If we have a query, open in split view
    if (query) {
      log(`Opening ${engine.name} in split view...`);
      chrome.runtime.sendMessage({
        type: 'OPEN_SPLIT_VIEW',
        url: engine.buildUrl(query)
      });
    }
  }

  // Show a brief visual indicator when engine is selected
  function showEngineIndicator(engineId) {
    const engine = SEARCH_ENGINES[engineId];
    if (!engine) return;

    // Remove existing indicator
    const existing = document.getElementById('ai-switcher-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'ai-switcher-indicator';
    indicator.className = 'ai-switcher-indicator';
    indicator.textContent = `${engine.icon} ${engine.name}`;
    document.body.appendChild(indicator);

    // Animate and remove
    setTimeout(() => indicator.classList.add('show'), 10);
    setTimeout(() => {
      indicator.classList.remove('show');
      setTimeout(() => indicator.remove(), 200);
    }, 1000);
  }

  // Show indicator that query was copied to clipboard
  function showCopyIndicator(engineName) {
    // Remove existing indicator
    const existing = document.getElementById('ai-switcher-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'ai-switcher-indicator';
    indicator.className = 'ai-switcher-indicator';
    indicator.innerHTML = `📋 Query copied! Opening ${engineName}...`;
    document.body.appendChild(indicator);

    // Animate and remove
    setTimeout(() => indicator.classList.add('show'), 10);
    setTimeout(() => {
      indicator.classList.remove('show');
      setTimeout(() => indicator.remove(), 200);
    }, 800);
  }

  // ============================================
  // SEARCH HANDLING
  // ============================================

  /**
   * Handle form submission - redirect to selected search engine
   */
  function handleSearch(e) {
    // For Google classic, let default behavior handle it
    if (currentEngine === 'google') return;

    e.preventDefault();
    e.stopPropagation();

    const input = findSearchInput();
    const query = input?.value?.trim();
    
    if (!query) {
      log('No query found');
      return;
    }

    const engine = SEARCH_ENGINES[currentEngine];
    if (!engine) {
      log(`Unknown engine: ${currentEngine}`);
      return;
    }

    log(`Searching with ${engine.name}: "${query.substring(0, 30)}..."`);

    // Special handling for Claude (copy query to clipboard since it doesn't support URL params)
    if (currentEngine === 'claude') {
      navigator.clipboard.writeText(query).then(() => {
        log('Query copied to clipboard for Claude');
        showEngineIndicator('claude');
        // Small delay to show indicator before opening
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'OPEN_SPLIT_VIEW',
            url: engine.buildUrl(query)
          });
        }, 300);
      }).catch((err) => {
        log(`Clipboard error: ${err}`);
        chrome.runtime.sendMessage({
          type: 'OPEN_SPLIT_VIEW',
          url: engine.buildUrl(query)
        });
      });
      return;
    }

    // Open in split view
    chrome.runtime.sendMessage({
      type: 'OPEN_SPLIT_VIEW',
      url: engine.buildUrl(query)
    });
  }

  // Keyboard shortcuts: Alt+1 through Alt+6 for quick engine selection
  function handleKeyboardShortcut(e) {
    // Only trigger on Google search pages with search input focused
    const input = findSearchInput();
    if (!input || document.activeElement !== input) return;
    
    if (e.altKey && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const enabledEngines = settings?.enabledEngines || DEFAULT_ENGINE_ORDER;
      const index = parseInt(e.key) - 1;
      if (index < enabledEngines.length) {
        selectEngine(enabledEngines[index]);
      }
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Wait for page to be ready
   */
  async function waitForReady() {
    log('Waiting for page ready...');
    
    return new Promise((resolve, reject) => {
      const maxAttempts = 30;
      let attempts = 0;
      
      const check = () => {
        // Check for search input (primary indicator)
        const input = findSearchInput();
        if (input) {
          log('Page ready: Search input found');
          resolve();
          return;
        }
        
        // Check for search form
        const form = findSearchForm();
        if (form) {
          log('Page ready: Search form found');
          resolve();
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          log('Timeout waiting for page ready, proceeding anyway');
          resolve(); // Don't reject, just proceed
          return;
        }
        
        setTimeout(check, 200);
      };
      
      check();
    });
  }

  /**
   * Toggle tab bar visibility
   */
  function setBarVisibility(visible) {
    const bar = document.getElementById('ai-switcher-bar');
    if (bar) {
      bar.style.display = visible ? 'flex' : 'none';
    }
  }

  /**
   * Initialize the extension
   */
  async function init() {
    log('Initializing...');
    
    await loadSettings();
    
    // Check if bar should be visible
    const barVisible = settings?.barVisible !== false;
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        await waitForReady();
        createTabBar();
        setBarVisibility(barVisible);
        setupObserver();
      });
    } else {
      await waitForReady();
      createTabBar();
      setBarVisibility(barVisible);
      setupObserver();
    }
  }

  /**
   * Setup MutationObserver for SPA navigation
   */
  function setupObserver() {
    // Re-create on SPA navigation (Google uses client-side navigation)
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    let debounceTimer = null;
    
    mutationObserver = new MutationObserver((mutations) => {
      // Debounce observer calls to prevent excessive processing
      if (debounceTimer) clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        const barVisible = settings?.barVisible !== false;
        if (!document.getElementById('ai-switcher-bar') && findSearchForm() && barVisible) {
          log('Tab bar missing after DOM change, recreating...');
          createTabBar();
        }
      }, 100);
    });

    // Wait for body to be available
    if (document.body) {
      mutationObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    }
  }

  // Cleanup on page hide (unload is deprecated and blocked by some sites)
  // Use pagehide instead of unload for better compatibility
  window.addEventListener('pagehide', () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  });

  // Listen for toggle message from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_BAR_VISIBILITY') {
      log(`Toggling bar visibility: ${message.visible}`);
      setBarVisibility(message.visible);
      sendResponse({ success: true });
    }
    return true;
  });

  // Listen for settings changes from storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      const oldSettings = settings;
      settings = changes.settings.newValue;
      
      // Handle visibility change
      if (oldSettings?.barVisible !== settings?.barVisible) {
        setBarVisibility(settings?.barVisible !== false);
      }
      
      // Rebuild tab bar if other settings changed (like enabled engines)
      const existingBar = document.getElementById('ai-switcher-bar');
      if (existingBar && oldSettings?.enabledEngines !== settings?.enabledEngines) {
        existingBar.remove();
        createTabBar();
        setBarVisibility(settings?.barVisible !== false);
      }
    }
  });

  init();
})();
