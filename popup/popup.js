/**
 * X Article Exporter - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkPageStatus();
  setupEventListeners();
});

/**
 * Load settings from storage
 */
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

  if (response) {
    document.getElementById('pdfTheme').value = response.pdfTheme || 'light';
    document.getElementById('includeMetrics').checked = response.includeMetrics !== false;
    document.getElementById('includeImages').checked = response.includeImages !== false;
    document.getElementById('includeFrontmatter').checked = response.includeFrontmatter !== false;
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    pdfTheme: document.getElementById('pdfTheme').value,
    includeMetrics: document.getElementById('includeMetrics').checked,
    includeImages: document.getElementById('includeImages').checked,
    includeFrontmatter: document.getElementById('includeFrontmatter').checked
  };

  await chrome.runtime.sendMessage({ action: 'saveSettings', settings });
}

/**
 * Check if current tab is on an article page
 */
async function checkPageStatus() {
  const quickExport = document.getElementById('quickExport');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      updateStatus('not-x', 'Navigate to X to export');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkArticlePage' });

    if (response && response.isArticle) {
      updateStatus('success', 'Ready to export');
      quickExport.style.display = 'block';
    } else {
      updateStatus('info', 'Open a post or article to export');
    }
  } catch (error) {
    console.error('Status check error:', error);
    updateStatus('error', 'Refresh page and try again');
  }
}

/**
 * Update status display
 */
function updateStatus(type, message) {
  const statusEl = document.getElementById('pageStatus');
  const iconEl = statusEl.querySelector('.status-icon');
  const textEl = statusEl.querySelector('.status-text');

  iconEl.className = 'status-icon';

  switch (type) {
    case 'success':
      iconEl.classList.add('success');
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>`;
      break;
    case 'error':
      iconEl.classList.add('error');
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>`;
      break;
    default:
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>`;
  }

  textEl.textContent = message;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  document.getElementById('exportPdf').addEventListener('click', () => exportArticle('pdf'));
  document.getElementById('exportMd').addEventListener('click', () => exportArticle('md'));
  document.getElementById('exportCopy').addEventListener('click', () => exportArticle('copy'));

  ['pdfTheme', 'includeMetrics', 'includeImages', 'includeFrontmatter'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });
}

/**
 * Export current article
 */
async function exportArticle(format) {
  const buttons = document.querySelectorAll('.export-btn');
  buttons.forEach(btn => btn.disabled = true);
  updateStatus('info', 'Exporting...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // For PDF and copy, use content script directly (needs DOM access)
    if (format === 'pdf' || format === 'copy') {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'exportDirect',
        format: format,
        options: {
          includeImages: document.getElementById('includeImages').checked
        }
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Export failed');
      }

      updateStatus('success', format === 'copy' ? 'Copied!' : 'PDF ready!');
      return;
    }

    // For markdown, extract then send to service worker
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractArticle',
      options: {
        includeImages: document.getElementById('includeImages').checked
      }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to extract content');
    }

    const exportResponse = await chrome.runtime.sendMessage({
      action: 'exportArticle',
      article: response.article,
      format: format
    });

    if (!exportResponse || !exportResponse.success) {
      throw new Error(exportResponse?.error || 'Export failed');
    }

    updateStatus('success', 'Export complete!');

  } catch (error) {
    console.error('Export error:', error);
    updateStatus('error', error.message);
  } finally {
    buttons.forEach(btn => btn.disabled = false);
  }
}
