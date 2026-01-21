/**
 * AI Search Compare - Background Service Worker
 */

const DEFAULT_SETTINGS = {
  defaultEngine: 'google',
  enabledEngines: ['google', 'google-ai', 'gemini', 'chatgpt', 'claude', 'perplexity'],
  lastUsedEngine: 'google',
  barVisible: true  // Default: show the bar
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  // Set initial icon state
  updateIcon(true);
});

// Convert image to grayscale using OffscreenCanvas
async function createGrayscaleIcon(size) {
  try {
    const response = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(bitmap, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // Alpha stays the same
    }
    
    ctx.putImageData(imageData, 0, 0);
    return ctx.getImageData(0, 0, size, size);
  } catch (e) {
    console.error(`Failed to create grayscale icon for size ${size}:`, e);
    return null;
  }
}

// Update extension icon (color or grayscale)
async function updateIcon(isVisible) {
  if (isVisible) {
    // Color icon
    chrome.action.setIcon({
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    });
    chrome.action.setTitle({ title: "AI Search Compare (Visible - Click to hide)" });
  } else {
    // Grayscale icon - generate dynamically
    try {
      const [icon16, icon48] = await Promise.all([
        createGrayscaleIcon(16),
        createGrayscaleIcon(48)
      ]);
      
      if (icon16 && icon48) {
        chrome.action.setIcon({
          imageData: {
            "16": icon16,
            "48": icon48
          }
        });
      }
    } catch (e) {
      console.error('Failed to set grayscale icon:', e);
    }
    chrome.action.setTitle({ title: "AI Search Compare (Hidden - Click to show)" });
  }
}

// Handle extension icon click - toggle bar visibility
chrome.action.onClicked.addListener(async (tab) => {
  // Get current settings
  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings = settings || DEFAULT_SETTINGS;
  
  // Toggle visibility
  const newVisible = !currentSettings.barVisible;
  currentSettings.barVisible = newVisible;
  
  // Save settings
  await chrome.storage.local.set({ settings: currentSettings });
  
  // Update icon
  updateIcon(newVisible);
  
  // Notify content script to toggle visibility
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'TOGGLE_BAR_VISIBILITY', 
      visible: newVisible 
    });
  } catch (e) {
    // Tab might not have content script loaded
    console.log('Could not send message to tab:', e);
  }
});

// Restore icon state on startup
chrome.storage.local.get('settings').then(({ settings }) => {
  const isVisible = settings?.barVisible !== false;
  updateIcon(isVisible);
});

/**
 * Find which display contains the given window position
 * Returns the display's workArea dimensions
 */
async function getDisplayForWindow(windowLeft, windowTop, windowWidth, windowHeight) {
  try {
    // Try to use system.display API (requires "system.display" permission)
    if (chrome.system && chrome.system.display) {
      const displays = await chrome.system.display.getInfo();
      if (displays && displays.length > 0) {
        // Calculate window center point
        const windowCenterX = windowLeft + windowWidth / 2;
        const windowCenterY = windowTop + windowHeight / 2;
        
        // Find the display that contains the window center
        for (const display of displays) {
          const bounds = display.bounds;
          if (windowCenterX >= bounds.left && 
              windowCenterX < bounds.left + bounds.width &&
              windowCenterY >= bounds.top && 
              windowCenterY < bounds.top + bounds.height) {
            // Found the display containing this window
            return {
              width: display.workArea.width,
              height: display.workArea.height,
              left: display.workArea.left,
              top: display.workArea.top
            };
          }
        }
        
        // If window center not found in any display, find the closest one
        let closestDisplay = displays[0];
        let minDistance = Infinity;
        
        for (const display of displays) {
          const bounds = display.bounds;
          const displayCenterX = bounds.left + bounds.width / 2;
          const displayCenterY = bounds.top + bounds.height / 2;
          const distance = Math.sqrt(
            Math.pow(windowCenterX - displayCenterX, 2) + 
            Math.pow(windowCenterY - displayCenterY, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestDisplay = display;
          }
        }
        
        return {
          width: closestDisplay.workArea.width,
          height: closestDisplay.workArea.height,
          left: closestDisplay.workArea.left,
          top: closestDisplay.workArea.top
        };
      }
    }
  } catch (e) {
    console.log('system.display not available, using fallback');
  }
  
  // Fallback: return null to signal we need to estimate from window
  return null;
}

/**
 * Open URL in split view (side-by-side windows)
 * Improved: Always calculates based on screen width, not current window width
 * Multi-monitor: Keeps windows on the same screen as the source window
 */
async function openInSplitView(url, sourceWindowId) {
  try {
    // Get current window info
    const currentWindow = await chrome.windows.get(sourceWindowId);
    
    // Try to get the display that contains the current window
    let screenInfo = await getDisplayForWindow(
      currentWindow.left || 0,
      currentWindow.top || 0,
      currentWindow.width,
      currentWindow.height
    );
    
    // Calculate screen dimensions
    let screenWidth, screenHeight, screenLeft, screenTop;
    
    if (screenInfo) {
      // Use actual screen dimensions
      screenWidth = screenInfo.width;
      screenHeight = screenInfo.height;
      screenLeft = screenInfo.left;
      screenTop = screenInfo.top;
    } else {
      // Fallback: Estimate screen size
      // If window is maximized or large, it's likely close to screen size
      // If window is small, estimate based on common screen sizes
      
      // Check if window seems maximized (width > 1200 usually means full/half screen)
      if (currentWindow.width > 1200) {
        // Window is likely maximized, use its dimensions as screen estimate
        screenWidth = currentWindow.width;
        screenHeight = currentWindow.height;
        screenLeft = currentWindow.left || 0;
        screenTop = currentWindow.top || 0;
      } else if (currentWindow.width > 600) {
        // Window might be half screen already, double it for full screen estimate
        screenWidth = currentWindow.width * 2;
        screenHeight = currentWindow.height;
        screenLeft = Math.max(0, currentWindow.left - currentWindow.width);
        screenTop = currentWindow.top || 0;
      } else {
        // Window is small, use a reasonable default (1920x1080)
        screenWidth = 1920;
        screenHeight = 1080;
        screenLeft = 0;
        screenTop = 0;
      }
    }
    
    // Calculate half width for split view
    const halfWidth = Math.floor(screenWidth / 2);
    
    // Keep the original window height and top position
    const windowHeight = currentWindow.height;
    const windowTop = currentWindow.top || screenTop;
    
    // Resize current window to left half of screen (keep height unchanged)
    await chrome.windows.update(sourceWindowId, {
      left: screenLeft,
      top: windowTop,
      width: halfWidth,
      state: 'normal'
    });
    
    // Create new window on the right half of screen (same height as original)
    await chrome.windows.create({
      url: url,
      left: screenLeft + halfWidth,
      top: windowTop,
      width: halfWidth,
      height: windowHeight,
      type: 'normal',
      state: 'normal'
    });
    
    return { success: true };
  } catch (error) {
    console.error('Split view error:', error);
    // Fallback: just open in new tab
    await chrome.tabs.create({ url: url });
    return { success: true, fallback: true };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings').then(({ settings }) => {
      sendResponse(settings || DEFAULT_SETTINGS);
    });
    return true;
  }
  
  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'OPEN_SPLIT_VIEW') {
    const windowId = sender.tab?.windowId;
    if (windowId) {
      openInSplitView(message.url, windowId).then(sendResponse);
    } else {
      // Fallback: open in new tab
      chrome.tabs.create({ url: message.url }).then(() => {
        sendResponse({ success: true, fallback: true });
      });
    }
    return true;
  }
});
