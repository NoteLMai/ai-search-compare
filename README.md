# AI Search Compare

A Chrome extension that adds a convenient tab bar above Google's search box, allowing you to quickly compare search results across multiple AI-powered search engines including Google AI, Gemini, ChatGPT, Claude, and Perplexity.

## Features

- **Quick Access**: Switch between AI search engines with a single click
- **Split View**: Opens search results in a side-by-side split view for easy comparison
- **Auto-fill & Submit**: Automatically fills and submits queries to Claude and Gemini
- **Toggle Visibility**: Click the extension icon to show/hide the tab bar
- **Smart Positioning**: Tab bar automatically positions itself above the search box
- **Dark Mode Support**: Automatically adapts to your system theme

## Supported Search Engines

- **Google** - Traditional Google search
- **Google AI** - Google's AI-powered search mode
- **Gemini** - Google's Gemini AI assistant
- **ChatGPT** - OpenAI's ChatGPT
- **Claude** - Anthropic's Claude AI
- **Perplexity** - Perplexity AI search

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd ai-search-compare
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the `ai-search-compare` directory

5. The extension is now installed and ready to use!

## Usage

1. Go to [Google Search](https://www.google.com)

2. You'll see a tab bar appear above the search box with buttons for each AI search engine

3. Enter your search query in Google's search box

4. Click any AI search engine button to open that engine with your query in a split view

5. Compare results side-by-side across different AI engines

6. Click the extension icon in Chrome's toolbar to toggle the tab bar visibility

## How It Works

- **Content Script**: Injects a tab bar above Google's search box when you're on Google Search
- **Background Service**: Handles opening search engines in split view windows
- **Helper Scripts**: Auto-fill and submit queries for Claude and Gemini (which don't support direct URL parameters)

## Permissions

This extension requires the following permissions:

- `storage` - To save your preferences (enabled engines, visibility settings)
- `activeTab` - To interact with the current Google Search page
- `windows` - To create split view windows
- `system.display` - To detect your display configuration for optimal window placement
- `tabs` - To open new tabs when split view is not available

## Development

### Project Structure

```
ai-search-compare/
├── manifest.json          # Extension manifest
├── background.js          # Service worker for split view and settings
├── content.js             # Main content script for Google Search
├── claude-helper.js       # Auto-fill helper for Claude
├── gemini-helper.js       # Auto-fill helper for Gemini
├── styles.css             # Tab bar styles
├── neural-glass.css       # Design system (shared)
└── icons/                 # Extension icons
```

### Building

No build process required - this is a vanilla JavaScript extension. Just load it in Chrome as described in the Installation section.

## Configuration

The extension stores settings in Chrome's local storage:

- `enabledEngines`: Array of engine IDs to show in the tab bar
- `barVisible`: Boolean to control tab bar visibility

You can modify these settings by clicking the extension icon and toggling visibility, or by editing the default settings in `background.js`.

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues or have feature requests, please open an issue on GitHub.

## Acknowledgments

- Inspired by the need to quickly compare AI search engine results
- Gemini helper based on the `gemini-url-prompt` extension pattern
