/**
 * Markdown Generator for X Articles
 * Creates Markdown documents with YAML frontmatter from extracted article data
 */

const MarkdownGenerator = {
  /**
   * Generate Markdown from article data
   * @param {Object} article - Extracted article data
   * @param {Object} options - Generation options
   * @returns {string} Markdown content
   */
  generate(article, options = {}) {
    const {
      includeMetrics = true,
      includeImages = true,
      includeFrontmatter = true
    } = options;

    let markdown = '';

    // Add YAML frontmatter
    if (includeFrontmatter) {
      markdown += this.generateFrontmatter(article, includeMetrics);
    }

    // Add title
    markdown += `# ${article.title}\n\n`;

    // Add author info
    markdown += `**Author:** ${article.author.name} (${article.author.handle})\n`;
    markdown += `**Date:** ${this.formatDate(article.date)}\n`;
    markdown += `**URL:** ${article.url}\n\n`;

    markdown += '---\n\n';

    // Convert HTML content to Markdown
    const contentMarkdown = this.htmlToMarkdown(article.content.html || article.content.text);
    markdown += contentMarkdown + '\n\n';

    // Add images
    if (includeImages && article.images && article.images.length > 0) {
      markdown += '## Images\n\n';
      article.images.forEach((img, index) => {
        const alt = img.alt || `Image ${index + 1}`;
        markdown += `![${alt}](${img.src})\n\n`;
      });
    }

    // Add metrics section
    if (includeMetrics && this.hasMetrics(article.metrics)) {
      markdown += '---\n\n';
      markdown += '## Engagement\n\n';

      const metrics = [];
      if (article.metrics.views) metrics.push(`- **Views:** ${this.formatNumber(article.metrics.views)}`);
      if (article.metrics.likes) metrics.push(`- **Likes:** ${this.formatNumber(article.metrics.likes)}`);
      if (article.metrics.reposts) metrics.push(`- **Reposts:** ${this.formatNumber(article.metrics.reposts)}`);
      if (article.metrics.replies) metrics.push(`- **Replies:** ${this.formatNumber(article.metrics.replies)}`);
      if (article.metrics.bookmarks) metrics.push(`- **Bookmarks:** ${this.formatNumber(article.metrics.bookmarks)}`);

      markdown += metrics.join('\n') + '\n';
    }

    return markdown;
  },

  /**
   * Generate YAML frontmatter
   */
  generateFrontmatter(article, includeMetrics) {
    const frontmatter = {
      title: article.title,
      author: article.author.name,
      handle: article.author.handle,
      date: this.formatDate(article.date),
      url: article.url,
      exported: new Date().toISOString()
    };

    if (includeMetrics && this.hasMetrics(article.metrics)) {
      frontmatter.metrics = {};
      if (article.metrics.views) frontmatter.metrics.views = article.metrics.views;
      if (article.metrics.likes) frontmatter.metrics.likes = article.metrics.likes;
      if (article.metrics.reposts) frontmatter.metrics.reposts = article.metrics.reposts;
      if (article.metrics.replies) frontmatter.metrics.replies = article.metrics.replies;
      if (article.metrics.bookmarks) frontmatter.metrics.bookmarks = article.metrics.bookmarks;
    }

    return '---\n' + this.toYaml(frontmatter) + '---\n\n';
  },

  /**
   * Convert object to YAML string
   */
  toYaml(obj, indent = 0) {
    let yaml = '';
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${prefix}${key}:\n`;
        yaml += this.toYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${prefix}${key}:\n`;
        value.forEach(item => {
          yaml += `${prefix}  - ${this.escapeYamlValue(item)}\n`;
        });
      } else {
        yaml += `${prefix}${key}: ${this.escapeYamlValue(value)}\n`;
      }
    }

    return yaml;
  },

  /**
   * Escape YAML value if needed
   */
  escapeYamlValue(value) {
    if (typeof value === 'string') {
      // Escape strings that contain special characters
      if (/[:#\[\]{}|>&*!?,]/.test(value) || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
    }
    return value;
  },

  /**
   * Convert HTML to Markdown
   */
  htmlToMarkdown(html) {
    if (!html) return '';

    // Use Turndown if available
    if (typeof TurndownService !== 'undefined') {
      const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        bulletListMarker: '-',
        linkStyle: 'inlined'
      });

      // Custom rules for Twitter-specific elements
      turndown.addRule('twitterEmoji', {
        filter: node => node.nodeName === 'IMG' && node.alt && node.src.includes('emoji'),
        replacement: (content, node) => node.alt
      });

      return turndown.turndown(html);
    }

    // Fallback: basic HTML to Markdown conversion
    return this.basicHtmlToMarkdown(html);
  },

  /**
   * Basic HTML to Markdown conversion (fallback)
   */
  basicHtmlToMarkdown(html) {
    let md = html;

    // Convert common HTML elements
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
    md = md.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');

    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n');

    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n');
    md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n');

    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n');

    // Remove remaining HTML tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    md = this.decodeHtmlEntities(md);

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    return md;
  },

  /**
   * Decode HTML entities
   */
  decodeHtmlEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '...',
      '&copy;': '(c)',
      '&reg;': '(R)',
      '&trade;': '(TM)'
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    // Decode numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => String.fromCharCode(num));
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

    return decoded;
  },

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return dateStr;
    }
  },

  /**
   * Format number for display
   */
  formatNumber(num) {
    return num.toLocaleString();
  },

  /**
   * Check if metrics object has any values
   */
  hasMetrics(metrics) {
    if (!metrics) return false;
    return metrics.views || metrics.likes || metrics.reposts ||
           metrics.replies || metrics.bookmarks;
  },

  /**
   * Generate filename for Markdown file
   */
  generateFilename(title) {
    let filename = (title || 'x_article')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 80);
    return filename + '.md';
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MarkdownGenerator = MarkdownGenerator;
}
