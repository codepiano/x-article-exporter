# X Article Exporter

A Chrome extension to export X (Twitter) articles, tweets, and threads to PDF and Markdown formats.

## Features

- **Export to PDF** - Styled preview with print-to-PDF support
- **Export to Markdown** - Clean markdown with YAML frontmatter
- **Copy to Clipboard** - Quick copy as markdown
- **Full Content Extraction** - Captures long-form articles, tweets, and threads
- **Metadata Included** - Author, date, URL, and engagement metrics

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the extension folder

## Usage

### Floating Button
1. Navigate to any X post or article
2. Click the **Export** button (bottom right of page)
3. Choose: PDF, Markdown, Both, or Copy to Clipboard

### Popup Menu
1. Click the extension icon in Chrome toolbar
2. Select export format: PDF, Markdown, or Copy

## Export Formats

### PDF
Opens a styled preview page. Use `Ctrl+P` (or `Cmd+P` on Mac) and select "Save as PDF".

### Markdown
Downloads a `.md` file with:
- YAML frontmatter (title, author, date, URL, metrics)
- Full article content
- Image references
- Engagement stats

### Copy
Copies markdown-formatted content directly to clipboard.

## Settings

Access via the extension popup:

- **PDF Theme** - Light or dark mode
- **Include Metrics** - Show engagement stats (views, likes, reposts, replies)
- **Include Images** - Add image references
- **Include Frontmatter** - Add YAML metadata header (Markdown only)

## Supported Content

- Long-form X Articles (Draft.js content)
- Regular tweets
- Tweet threads
- Home feed (bulk export)

## Permissions

- `activeTab` - Access current tab content
- `storage` - Save user preferences
- `downloads` - Download exported files
- Host permissions for `x.com` and `twitter.com`

## File Structure

```
x-article-exporter/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Background processing
├── content/
│   ├── content.js         # Page injection & export logic
│   └── content.css        # Button & notification styles
├── popup/
│   ├── popup.html         # Settings UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── utils/
│   └── extractor.js       # Content extraction
├── lib/                   # External libraries
└── icons/                 # Extension icons
```

## License

MIT
