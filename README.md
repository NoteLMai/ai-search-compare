# AI Search Compare

A Chrome extension that adds a convenient tab bar above Google's search box, allowing you to quickly switch between multiple AI search engines and compare results side-by-side.

## Features

- **Quick Engine Switching**: Seamlessly switch between Google, Google AI Mode, Gemini, ChatGPT, Claude, and Perplexity
- **Split View**: Automatically opens search results in a side-by-side split view for easy comparison
- **Keyboard Shortcuts**: Use `Alt+1` through `Alt+6` to quickly switch between enabled engines
- **Customizable**: Enable/disable specific search engines and customize the tab bar order
- **Auto-fill Support**: Automatically fills and submits queries for Claude and Gemini
- **Toggle Visibility**: Click the extension icon to show/hide the tab bar

## Supported Search Engines

- **Google** - Standard Google search
- **Google AI Mode** - Google's AI-powered search (udm=50)
- **Gemini** - Google's Gemini AI assistant
- **ChatGPT** - OpenAI's ChatGPT search mode
- **Claude** - Anthropic's Claude AI
- **Perplexity** - Perplexity AI search

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ai-search-compare.git
   cd ai-search-compare
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the `ai-search-compare` directory

5. The extension is now installed and ready to use!

## Usage

1. Navigate to [Google Search](https://www.google.com)

2. You'll see a tab bar above the search box with buttons for each enabled search engine

3. Type your search query in Google's search box

4. Click any engine button to open that search engine with your query in a split view

5. Use keyboard shortcuts (`Alt+1` to `Alt+6`) when the search input is focused for quick switching

6. Click the extension icon in Chrome's toolbar to toggle the tab bar visibility

## How It Works

- **Content Script**: Injects a tab bar UI above Google's search box
- **Background Service Worker**: Handles split view window management and settings storage
- **Helper Scripts**: Auto-fill and submit queries for Claude and Gemini (which don't support URL parameters)

## Permissions

This extension requires the following permissions:

- `storage` - To save your preferences and settings
- `activeTab` - To interact with Google Search pages
- `windows` - To create split view windows
- `system.display` - To properly position windows on multi-monitor setups
- `tabs` - To manage tab creation
- Host permissions for Google, Perplexity, ChatGPT, Claude, and Gemini domains

## Development

### Project Structure

```
ai-search-compare/
├── manifest.json          # Extension manifest
├── background.js          # Service worker for split view and settings
├── content.js            # Main content script for Google Search
├── claude-helper.js      # Auto-fill helper for Claude
├── gemini-helper.js      # Auto-fill helper for Gemini
├── styles.css            # Tab bar styles
├── neural-glass.css      # Shared design system (unused in this extension)
└── icons/                # Extension icons
```

### Building

No build process required - this is a pure JavaScript extension. Just load it in Chrome as described in the Installation section.

## Configuration

Settings are stored in Chrome's local storage and can be customized:

- `enabledEngines`: Array of engine IDs to show in the tab bar
- `defaultEngine`: Default search engine (currently unused)
- `lastUsedEngine`: Last selected engine
- `barVisible`: Whether the tab bar is visible

## Browser Compatibility

- Chrome/Chromium (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with modern web technologies and Chrome Extension APIs. Designed for seamless integration with Google Search and popular AI search engines.
