/**
 * X Article Content Extractor
 * Extracts article content, metadata, and images from X pages
 * Works with regular tweets, threads, and long-form X Articles
 */

const XArticleExtractor = {
  /**
   * Check if current page has exportable content
   */
  isArticlePage() {
    const url = window.location.href;
    // key change: allow /article/ URLs AND /home for feed extraction
    const isStatusPage = /https:\/\/(x\.com|twitter\.com)\/[^/]+\/(status|article)\/\d+/.test(url);
    const isFeedPage = /https:\/\/(x\.com|twitter\.com)\/home/.test(url);

    if (!isStatusPage && !isFeedPage) {
      console.log('[X-Export] Not a status, article, or feed page:', url);
      return false;
    }

    if (isFeedPage) return true; // Feed always has content (potentially)

    const hasContent = this.findMainContent() !== null;
    console.log('[X-Export] Has content:', hasContent);
    return hasContent;
  },

  /**
   * Find the main content container
   */
  findMainContent() {
    const selectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweetText"]',
      'article',
      '.public-DraftEditor-content', // Added for X Articles
      '[data-testid="twitter-article-title"]' // Added for X Articles
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  },

  /**
   * Extract all data from the current page
   */
  extractArticle() {
    console.log('[X-Export] Starting extraction...');

    // Get the author handle from URL
    const authorHandle = this.getAuthorFromUrl();

    const article = {
      title: this.extractTitle(),
      author: this.extractAuthor(),
      date: this.extractDate(),
      url: window.location.href,
      content: this.extractThreadContent(authorHandle),
      images: this.extractImages(authorHandle),
      metrics: this.extractMetrics()
    };

    // Special handling for Feed
    if (window.location.href.includes('/home')) {
      console.log('[X-Export] Detected Home Feed. Extracting multiple items...');
      return this.extractFeed();
    }

    console.log('[X-Export] Extracted article:', {
      title: article.title,
      contentLength: article.content.text.length,
      imageCount: article.images.length
    });

    return article;
  },

  /**
   * Get author handle from URL
   */
  getAuthorFromUrl() {
    const match = window.location.pathname.match(/^\/([^/]+)\//);
    return match ? match[1].toLowerCase() : null;
  },

  /**
   * Extract title
   */
  extractTitle() {
    // Check for X Article title
    const articleTitle = document.querySelector('[data-testid="twitter-article-title"]');
    if (articleTitle) {
      return articleTitle.innerText.trim();
    }

    // Try to get from first tweet text
    const tweetText = document.querySelector('[data-testid="tweetText"]');
    if (tweetText) {
      const text = tweetText.textContent.trim();
      const firstLine = text.split('\n')[0];
      return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
    }

    // Fallback to page title
    const pageTitle = document.title;
    if (pageTitle) {
      return pageTitle
        .replace(/\s*[/|]\s*X$/, '')
        .replace(/^.+?:\s*"/, '')
        .replace(/"$/, '')
        .trim();
    }

    return 'X Post';
  },

  /**
   * Extract author information
   */
  extractAuthor() {
    const author = {
      name: '',
      handle: '',
      avatar: ''
    };

    // From tweet header
    const userNameElement = document.querySelector('[data-testid="User-Name"]');
    if (userNameElement) {
      const spans = userNameElement.querySelectorAll('span');
      spans.forEach(span => {
        const text = span.textContent.trim();
        if (text.startsWith('@')) {
          author.handle = text;
        } else if (text && !text.includes('·') && !author.name && text.length > 1) {
          author.name = text;
        }
      });
    }

    // From URL
    if (!author.handle) {
      const handleMatch = window.location.pathname.match(/^\/([^/]+)\//);
      if (handleMatch) {
        author.handle = '@' + handleMatch[1];
      }
    }

    // Avatar
    const avatarSelectors = [
      '[data-testid="Tweet-User-Avatar"] img',
      'article img[src*="profile_images"]'
    ];

    for (const selector of avatarSelectors) {
      const element = document.querySelector(selector);
      if (element && element.src) {
        author.avatar = element.src;
        break;
      }
    }

    return author;
  },

  /**
   * Extract publication date
   */
  extractDate() {
    const timeSelectors = [
      'article time[datetime]',
      'time[datetime]'
    ];

    for (const selector of timeSelectors) {
      const element = document.querySelector(selector);
      if (element && element.dateTime) {
        return element.dateTime;
      }
    }

    return new Date().toISOString();
  },

  /**
   * Extract full thread/article content
   */
  extractThreadContent(authorHandle) {
    const content = {
      html: '',
      text: ''
    };

    console.log('[X-Export] Extracting content for author:', authorHandle);

    // Method 1: Check for long-form X Article (Draft.js content)
    const draftEditorContent = document.querySelector('.public-DraftEditor-content');
    if (draftEditorContent) {
      console.log('[X-Export] Found Draft.js article content');
      return this.extractDraftJsArticle(draftEditorContent);
    }

    // Method 1b: Legacy long-form check
    const longformContent = document.querySelector('[class*="longform"]');
    if (longformContent) {
      console.log('[X-Export] Found longform article content');
      return this.extractLongformArticle();
    }

    // Method 2: Regular tweets/threads
    const threadParts = [];
    const allTweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
    console.log('[X-Export] Found', allTweetTexts.length, 'tweetText elements');

    allTweetTexts.forEach((tweetTextEl, index) => {
      const clone = tweetTextEl.cloneNode(true);

      clone.querySelectorAll('img[alt]').forEach(img => {
        if (img.src && img.src.includes('emoji')) {
          const text = document.createTextNode(img.alt);
          img.parentNode.replaceChild(text, img);
        }
      });

      const tweetText = clone.textContent.trim();

      if (tweetText && tweetText.length > 0) {
        const isDuplicate = threadParts.some(p => p.text === tweetText);
        if (!isDuplicate) {
          threadParts.push({
            index: index,
            text: tweetText,
            html: clone.innerHTML
          });
          console.log('[X-Export] Added tweet', index, '- Length:', tweetText.length);
        }
      }
    });

    // Method 3: Try div[lang] if no tweetText found
    if (threadParts.length === 0) {
      console.log('[X-Export] Trying div[lang] selector');
      const langDivs = document.querySelectorAll('article div[lang]');
      langDivs.forEach((div, index) => {
        const text = div.textContent.trim();
        if (text && text.length > 10) {
          threadParts.push({ index, text, html: div.innerHTML });
          console.log('[X-Export] Added lang div', index, '- Length:', text.length);
        }
      });
    }

    if (threadParts.length > 0) {
      content.text = threadParts.map(p => p.text).join('\n\n---\n\n');
      content.html = threadParts.map(p => '<div class="thread-part">' + p.html + '</div>').join('<hr>');
    }

    console.log('[X-Export] Total content length:', content.text.length);
    return content;
  },

  /**
   * Extract X Article content from Draft.js editor
   */
  extractDraftJsArticle(container) {
    const content = { html: '', text: '' };
    const parts = [];

    // X Articles use blocks with data-block="true" or specific classes
    const blocks = container.querySelectorAll('.longform-unstyled[data-block="true"], [data-block="true"]');

    if (blocks.length > 0) {
      blocks.forEach((block, index) => {
        const text = block.innerText.trim();
        if (text) {
          const blockTag = this.getDraftBlockTag(block);
          const blockHtml = `<${blockTag} class="article-block">${block.innerHTML}</${blockTag}>`;
          parts.push({
            index,
            text: text,
            html: blockHtml
          });
        }
      });
    } else {
      // Fallback: just get the full text if blocks aren't identifiable
      const fullText = container.innerText.trim();
      parts.push({
        index: 0,
        text: fullText,
        html: container.innerHTML
      });
    }

    content.text = parts.map(p => p.text).join('\n\n');
    content.html = parts.map(p => p.html).join('\n');

    return content;
  },

  /**
   * Detect Draft.js block tag to preserve heading hierarchy in exports
   */
  getDraftBlockTag(block) {
    const className = ((block && block.className) || '').toLowerCase();

    if (className.includes('header-one')) return 'h1';
    if (className.includes('header-two')) return 'h2';
    if (className.includes('header-three')) return 'h3';
    if (className.includes('blockquote')) return 'blockquote';

    const textLength = (block && block.innerText ? block.innerText.trim().length : 0);
    if (textLength > 0 && textLength < 80 && !/[.!?。！？]$/.test(block.innerText.trim())) {
      // Heuristic fallback: short standalone lines are often section headings.
      return 'h3';
    }

    return 'p';
  },

  /**
   * Extract long-form X Article content
   */
  extractLongformArticle() {
    const content = { html: '', text: '' };
    const parts = [];

    console.log('[X-Export] Extracting longform article...');

    // Try multiple selectors for longform content
    const selectors = [
      '[class*="longform-unstyled"]',
      '[class*="longform"]',
      '[data-testid="article-content"]',
      'article [class*="RichText"]',
      'article [dir="auto"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      console.log('[X-Export] Selector', selector, 'found', elements.length, 'elements');

      elements.forEach((el, index) => {
        // Skip if it's just a small element (likely metadata)
        if (el.textContent.trim().length < 20) return;

        // Skip if it contains only links/metadata
        if (el.querySelector('a[href*="/status/"]') && el.textContent.trim().length < 100) return;

        const clone = el.cloneNode(true);

        // Convert emoji images
        clone.querySelectorAll('img[alt]').forEach(img => {
          if (img.alt) {
            const text = document.createTextNode(img.alt);
            img.parentNode.replaceChild(text, img);
          }
        });

        // Remove script/style
        clone.querySelectorAll('script, style').forEach(s => s.remove());

        const text = clone.textContent.trim();

        // Avoid duplicates
        if (text && text.length > 20 && !parts.some(p => p.text === text || p.text.includes(text) || text.includes(p.text))) {
          parts.push({
            index: index,
            text: text,
            html: clone.innerHTML
          });
          console.log('[X-Export] Added longform part', index, '- Length:', text.length, '- Preview:', text.substring(0, 80));
        }
      });

      // If we found substantial content, stop looking
      if (parts.length > 0 && parts.reduce((sum, p) => sum + p.text.length, 0) > 500) {
        break;
      }
    }

    // If still nothing, try getting all paragraph-like content
    if (parts.length === 0) {
      console.log('[X-Export] Trying paragraph extraction');
      const paragraphs = document.querySelectorAll('article p, article [class*="text"], article span[class]');
      paragraphs.forEach((p, index) => {
        const text = p.textContent.trim();
        if (text && text.length > 30 && !parts.some(part => part.text.includes(text))) {
          parts.push({ index, text, html: p.innerHTML });
        }
      });
    }

    if (parts.length > 0) {
      content.text = parts.map(p => p.text).join('\n\n');
      content.html = parts.map(p => '<div>' + p.html + '</div>').join('\n');
    }

    console.log('[X-Export] Longform extraction complete. Parts:', parts.length, 'Total length:', content.text.length);
    return content;
  },

  /**
   * Get the author handle from a tweet element
   */
  getTweetAuthor(tweetElement) {
    // Try to find the author handle in the tweet
    const userNameEl = tweetElement.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      const handleSpan = userNameEl.querySelector('a[href^="/"]');
      if (handleSpan) {
        const href = handleSpan.getAttribute('href');
        if (href) {
          return href.split('/')[1] || '';
        }
      }

      // Fallback: look for @username in spans
      const spans = userNameEl.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text.startsWith('@')) {
          return text.substring(1);
        }
      }
    }
    return '';
  },

  /**
   * Extract all images
   */
  extractImages(authorHandle) {
    const images = [];
    const seen = new Set();
    const normalizedHandle = (authorHandle || '').replace(/^@/, '').toLowerCase();

    const pushImage = (img) => {
      let src = img.src || img.currentSrc;
      if (!src) return;
      if (img.width < 100 && img.height < 100) return;
      if (src.includes('profile_images')) return;
      if (src.includes('emoji')) return;

      src = this.getHighQualityImageUrl(src);
      if (!seen.has(src)) {
        seen.add(src);
        images.push({
          src: src,
          alt: img.alt || ''
        });
      }
    };

    // Prefer scoped extraction: only from current tweet/thread authored by page author.
    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    tweetArticles.forEach((tweetEl) => {
      if (normalizedHandle) {
        const tweetAuthor = (this.getTweetAuthor(tweetEl) || '').replace(/^@/, '').toLowerCase();
        if (tweetAuthor && tweetAuthor !== normalizedHandle) {
          return;
        }
      }

      tweetEl.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="twimg.com/media"], [data-testid="card.layoutLarge.media"] img')
        .forEach(pushImage);
    });

    // Long-form article fallback: images inside article content container.
    if (images.length === 0) {
      const longformContainer = document.querySelector('.public-DraftEditor-content') ||
                                document.querySelector('[class*="longform"]') ||
                                document.querySelector('[data-testid="article-content"]');
      if (longformContainer) {
        longformContainer.querySelectorAll('img').forEach(pushImage);
      }
    }

    console.log('[X-Export] Found images:', images.length);
    return images;
  },

  /**
   * Get high quality image URL
   */
  getHighQualityImageUrl(url) {
    if (!url) return url;

    if (url.includes('twimg.com')) {
      url = url.replace(/name=\w+/, 'name=orig');
      if (!url.includes('name=')) {
        url += (url.includes('?') ? '&' : '?') + 'name=orig';
      }
    }

    return url;
  },

  /**
   * Extract engagement metrics
   */
  extractMetrics() {
    const metrics = {
      likes: 0,
      reposts: 0,
      replies: 0,
      bookmarks: 0,
      views: 0
    };

    const parseMetricValue = (text) => {
      if (!text) return 0;
      text = text.trim().toLowerCase();

      const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
      const match = text.match(/^([\d.]+)([kmb])?$/);

      if (match) {
        const value = parseFloat(match[1]);
        const multiplier = multipliers[match[2]] || 1;
        return Math.round(value * multiplier);
      }

      return parseInt(text.replace(/,/g, ''), 10) || 0;
    };

    // Get metrics from aria-labels which are more reliable
    document.querySelectorAll('[aria-label]').forEach(el => {
      const label = (el.getAttribute('aria-label') || '').toLowerCase();

      // Match patterns like "1,234 likes" or "5.2K reposts"
      const patterns = [
        { key: 'likes', regex: /([\d,.]+[kmb]?)\s*like/i },
        { key: 'reposts', regex: /([\d,.]+[kmb]?)\s*(repost|retweet)/i },
        { key: 'replies', regex: /([\d,.]+[kmb]?)\s*repl/i },
        { key: 'bookmarks', regex: /([\d,.]+[kmb]?)\s*bookmark/i },
        { key: 'views', regex: /([\d,.]+[kmb]?)\s*view/i }
      ];

      patterns.forEach(({ key, regex }) => {
        const match = label.match(regex);
        if (match) {
          const value = parseMetricValue(match[1]);
          if (value > metrics[key]) {
            metrics[key] = value;
          }
        }
      });
    });

    // Also try the view count from page text
    const viewsMatch = document.body.innerText.match(/([\d,.]+[KMB]?)\s*[Vv]iews?/);
    if (viewsMatch) {
      const views = parseMetricValue(viewsMatch[1]);
      if (views > metrics.views) {
        metrics.views = views;
      }
    }

    return metrics;
  },

  /**
   * Generate filename
   */
  generateFilename(title, extension) {
    let filename = (title || 'x_post')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);

    return filename + '.' + extension;
  },

  /**
   * Extract content from Home Feed
   */
  extractFeed() {
    const tweets = [];
    const articleElements = document.querySelectorAll('article[data-testid="tweet"]');

    articleElements.forEach((tweetEl, index) => {
      // Basic extraction for each tweet in the feed
      const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
      const authorEl = tweetEl.querySelector('[data-testid="User-Name"]');
      const timeEl = tweetEl.querySelector('time');

      if (textEl) {
        tweets.push({
          index: index,
          author: authorEl ? authorEl.innerText.split('\n')[0] : 'Unknown',
          date: timeEl ? timeEl.getAttribute('datetime') : new Date().toISOString(),
          text: textEl.innerText.trim(),
          html: textEl.innerHTML
        });
      }
    });

    return {
      title: 'X Home Feed Export',
      url: window.location.href,
      author: {
        name: 'Feed Export',
        handle: 'home_feed',
        avatar: ''
      },
      date: new Date().toISOString(),
      images: [],
      metrics: {
        views: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
        bookmarks: 0
      },
      content: {
        text: tweets.map(t => `--- Tweet ${t.index + 1} by ${t.author} ---\n${t.text}`).join('\n\n'),
        html: tweets.map(t => `<div class="feed-item"><h3>${t.author}</h3>${t.html}</div>`).join('<hr>')
      },
      itemCount: tweets.length
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.XArticleExtractor = XArticleExtractor;
}

console.log('[X-Export] Extractor loaded');
