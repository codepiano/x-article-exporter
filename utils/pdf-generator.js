/**
 * PDF Generator for X Articles
 * Creates styled PDF documents from extracted article data
 */

const PDFGenerator = {
  /**
   * Generate PDF from article data
   * @param {Object} article - Extracted article data
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} PDF blob
   */
  async generate(article, options = {}) {
    const {
      theme = 'light',
      pageSize = 'a4',
      includeMetrics = true,
      includeImages = true
    } = options;

    // Build HTML content for PDF
    const html = this.buildHTML(article, { theme, includeMetrics, includeImages });

    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    try {
      // Use html2pdf.js to generate PDF
      const opt = {
        margin: [15, 15, 15, 15],
        filename: this.generateFilename(article.title),
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: pageSize,
          orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // html2pdf is loaded via lib/html2pdf.bundle.min.js
      const pdf = await html2pdf().set(opt).from(container).outputPdf('blob');
      return pdf;
    } finally {
      // Cleanup
      document.body.removeChild(container);
    }
  },

  /**
   * Build HTML content for PDF
   */
  buildHTML(article, options) {
    const { theme, includeMetrics, includeImages } = options;
    const isDark = theme === 'dark';

    const styles = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: ${isDark ? '#e7e9ea' : '#0f1419'};
          background: ${isDark ? '#000000' : '#ffffff'};
          padding: 20px;
        }
        .header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid ${isDark ? '#2f3336' : '#eff3f4'};
        }
        .author {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }
        .author-info {
          flex: 1;
        }
        .author-name {
          font-weight: 700;
          font-size: 15px;
        }
        .author-handle {
          color: ${isDark ? '#71767b' : '#536471'};
          font-size: 14px;
        }
        .article-title {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 12px;
        }
        .article-date {
          color: ${isDark ? '#71767b' : '#536471'};
          font-size: 14px;
        }
        .article-url {
          color: ${isDark ? '#1d9bf0' : '#1d9bf0'};
          font-size: 12px;
          word-break: break-all;
          margin-top: 8px;
        }
        .content {
          font-size: 16px;
          line-height: 1.8;
        }
        .content p {
          margin-bottom: 16px;
        }
        .content h1, .content h2, .content h3 {
          margin-top: 24px;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .content h1 { font-size: 24px; }
        .content h2 { font-size: 20px; }
        .content h3 { font-size: 18px; }
        .content a {
          color: #1d9bf0;
          text-decoration: none;
        }
        .content img {
          max-width: 100%;
          height: auto;
          margin: 16px 0;
          border-radius: 12px;
        }
        .content ul, .content ol {
          margin: 16px 0;
          padding-left: 24px;
        }
        .content li {
          margin-bottom: 8px;
        }
        .content blockquote {
          border-left: 4px solid ${isDark ? '#1d9bf0' : '#1d9bf0'};
          padding-left: 16px;
          margin: 16px 0;
          color: ${isDark ? '#71767b' : '#536471'};
        }
        .images {
          margin-top: 24px;
        }
        .images img {
          max-width: 100%;
          height: auto;
          margin-bottom: 16px;
          border-radius: 12px;
        }
        .metrics {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid ${isDark ? '#2f3336' : '#eff3f4'};
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        .metric {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .metric-value {
          font-weight: 700;
        }
        .metric-label {
          color: ${isDark ? '#71767b' : '#536471'};
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 16px;
          border-top: 1px solid ${isDark ? '#2f3336' : '#eff3f4'};
          font-size: 12px;
          color: ${isDark ? '#71767b' : '#536471'};
          text-align: center;
        }
      </style>
    `;

    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${styles}
      </head>
      <body>
        <div class="header">
          <div class="author">
            ${article.author.avatar ? `<img class="author-avatar" src="${article.author.avatar}" alt="">` : ''}
            <div class="author-info">
              <div class="author-name">${this.escapeHtml(article.author.name)}</div>
              <div class="author-handle">${this.escapeHtml(article.author.handle)}</div>
            </div>
          </div>
          <h1 class="article-title">${this.escapeHtml(article.title)}</h1>
          <div class="article-date">${formatDate(article.date)}</div>
          <div class="article-url">${article.url}</div>
        </div>

        <div class="content">
          ${article.content.html || this.escapeHtml(article.content.text)}
        </div>
    `;

    // Add images section if there are standalone images
    if (includeImages && article.images && article.images.length > 0) {
      html += `<div class="images">`;
      article.images.forEach(img => {
        html += `<img src="${img.src}" alt="${this.escapeHtml(img.alt)}">`;
      });
      html += `</div>`;
    }

    // Add metrics
    if (includeMetrics) {
      html += `
        <div class="metrics">
          ${article.metrics.views ? `<div class="metric"><span class="metric-value">${formatNumber(article.metrics.views)}</span><span class="metric-label">Views</span></div>` : ''}
          ${article.metrics.likes ? `<div class="metric"><span class="metric-value">${formatNumber(article.metrics.likes)}</span><span class="metric-label">Likes</span></div>` : ''}
          ${article.metrics.reposts ? `<div class="metric"><span class="metric-value">${formatNumber(article.metrics.reposts)}</span><span class="metric-label">Reposts</span></div>` : ''}
          ${article.metrics.replies ? `<div class="metric"><span class="metric-value">${formatNumber(article.metrics.replies)}</span><span class="metric-label">Replies</span></div>` : ''}
          ${article.metrics.bookmarks ? `<div class="metric"><span class="metric-value">${formatNumber(article.metrics.bookmarks)}</span><span class="metric-label">Bookmarks</span></div>` : ''}
        </div>
      `;
    }

    html += `
        <div class="footer">
          Exported with X Article Exporter
        </div>
      </body>
      </html>
    `;

    return html;
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Generate filename for PDF
   */
  generateFilename(title) {
    let filename = (title || 'x_article')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);
    return filename + '.pdf';
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PDFGenerator = PDFGenerator;
}
