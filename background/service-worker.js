/**
 * X Article Exporter - Background Service Worker
 * Debug version with extensive logging
 */

// Debug logging to chrome.storage
const DEBUG = true;
const debugLogs = [];

function log(message, data = null) {
  const entry = {
    time: new Date().toISOString(),
    message,
    data: data ? JSON.stringify(data).substring(0, 500) : null
  };
  debugLogs.push(entry);
  console.log(`[X-Export] ${message}`, data || '');

  // Also store in chrome.storage for persistence
  if (DEBUG) {
    chrome.storage.local.set({ debugLogs: debugLogs.slice(-100) });
  }
}

log('Service worker starting...');

// ============================================
// Markdown Generator
// ============================================

const MarkdownGenerator = {
  generate(article, options = {}) {
    const {
      includeMetrics = true,
      includeImages = true,
      includeFrontmatter = true
    } = options;

    let markdown = '';

    if (includeFrontmatter) {
      markdown += this.generateFrontmatter(article, includeMetrics);
    }

    markdown += '# ' + article.title + '\n\n';
    markdown += '**Author:** ' + article.author.name + ' (' + article.author.handle + ')\n';
    markdown += '**Date:** ' + this.formatDate(article.date) + '\n';
    markdown += '**URL:** ' + article.url + '\n\n';
    markdown += '---\n\n';

    const contentMarkdown = this.htmlToMarkdown(article.content.html || article.content.text);
    markdown += contentMarkdown + '\n\n';

    if (includeImages && article.images && article.images.length > 0) {
      markdown += '## Images\n\n';
      article.images.forEach(function(img, index) {
        const alt = img.alt || 'Image ' + (index + 1);
        markdown += '![' + alt + '](' + img.src + ')\n\n';
      });
    }

    if (includeMetrics && this.hasMetrics(article.metrics)) {
      markdown += '---\n\n';
      markdown += '## Engagement\n\n';

      const metrics = [];
      if (article.metrics.views) metrics.push('- **Views:** ' + this.formatNumber(article.metrics.views));
      if (article.metrics.likes) metrics.push('- **Likes:** ' + this.formatNumber(article.metrics.likes));
      if (article.metrics.reposts) metrics.push('- **Reposts:** ' + this.formatNumber(article.metrics.reposts));
      if (article.metrics.replies) metrics.push('- **Replies:** ' + this.formatNumber(article.metrics.replies));
      if (article.metrics.bookmarks) metrics.push('- **Bookmarks:** ' + this.formatNumber(article.metrics.bookmarks));

      markdown += metrics.join('\n') + '\n';
    }

    return markdown;
  },

  generateFrontmatter(article, includeMetrics) {
    let yaml = '---\n';
    yaml += 'title: ' + this.escapeYamlValue(article.title) + '\n';
    yaml += 'author: ' + this.escapeYamlValue(article.author.name) + '\n';
    yaml += 'handle: ' + this.escapeYamlValue(article.author.handle) + '\n';
    yaml += 'date: ' + this.formatDate(article.date) + '\n';
    yaml += 'url: ' + this.escapeYamlValue(article.url) + '\n';
    yaml += 'exported: ' + new Date().toISOString() + '\n';

    if (includeMetrics && this.hasMetrics(article.metrics)) {
      yaml += 'metrics:\n';
      if (article.metrics.views) yaml += '  views: ' + article.metrics.views + '\n';
      if (article.metrics.likes) yaml += '  likes: ' + article.metrics.likes + '\n';
      if (article.metrics.reposts) yaml += '  reposts: ' + article.metrics.reposts + '\n';
      if (article.metrics.replies) yaml += '  replies: ' + article.metrics.replies + '\n';
      if (article.metrics.bookmarks) yaml += '  bookmarks: ' + article.metrics.bookmarks + '\n';
    }

    yaml += '---\n\n';
    return yaml;
  },

  escapeYamlValue(value) {
    if (typeof value === 'string') {
      if (/[:#\[\]{}|>&*!?,]/.test(value) || value.indexOf('\n') !== -1) {
        return '"' + value.replace(/"/g, '\\"') + '"';
      }
    }
    return value;
  },

  htmlToMarkdown(html) {
    if (!html) return '';

    let md = html;
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<[^>]+>/g, '');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    return md;
  },

  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return dateStr;
    }
  },

  formatNumber(num) {
    return num.toLocaleString();
  },

  hasMetrics(metrics) {
    if (!metrics) return false;
    return metrics.views || metrics.likes || metrics.reposts ||
           metrics.replies || metrics.bookmarks;
  }
};

log('MarkdownGenerator loaded');

// ============================================
// Message Handlers
// ============================================

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  log('Message received', { action: message.action });

  if (message.action === 'exportArticle') {
    handleExportArticle(message.article, message.format, sender.tab ? sender.tab.id : null)
      .then(function(result) {
        log('Export complete', result);
        sendResponse(result);
      })
      .catch(function(error) {
        log('Export error', { error: error.message });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }


  if (message.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.action === 'saveSettings') {
    saveSettings(message.settings).then(sendResponse);
    return true;
  }

  if (message.action === 'getDebugLogs') {
    sendResponse({ logs: debugLogs });
    return false;
  }

  return false;
});

log('Message listener registered');

// ============================================
// Export Functions
// ============================================

async function handleExportArticle(article, format, tabId) {
  log('handleExportArticle called', { format: format, title: article.title });

  const settings = await getSettings();
  log('Settings loaded', settings);

  try {
    if (format === 'pdf' || format === 'both') {
      await exportToPDF(article, settings);
    }

    if (format === 'md' || format === 'both') {
      await exportToMarkdown(article, settings);
    }

    return { success: true };
  } catch (error) {
    log('Export failed', { error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

async function exportToPDF(article, settings) {
  log('Generating PDF HTML');
  const html = generatePDFHTML(article, settings);

  // Convert to base64 data URL (service workers can't use URL.createObjectURL)
  const base64 = btoa(unescape(encodeURIComponent(html)));
  const dataUrl = 'data:text/html;base64,' + base64;
  const filename = generateFilename(article.title, 'html');

  log('Starting download', { filename: filename });
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

function generatePDFHTML(article, settings) {
  const isDark = settings.pdfTheme === 'dark';
  const bgColor = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#e7e9ea' : '#0f1419';
  const mutedColor = isDark ? '#71767b' : '#536471';
  const borderColor = isDark ? '#2f3336' : '#eff3f4';

  let html = '<!DOCTYPE html>\n<html>\n<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<title>' + escapeHtml(article.title) + '</title>\n';
  html += '<style>\n';
  html += '* { box-sizing: border-box; margin: 0; padding: 0; }\n';
  html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ';
  html += 'line-height: 1.6; color: ' + textColor + '; background: ' + bgColor + '; ';
  html += 'padding: 40px; max-width: 800px; margin: 0 auto; }\n';
  html += '.header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid ' + borderColor + '; }\n';
  html += '.author-name { font-weight: 700; font-size: 15px; }\n';
  html += '.author-handle { color: ' + mutedColor + '; font-size: 14px; }\n';
  html += '.article-title { font-size: 28px; font-weight: 700; line-height: 1.3; margin: 16px 0 12px 0; }\n';
  html += '.article-date { color: ' + mutedColor + '; font-size: 14px; }\n';
  html += '.article-url { color: #1d9bf0; font-size: 12px; word-break: break-all; margin-top: 8px; }\n';
  html += '.content { font-size: 16px; line-height: 1.8; }\n';
  html += '.content p { margin-bottom: 16px; }\n';
  html += '.content img { max-width: 100%; height: auto; margin: 16px 0; border-radius: 12px; }\n';
  html += '.metrics { margin-top: 30px; padding-top: 20px; border-top: 1px solid ' + borderColor + '; }\n';
  html += '.metric { display: inline-block; margin-right: 24px; }\n';
  html += '.metric-value { font-weight: 700; }\n';
  html += '.metric-label { color: ' + mutedColor + '; font-size: 14px; margin-left: 4px; }\n';
  html += '.footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid ' + borderColor + '; ';
  html += 'font-size: 12px; color: ' + mutedColor + '; text-align: center; }\n';
  html += '</style>\n</head>\n<body>\n';

  html += '<div class="header">\n';
  html += '<div class="author-name">' + escapeHtml(article.author.name) + '</div>\n';
  html += '<div class="author-handle">' + escapeHtml(article.author.handle) + '</div>\n';
  html += '<h1 class="article-title">' + escapeHtml(article.title) + '</h1>\n';
  html += '<div class="article-date">' + formatDate(article.date) + '</div>\n';
  html += '<div class="article-url">' + article.url + '</div>\n';
  html += '</div>\n';

  const contentHtml = settings.includeImages === false
    ? (article.content.html || '').replace(/<img[^>]*>/gi, '')
    : article.content.html;

  html += '<div class="content">\n';
  html += contentHtml || escapeHtml(article.content.text);
  html += '\n</div>\n';

  if (settings.includeMetrics && article.metrics) {
    html += '<div class="metrics">\n';
    if (article.metrics.views) html += '<span class="metric"><span class="metric-value">' + formatNumber(article.metrics.views) + '</span><span class="metric-label">Views</span></span>\n';
    if (article.metrics.likes) html += '<span class="metric"><span class="metric-value">' + formatNumber(article.metrics.likes) + '</span><span class="metric-label">Likes</span></span>\n';
    if (article.metrics.reposts) html += '<span class="metric"><span class="metric-value">' + formatNumber(article.metrics.reposts) + '</span><span class="metric-label">Reposts</span></span>\n';
    if (article.metrics.replies) html += '<span class="metric"><span class="metric-value">' + formatNumber(article.metrics.replies) + '</span><span class="metric-label">Replies</span></span>\n';
    if (article.metrics.bookmarks) html += '<span class="metric"><span class="metric-value">' + formatNumber(article.metrics.bookmarks) + '</span><span class="metric-label">Bookmarks</span></span>\n';
    html += '</div>\n';
  }

  html += '<div class="footer">Exported with X Article Exporter</div>\n';
  html += '</body>\n</html>';

  return html;
}

async function exportToMarkdown(article, settings) {
  log('Generating Markdown');
  const markdown = MarkdownGenerator.generate(article, {
    includeMetrics: settings.includeMetrics,
    includeImages: settings.includeImages,
    includeFrontmatter: settings.includeFrontmatter
  });

  // Convert to base64 data URL (service workers can't use URL.createObjectURL)
  const base64 = btoa(unescape(encodeURIComponent(markdown)));
  const dataUrl = 'data:text/markdown;base64,' + base64;
  const filename = generateFilename(article.title, 'md');

  log('Starting markdown download', { filename: filename });
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ============================================
// Settings
// ============================================

async function getSettings() {
  const defaults = {
    pdfTheme: 'light',
    includeMetrics: true,
    includeImages: true,
    includeFrontmatter: true,
    multiSelectEnabled: false
  };

  try {
    const result = await chrome.storage.sync.get('settings');
    return Object.assign({}, defaults, result.settings || {});
  } catch (e) {
    log('Error getting settings', { error: e.message });
    return defaults;
  }
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings: settings });
  return { success: true };
}

// ============================================
// Utilities
// ============================================

function generateFilename(title, extension) {
  let filename = (title || 'x_article')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 80);

  return 'x_articles/' + filename + '.' + extension;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

log('Service worker fully initialized');
