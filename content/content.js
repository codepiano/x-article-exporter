/**
 * X Article Exporter - Content Script
 * Injects export functionality into X pages
 */

(function() {
  'use strict';

  console.log('[X-Export] Content script loading...');

  // State management
  const state = {
    exportButton: null,
    observer: null,
    checkInterval: null
  };

  /**
   * Initialize the content script
   */
  function init() {
    console.log('[X-Export] Initializing...');
    startContentCheck();
    observeNavigation();
    chrome.runtime.onMessage.addListener(handleMessage);
    console.log('[X-Export] Initialization complete');
  }

  /**
   * Start checking for content periodically
   */
  function startContentCheck() {
    checkAndInjectButton();

    let checks = 0;
    state.checkInterval = setInterval(() => {
      checks++;
      checkAndInjectButton();
      if (checks >= 10) {
        clearInterval(state.checkInterval);
        state.checkInterval = null;
      }
    }, 1000);
  }

  /**
   * Check if we're on a valid page and inject button
   */
  function checkAndInjectButton() {
    const url = window.location.href;
    const isValidPage = /https:\/\/(x\.com|twitter\.com)\/[^/]+\/(status|article)\/\d+/.test(url) ||
                        /https:\/\/(x\.com|twitter\.com)\/home/.test(url);

    console.log('[X-Export] Checking page:', url, 'isValid:', isValidPage);

    if (!isValidPage) {
      removeExportButton();
      return;
    }

    // Check if content has loaded
    const content = document.querySelector('[data-testid="tweetText"]') ||
                    document.querySelector('.public-DraftEditor-content') ||
                    document.querySelector('[class*="longform"]') ||
                    document.querySelector('article');

    if (!content) {
      console.log('[X-Export] Content not loaded yet...');
      return;
    }

    if (document.querySelector('.x-article-export-btn')) {
      return;
    }

    console.log('[X-Export] Content found, injecting button');
    injectExportButton();
  }

  /**
   * Observe URL changes for SPA navigation
   */
  function observeNavigation() {
    let lastUrl = location.href;

    state.observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        console.log('[X-Export] URL changed');
        lastUrl = location.href;
        onNavigate();
      }
    });

    state.observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('popstate', () => {
      setTimeout(onNavigate, 100);
    });
  }

  /**
   * Handle navigation
   */
  function onNavigate() {
    if (state.checkInterval) {
      clearInterval(state.checkInterval);
    }
    removeExportButton();
    startContentCheck();
  }

  /**
   * Remove the export button
   */
  function removeExportButton() {
    const button = document.querySelector('.x-article-export-btn');
    if (button) {
      button.remove();
      state.exportButton = null;
    }
  }

  /**
   * Inject the export button
   */
  function injectExportButton() {
    if (document.querySelector('.x-article-export-btn')) return;

    const button = document.createElement('div');
    button.className = 'x-article-export-btn';
    button.innerHTML = `
      <button class="export-main-btn" title="Export">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        <span>Export</span>
      </button>
      <div class="export-dropdown">
        <button class="export-option" data-format="pdf">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
          </svg>
          PDF
        </button>
        <button class="export-option" data-format="md">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41z"/>
          </svg>
          Markdown
        </button>
        <button class="export-option" data-format="both">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          Both
        </button>
        <div class="export-divider"></div>
        <button class="export-option" data-format="copy">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          Copy to Clipboard
        </button>
      </div>
    `;

    const mainBtn = button.querySelector('.export-main-btn');
    const dropdown = button.querySelector('.export-dropdown');

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    button.querySelectorAll('.export-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('show');
        exportArticle(opt.dataset.format);
      });
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    document.body.appendChild(button);
    state.exportButton = button;
    console.log('[X-Export] Export button injected');
  }

  /**
   * Export the current article
   */
  async function exportArticle(format) {
    console.log('[X-Export] Starting export, format:', format);
    showNotification('Extracting content...', 'info');

    try {
      if (typeof XArticleExtractor === 'undefined') {
        throw new Error('Extractor not loaded');
      }

      const article = XArticleExtractor.extractArticle();
      console.log('[X-Export] Extracted:', article.title, '- Content length:', article.content.text.length);

      if (!article.content.text && !article.content.html) {
        showNotification('Could not extract content', 'error');
        return;
      }

      // Handle copy to clipboard locally
      if (format === 'copy') {
        await copyToClipboard(article);
        return;
      }

      // Handle PDF generation locally (needs DOM access)
      if (format === 'pdf' || format === 'both') {
        showNotification('Opening PDF preview...', 'info');
        await generatePDF(article);
        if (format === 'pdf') {
          showNotification('PDF ready - use Print to save', 'success');
          return;
        }
      }

      // For markdown or both (after PDF), send to service worker
      if (format === 'md' || format === 'both') {
        showNotification('Generating Markdown...', 'info');
        chrome.runtime.sendMessage({
          action: 'exportArticle',
          article: article,
          format: 'md'
        }, (response) => {
          if (response && response.success) {
            showNotification('Export complete!', 'success');
          } else {
            showNotification(response?.error || 'Export failed', 'error');
          }
        });
      }

    } catch (error) {
      console.error('[X-Export] Export error:', error);
      showNotification('Export failed: ' + error.message, 'error');
    }
  }

  /**
   * Copy article as markdown to clipboard
   */
  async function copyToClipboard(article) {
    try {
      const markdown = generateMarkdown(article);

      // Try modern clipboard API first
      if (navigator.clipboard && document.hasFocus()) {
        await navigator.clipboard.writeText(markdown);
      } else {
        // Fallback for when document isn't focused
        const textarea = document.createElement('textarea');
        textarea.value = markdown;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showNotification('Copied to clipboard!', 'success');
    } catch (error) {
      console.error('[X-Export] Clipboard error:', error);
      showNotification('Failed to copy: ' + error.message, 'error');
    }
  }

  /**
   * Generate markdown from article
   */
  function generateMarkdown(article) {
    let md = '';

    // Frontmatter
    md += '---\n';
    md += 'title: "' + (article.title || '').replace(/"/g, '\\"') + '"\n';
    md += 'author: ' + article.author.name + '\n';
    md += 'handle: ' + article.author.handle + '\n';
    md += 'date: ' + article.date + '\n';
    md += 'url: ' + article.url + '\n';
    if (article.metrics) {
      md += 'metrics:\n';
      if (article.metrics.views) md += '  views: ' + article.metrics.views + '\n';
      if (article.metrics.likes) md += '  likes: ' + article.metrics.likes + '\n';
      if (article.metrics.reposts) md += '  reposts: ' + article.metrics.reposts + '\n';
      if (article.metrics.replies) md += '  replies: ' + article.metrics.replies + '\n';
    }
    md += '---\n\n';

    // Content
    md += '# ' + article.title + '\n\n';
    md += '**Author:** ' + article.author.name + ' (' + article.author.handle + ')  \n';
    md += '**Date:** ' + new Date(article.date).toLocaleDateString() + '  \n';
    md += '**URL:** ' + article.url + '\n\n';
    md += '---\n\n';
    md += htmlToMarkdown(article.content.html || article.content.text || '') + '\n\n';

    // Images
    if (article.images && article.images.length > 0) {
      md += '## Images\n\n';
      article.images.forEach((img, i) => {
        md += '![' + (img.alt || 'Image ' + (i + 1)) + '](' + img.src + ')\n\n';
      });
    }

    // Metrics
    if (article.metrics && (article.metrics.views || article.metrics.likes)) {
      md += '---\n\n## Engagement\n\n';
      if (article.metrics.views) md += '- **Views:** ' + article.metrics.views.toLocaleString() + '\n';
      if (article.metrics.likes) md += '- **Likes:** ' + article.metrics.likes.toLocaleString() + '\n';
      if (article.metrics.reposts) md += '- **Reposts:** ' + article.metrics.reposts.toLocaleString() + '\n';
      if (article.metrics.replies) md += '- **Replies:** ' + article.metrics.replies.toLocaleString() + '\n';
    }

    return md;
  }

  /**
   * Convert extracted HTML to Markdown while preserving heading hierarchy.
   */
  function htmlToMarkdown(content) {
    if (!content) return '';

    const source = String(content);
    if (!/<[a-z][\s\S]*>/i.test(source)) {
      return source.trim();
    }

    return source
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n')
      .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n')
      .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n\n')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n\n')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Generate and download PDF using print dialog
   */
  async function generatePDF(article) {
    // Get settings
    const settings = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, resolve);
    });

    const isDark = settings.pdfTheme === 'dark';
    const bgColor = isDark ? '#000000' : '#ffffff';
    const textColor = isDark ? '#e7e9ea' : '#0f1419';
    const mutedColor = isDark ? '#71767b' : '#536471';

    const filename = (article.title || 'x_article')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 80);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(article.title)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: ${textColor};
      background: ${bgColor};
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid ${isDark ? '#2f3336' : '#eff3f4'}; }
    .author-name { font-weight: 700; font-size: 15px; }
    .author-handle { color: ${mutedColor}; font-size: 14px; }
    h1 { font-size: 28px; font-weight: 700; line-height: 1.3; margin: 16px 0 12px 0; }
    .date { color: ${mutedColor}; font-size: 14px; }
    .url { color: #1d9bf0; font-size: 12px; word-break: break-all; margin-top: 8px; }
    .content { font-size: 16px; line-height: 1.8; white-space: pre-wrap; }
    .metrics { margin-top: 30px; padding-top: 20px; border-top: 1px solid ${isDark ? '#2f3336' : '#eff3f4'}; }
    .metric { display: inline-block; margin-right: 24px; }
    .metric strong { font-weight: 700; }
    .metric span { color: ${mutedColor}; font-size: 14px; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid ${isDark ? '#2f3336' : '#eff3f4'}; font-size: 12px; color: ${mutedColor}; text-align: center; }
    .print-instructions { background: #1d9bf0; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .print-instructions button { background: white; color: #1d9bf0; border: none; padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; margin-left: 10px; }
    @media print { .print-instructions { display: none; } }
  </style>
</head>
<body>
  <div class="print-instructions">
    Press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) and select "Save as PDF"
    <button onclick="window.print()">Print to PDF</button>
  </div>
  <div class="header">
    <div class="author-name">${escapeHtml(article.author.name)}</div>
    <div class="author-handle">${escapeHtml(article.author.handle)}</div>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="date">${new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="url">${article.url}</div>
  </div>
  <div class="content">${escapeHtml(article.content.text)}</div>
  ${settings.includeMetrics && article.metrics ? `
    <div class="metrics">
      ${article.metrics.views ? `<span class="metric"><strong>${formatNumber(article.metrics.views)}</strong> <span>Views</span></span>` : ''}
      ${article.metrics.likes ? `<span class="metric"><strong>${formatNumber(article.metrics.likes)}</strong> <span>Likes</span></span>` : ''}
      ${article.metrics.reposts ? `<span class="metric"><strong>${formatNumber(article.metrics.reposts)}</strong> <span>Reposts</span></span>` : ''}
      ${article.metrics.replies ? `<span class="metric"><strong>${formatNumber(article.metrics.replies)}</strong> <span>Replies</span></span>` : ''}
    </div>
  ` : ''}
  <div class="footer">Exported with X Article Exporter</div>
  <script>
    document.title = "${escapeHtml(filename)}";
  </script>
</body>
</html>`;

    // Open in new tab for printing
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /**
   * Escape HTML entities
   */
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Format large numbers
   */
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  /**
   * Handle messages from popup
   */
  function handleMessage(message, sender, sendResponse) {
    console.log('[X-Export] Message:', message.action);

    switch (message.action) {
      case 'checkArticlePage':
        const isPage = XArticleExtractor ? XArticleExtractor.isArticlePage() : false;
        sendResponse({ isArticle: isPage });
        break;

      case 'extractArticle':
        try {
          if (!XArticleExtractor) {
            sendResponse({ success: false, error: 'Extractor not loaded' });
            break;
          }
          const article = XArticleExtractor.extractArticle();
          sendResponse({ success: true, article: article });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'exportDirect':
        // Handle PDF and copy directly in content script
        handleExportDirect(message.format)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response

      default:
        sendResponse({ error: 'Unknown action' });
    }

    return true;
  }

  /**
   * Handle direct export (PDF/copy) from popup
   */
  async function handleExportDirect(format) {
    try {
      if (!XArticleExtractor) {
        throw new Error('Extractor not loaded');
      }

      const article = XArticleExtractor.extractArticle();

      if (!article.content.text && !article.content.html) {
        throw new Error('Could not extract content');
      }

      if (format === 'copy') {
        await copyToClipboard(article);
        return { success: true };
      }

      if (format === 'pdf') {
        await generatePDF(article);
        showNotification('PDF ready - use Print to save', 'success');
        return { success: true };
      }

      throw new Error('Unknown format: ' + format);
    } catch (error) {
      showNotification('Export failed: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Show notification toast
   */
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.x-export-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `x-export-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

  console.log('[X-Export] Content script loaded');
})();
