/**
 * AI Search Compare - Content Script
 * Injects tab bar above Google search box for quick AI search engine comparison
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const SELECTORS = {
    input: 'textarea[name="q"], input[name="q"]',
    inputAlt: 'textarea[aria-label*="Search"], input[aria-label*="Search"], .gLFyf',
    searchForm: 'form[action="/search"], form[role="search"], #tsf',
    captcha: '#captcha-form, iframe[src*="recaptcha"], #challenge-running',
  };

  const SEARCH_ENGINES = {
    'google': {
      name: 'Google',
      buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    'google-ai': {
      name: 'AI Mode',
      buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=50`
    },
    'gemini': {
      name: 'Gemini',
      buildUrl: (query) => `https://gemini.google.com/app?prompt=${encodeURIComponent(query)}`
    },
    'chatgpt': {
      name: 'ChatGPT',
      buildUrl: (query) => `https://chatgpt.com/?q=${encodeURIComponent(query)}`
    },
    'claude': {
      name: 'Claude',
      buildUrl: (query) => `https://claude.ai/new?q=${encodeURIComponent(query)}`
    },
    'perplexity': {
      name: 'Perplexity',
      buildUrl: (query) => `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`
    }
  };

  const DEFAULT_ENGINE_ORDER = ['google', 'google-ai', 'gemini', 'chatgpt', 'claude', 'perplexity'];

  // ============================================
  // STATE
  // ============================================
  let settings = null;
  let mutationObserver = null;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  function hasCaptcha() {
    return !!document.querySelector(SELECTORS.captcha);
  }

  function log(message) {
    console.log(`[AI Search Compare] ${message}`);
  }

  // ============================================
  // SETTINGS
  // ============================================
  async function loadSettings() {
    try {
      settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    } catch (e) {
      log('Using default settings');
      settings = { enabledEngines: DEFAULT_ENGINE_ORDER };
    }
  }

  // ============================================
  // DOM FUNCTIONS
  // ============================================
  function findSearchForm() {
    const selectors = SELECTORS.searchForm.split(', ');
    for (const selector of selectors) {
      const form = document.querySelector(selector);
      if (form && isElementVisible(form)) return form;
    }
    const input = findSearchInput();
    return input?.closest('form') || null;
  }

  function findSearchInput() {
    for (const selector of SELECTORS.input.split(', ')) {
      const input = document.querySelector(selector);
      if (input && isElementVisible(input)) return input;
    }
    for (const selector of SELECTORS.inputAlt.split(', ')) {
      const input = document.querySelector(selector);
      if (input && isElementVisible(input)) return input;
    }
    return null;
  }

  function getCurrentQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryFromUrl = urlParams.get('q');
    if (queryFromUrl) return queryFromUrl;
    const input = findSearchInput();
    return input?.value?.trim() || '';
  }

  // ============================================
  // TAB BAR
  // ============================================
  function createTabBar() {
    if (document.getElementById('ai-switcher-bar')) return;
    if (hasCaptcha()) return;

    const searchForm = findSearchForm();
    if (!searchForm) return;

    const tabBar = document.createElement('div');
    tabBar.id = 'ai-switcher-bar';
    tabBar.className = 'ai-switcher-inline';

    const label = document.createElement('span');
    label.className = 'ai-switcher-label';
    label.textContent = 'AI Search Compare:';
    tabBar.appendChild(label);

    const enabledEngines = settings?.enabledEngines || DEFAULT_ENGINE_ORDER;
    
    enabledEngines.forEach((engineId) => {
      const engine = SEARCH_ENGINES[engineId];
      if (!engine) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ai-switcher-btn${engineId === 'google' ? ' active' : ''}`;
      btn.dataset.engine = engineId;
      btn.title = engine.name;
      btn.innerHTML = `<span class="btn-name">${engine.name}</span>`;
      
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEngine(engineId);
      });

      tabBar.appendChild(btn);
    });

    document.body.appendChild(tabBar);
    positionTabBar(tabBar);
    
    window.addEventListener('scroll', () => positionTabBar(tabBar), { passive: true });
    window.addEventListener('resize', () => positionTabBar(tabBar), { passive: true });
  }

  function positionTabBar(tabBar) {
    const searchInput = findSearchInput();
    if (!searchInput) return;
    
    const searchBox = searchInput.closest('.RNNXgb') || 
                      searchInput.closest('.SDkEP') || 
                      searchInput.closest('[data-gsfi]')?.parentNode ||
                      searchInput.parentNode;
    
    if (!searchBox) return;
    
    const rect = searchBox.getBoundingClientRect();
    const barHeight = tabBar.offsetHeight;
    
    let topPos = rect.top - barHeight - 4;
    topPos = Math.max(4, topPos);
    
    tabBar.style.position = 'fixed';
    tabBar.style.top = `${topPos}px`;
    tabBar.style.left = `${rect.left + 24}px`;
    tabBar.style.zIndex = '9999';
    
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      tabBar.style.opacity = '0';
      tabBar.style.pointerEvents = 'none';
    } else {
      tabBar.style.opacity = '1';
      tabBar.style.pointerEvents = 'auto';
    }
  }

  function setBarVisibility(visible) {
    const bar = document.getElementById('ai-switcher-bar');
    if (bar) {
      bar.style.display = visible ? 'flex' : 'none';
    }
  }

  // ============================================
  // ENGINE SELECTION
  // ============================================
  function openEngine(engineId) {
    const engine = SEARCH_ENGINES[engineId];
    if (!engine) return;
    
    const query = getCurrentQuery();
    if (!query) return;
    
    log(`Opening ${engine.name} with query: "${query}"`);
    chrome.runtime.sendMessage({
      type: 'OPEN_SPLIT_VIEW',
      url: engine.buildUrl(query)
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function waitForReady() {
    return new Promise((resolve) => {
      const maxAttempts = 30;
      let attempts = 0;
      
      const check = () => {
        if (findSearchInput() || findSearchForm()) {
          resolve();
          return;
        }
        attempts++;
        if (attempts >= maxAttempts) {
          resolve();
          return;
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  function setupObserver() {
    if (mutationObserver) mutationObserver.disconnect();
    
    let debounceTimer = null;
    mutationObserver = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const barVisible = settings?.barVisible !== false;
        if (!document.getElementById('ai-switcher-bar') && findSearchForm() && barVisible) {
          createTabBar();
        }
      }, 100);
    });

    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  async function init() {
    log('Initializing...');
    await loadSettings();
    
    const barVisible = settings?.barVisible !== false;
    
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

  // Cleanup
  window.addEventListener('pagehide', () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  });

  // Listen for toggle from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_BAR_VISIBILITY') {
      setBarVisibility(message.visible);
      sendResponse({ success: true });
    }
    return true;
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      const oldSettings = settings;
      settings = changes.settings.newValue;
      
      if (oldSettings?.barVisible !== settings?.barVisible) {
        setBarVisibility(settings?.barVisible !== false);
      }
    }
  });

  init();
})();
