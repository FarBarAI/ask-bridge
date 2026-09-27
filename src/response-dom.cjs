/* 共用網頁回覆定位；由 Rust 嵌入瀏覽器，也供離線驗收使用。 */
(function (root) {
  'use strict';

  const assistantSelectors = {
    chatgpt: '[data-content-search-unit-key$=":assistant"], [data-chatgpt-search-unit-key$=":assistant"], [data-message-author-role="assistant"], .agent-turn, [data-markdown-text-style="assistant-message"]',
    gemini: 'model-response',
    claude: '.font-claude-response',
  };
  const userSelectors = {
    chatgpt: '[data-content-search-unit-key$=":user"], [data-chatgpt-search-unit-key$=":user"], [data-message-author-role="user"], [data-user-message-bubble]',
    gemini: 'user-query, .user-query',
    claude: '[data-testid="user-message"], .font-user-message',
  };
  const stopSelectors = {
    chatgpt: '[data-testid="stop-button"], #composer-stop-button, button[aria-label="Stop generating"], button[aria-label*="Stop"], button[aria-label*="停止"]',
    gemini: 'button[aria-label="停止回覆"], button[aria-label*="Stop"], button[aria-label*="停止"]',
    claude: 'button[aria-label="Stop response"], button[aria-label*="Stop"], button[aria-label*="停止"]',
  };
  const contentSelectors = {
    chatgpt: '[data-markdown-text-style="assistant-message"], .markdown',
    gemini: 'message-content, .markdown, structured-content-container.model-response-text',
    claude: '.standard-markdown, .font-claude-response-body',
  };

  function visible(element) {
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
    const style = root.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
      && rect.width > 0 && rect.height > 0;
  }

  function label(element) {
    return ['aria-label', 'title', 'data-testid', 'mattooltip'].map((key) => element.getAttribute(key) || '')
      .concat(element.textContent || '').join(' ').trim();
  }

  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return `${text.length}:${hash >>> 0}`;
  }

  function key(element) {
    const selection = element.matches('[data-chatgpt-selection-message-id]') ? element
      : element.querySelector('[data-chatgpt-selection-message-id]');
    const ids = element.getAttribute('data-chatgpt-search-message-ids')
      || element.getAttribute('data-message-id')
      || selection?.getAttribute('data-chatgpt-selection-message-id');
    if (ids) return `message:${[...new Set(ids.trim().split(/\s+/))].join(' ')}`;
    const unit = element.getAttribute('data-content-search-unit-key')
      || element.getAttribute('data-chatgpt-search-unit-key') || element.id;
    if (unit) return `unit:${unit}`;
    // 無識別碼的舊介面使用元素身分，不以數量或 DOM 索引猜測新回答。
    const state = root.__askBridgeResponseIdentity ||= { elements: new WeakMap(), next: 0 };
    if (!state.elements.has(element)) state.elements.set(element, ++state.next);
    return `element:${state.elements.get(element)}`;
  }

  function canonical(element, role) {
    const unit = element.closest(`[data-content-search-unit-key$=":${role}"], [data-chatgpt-search-unit-key$=":${role}"]`);
    return unit || element.closest(`[data-message-author-role="${role}"]`) || element;
  }

  function findResponses(provider, role = 'assistant') {
    const selector = (role === 'assistant' ? assistantSelectors : userSelectors)[provider];
    if (!selector) throw new Error(`Unsupported provider: ${provider}`);
    const elements = [...new Set(Array.from(document.querySelectorAll(selector))
      .map((element) => canonical(element, role)))];
    const leaves = elements.filter((element) => !elements.some((other) => other !== element && element.contains(other)));
    const seen = new Set();
    return leaves.filter((element) => {
      const identity = key(element);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  function content(element, provider) {
    return element.querySelector(contentSelectors[provider]) || element;
  }

  function responseButton(button) {
    return !button.disabled && button.getAttribute('aria-disabled') !== 'true'
      && !button.closest('pre, code, [data-code-block], [data-testid*="code"], [class*="code-block"], [data-markdown-copy="exclude"], [data-user-message-bubble], [class*="user-message"]')
      && !/prompt|提示詞|提示词|table|表格|copy code|複製程式碼|复制代码|copy link|copy image|copy citation|複製連結|複製圖片|複製引文/i.test(label(button));
  }

  function copyButton(button) {
    return responseButton(button) && /copy|複製|复制|コピー|복사/i.test(label(button));
  }

  function scope(element, provider) {
    // 新介面的回答與操作列是同一組容器的兄弟元素。
    let parent = element;
    for (let level = 0; parent && level < 7; level += 1, parent = parent.parentElement) {
      const responses = findWithin(parent, provider);
      if (responses.some((other) => other !== element && !element.contains(other) && key(other) !== key(element))) break;
      if (Array.from(parent.querySelectorAll('button')).some(copyButton)) return parent;
      if (parent.matches('article, [data-testid^="conversation-turn"]')) return parent;
    }
    return element;
  }

  function findWithin(element, provider) {
    return Array.from(element.querySelectorAll(assistantSelectors[provider]))
      .map((node) => canonical(node, 'assistant'));
  }

  function latest(provider) {
    return findResponses(provider).at(-1) || null;
  }

  function responseImages(element) {
    const seen = new Set();
    return Array.from(element.querySelectorAll('img')).filter((img) => {
      const src = img.src || '';
      if (/avatar|profile|favicon/i.test(src) || !/^(https?:|blob:|data:image\/)/.test(src)) return false;
      const width = img.naturalWidth || img.width || img.getBoundingClientRect().width;
      const height = img.naturalHeight || img.height || img.getBoundingClientRect().height;
      if ((width > 0 && width < 100) || (height > 0 && height < 100) || seen.has(src)) return false;
      seen.add(src);
      return true;
    });
  }

  function snapshot(provider) {
    const users = findResponses(provider, 'user');
    const user = users.at(-1);
    const generating = Array.from(document.querySelectorAll(stopSelectors[provider]))
      .some((button) => visible(button) && !/^(submit|send|傳送|提交)$/i.test(label(button)));
    const messages = findResponses(provider).map((element) => {
      const body = content(element, provider);
      const text = (body.innerText || body.textContent || '').trim();
      const area = scope(element, provider);
      const buttons = Array.from(area.querySelectorAll('button')).filter(responseButton);
      const streamNodes = [element, area, ...Array.from(area.querySelectorAll('[data-is-streaming], [aria-busy]'))];
      const streaming = streamNodes.some((node) => node.getAttribute('data-is-streaming') === 'true'
        || node.getAttribute('aria-busy') === 'true');
      const ended = streamNodes.some((node) => node.getAttribute('data-is-streaming') === 'false');
      const regenerate = buttons.some((button) => button.closest('regenerate-button, [data-test-id="regenerate-button"], [data-testid="regenerate-button"]')
        || /regenerate|retry|try again|重新產生|重新生成|再試一次|重試|重做/i.test(label(button)));
      const feedback = buttons.some((button) => button.closest('thumb-up-button, thumb-down-button, [data-test-id="thumb-up-button"], [data-test-id="thumb-down-button"]')
        || /good response|bad response|positive feedback|negative feedback|thumb|like|dislike|喜歡|不喜歡|讚|滿意|答得好|有待加強/i.test(label(button)));
      const copying = buttons.some(copyButton);
      const images = responseImages(body);
      return {
        key: key(element), signature: fingerprint(`${text}\n${images.map((img) => img.src).join('\n')}`),
        has_content: text.length > 0 || images.length > 0,
        after_user: !user || Boolean(user.compareDocumentPosition(element) & 4),
        streaming, complete_signal: ended || regenerate || (copying && feedback),
      };
    });
    const pageKey = root.__askBridgeResponsePageIdentity ||= root.crypto.randomUUID();
    return { url: root.location.href, page_key: pageKey, user_key: user ? key(user) : '', generating, messages };
  }

  function target(provider, expected, allowPartial = false) {
    const state = snapshot(provider);
    const last = state.messages.at(-1);
    if (state.url !== expected.url) throw new Error('Conversation URL changed during retrieval');
    if (!last || last.key !== expected.key || !last.after_user) throw new Error('Requested assistant response changed or was not found');
    if (!allowPartial && last.signature !== expected.signature) throw new Error('Assistant response content changed during retrieval');
    if (!allowPartial && (state.generating || last.streaming || !last.complete_signal)) {
      throw new Error('Assistant response is still generating or completion is unconfirmed');
    }
    return latest(provider);
  }

  function clickCopy(provider, expected) {
    const element = target(provider, expected);
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    for (const type of ['pointerover', 'mouseover', 'mouseenter']) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, view: root }));
    }
    const button = Array.from(scope(element, provider).querySelectorAll('button'))
      .find((candidate) => copyButton(candidate) && visible(candidate));
    if (!button) return { ok: false, reason: 'Copy response button not found' };
    button.click();
    return { ok: true };
  }

  function markdown(provider, expected, allowPartial = false) {
    const body = content(target(provider, expected, allowPartial), provider);
    function walk(node) {
      if (node.nodeType === 3) return node.textContent || '';
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (['button', 'style', 'script'].includes(tag) || node.matches('[data-markdown-copy="exclude"], .sr-only, [aria-hidden="true"]')) return '';
      const children = () => Array.from(node.childNodes).map(walk).join('');
      if (tag === 'pre') {
        const code = node.querySelector('code') || node;
        const lang = Array.from(code.classList || []).find((value) => value.startsWith('language-')) || '';
        const text = code.textContent || '';
        const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1)));
        return `\n${fence}${lang.replace('language-', '')}\n${text}\n${fence}\n`;
      }
      if (tag === 'code') return `\`${node.textContent || ''}\``;
      if (tag === 'strong' || tag === 'b') return `**${children()}**`;
      if (tag === 'em' || tag === 'i') return `*${children()}*`;
      if (tag === 'a') return node.getAttribute('href') ? `[${children()}](${node.getAttribute('href')})` : children();
      if (tag === 'br') return '\n';
      if (tag === 'img') return responseImages(body).includes(node) ? `\n![${node.alt || 'image'}](${node.src || ''})\n` : '';
      if (tag === 'table') {
        const rows = Array.from(node.querySelectorAll('tr')).map((row) => Array.from(row.children)
          .filter((cell) => /^(TD|TH)$/.test(cell.tagName))
          .map((cell) => walk(cell).trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>')));
        if (!rows.length) return '';
        return '\n' + rows.map((row, index) => `| ${row.join(' | ')} |\n`
          + (index === 0 ? `| ${row.map(() => '---').join(' | ')} |\n` : '')).join('') + '\n';
      }
      if (/^h[1-6]$/.test(tag)) return `\n${'#'.repeat(Number(tag[1]))} ${children()}\n`;
      if (tag === 'li') {
        const ordered = node.parentElement?.tagName === 'OL';
        const index = ordered ? Array.from(node.parentElement.children).indexOf(node) + Number(node.parentElement.getAttribute('start') || 1) : 0;
        return `\n${ordered ? `${index}.` : '*'} ${children()}\n`;
      }
      return tag === 'p' ? `\n${children()}\n` : children();
    }
    return { content: walk(body).trim().replace(/\n{3,}/g, '\n\n') };
  }

  const api = { findResponses, latest, snapshot, target, clickCopy, markdown, fingerprint, responseImages };
  root.AskBridgeResponses = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
