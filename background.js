/**
 * AI Search Compare - Background Service Worker
 */

const DEFAULT_SETTINGS = {
  enabledEngines: ['google', 'google-ai', 'gemini', 'chatgpt', 'claude', 'perplexity'],
  barVisible: true
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  updateIcon(true);
});

// Restore icon state on startup
chrome.storage.local.get('settings').then(({ settings }) => {
  updateIcon(settings?.barVisible !== false);
});

// ============================================
// ICON MANAGEMENT
// ============================================
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
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
    return ctx.getImageData(0, 0, size, size);
  } catch (e) {
    return null;
  }
}

async function updateIcon(isVisible) {
  if (isVisible) {
    chrome.action.setIcon({
      path: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
    });
    chrome.action.setTitle({ title: "AI Search Compare (Click to hide)" });
  } else {
    try {
      const [icon16, icon48] = await Promise.all([createGrayscaleIcon(16), createGrayscaleIcon(48)]);
      if (icon16 && icon48) {
        chrome.action.setIcon({ imageData: { "16": icon16, "48": icon48 } });
      }
    } catch (e) {}
    chrome.action.setTitle({ title: "AI Search Compare (Click to show)" });
  }
}

// Handle icon click - toggle visibility
chrome.action.onClicked.addListener(async (tab) => {
  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings = settings || DEFAULT_SETTINGS;
  
  const newVisible = !currentSettings.barVisible;
  currentSettings.barVisible = newVisible;
  
  await chrome.storage.local.set({ settings: currentSettings });
  updateIcon(newVisible);
  
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_BAR_VISIBILITY', visible: newVisible });
  } catch (e) {}
});

// ============================================
// SPLIT VIEW
// ============================================
async function getDisplayForWindow(left, top, width, height) {
  try {
    if (chrome.system?.display) {
      const displays = await chrome.system.display.getInfo();
      if (displays?.length) {
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        
        for (const d of displays) {
          const b = d.bounds;
          if (centerX >= b.left && centerX < b.left + b.width &&
              centerY >= b.top && centerY < b.top + b.height) {
            return { width: d.workArea.width, height: d.workArea.height, left: d.workArea.left, top: d.workArea.top };
          }
        }
        
        // Find closest display
        let closest = displays[0];
        let minDist = Infinity;
        for (const d of displays) {
          const dist = Math.hypot(centerX - (d.bounds.left + d.bounds.width/2), centerY - (d.bounds.top + d.bounds.height/2));
          if (dist < minDist) { minDist = dist; closest = d; }
        }
        return { width: closest.workArea.width, height: closest.workArea.height, left: closest.workArea.left, top: closest.workArea.top };
      }
    }
  } catch (e) {}
  return null;
}

async function openInSplitView(url, sourceWindowId) {
  try {
    const win = await chrome.windows.get(sourceWindowId);
    const screen = await getDisplayForWindow(win.left || 0, win.top || 0, win.width, win.height);
    
    let screenWidth, screenLeft, screenTop;
    if (screen) {
      screenWidth = screen.width;
      screenLeft = screen.left;
      screenTop = screen.top;
    } else if (win.width > 1200) {
      screenWidth = win.width;
      screenLeft = win.left || 0;
      screenTop = win.top || 0;
    } else if (win.width > 600) {
      screenWidth = win.width * 2;
      screenLeft = Math.max(0, win.left - win.width);
      screenTop = win.top || 0;
    } else {
      screenWidth = 1920;
      screenLeft = 0;
      screenTop = 0;
    }
    
    const halfWidth = Math.floor(screenWidth / 2);
    
    await chrome.windows.update(sourceWindowId, {
      left: screenLeft, top: win.top || screenTop, width: halfWidth, state: 'normal'
    });
    
    await chrome.windows.create({
      url, left: screenLeft + halfWidth, top: win.top || screenTop, width: halfWidth, height: win.height, type: 'normal', state: 'normal'
    });
    
    return { success: true };
  } catch (e) {
    await chrome.tabs.create({ url });
    return { success: true, fallback: true };
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings').then(({ settings }) => {
      sendResponse(settings || DEFAULT_SETTINGS);
    });
    return true;
  }
  
  if (message.type === 'OPEN_SPLIT_VIEW') {
    const windowId = sender.tab?.windowId;
    if (windowId) {
      openInSplitView(message.url, windowId).then(sendResponse);
    } else {
      chrome.tabs.create({ url: message.url }).then(() => sendResponse({ success: true, fallback: true }));
    }
    return true;
  }
});
