'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const responses = require('../src/response-dom.cjs');

// 最小 DOM 模型：驗證真實定位、父子關係與操作範圍，不連線網站。
class Element {
  constructor(tag, attributes = {}, children = []) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attributes = attributes;
    this.childNodes = [];
    this.disabled = false;
    this.clicked = 0;
    for (const child of children) this.append(child);
  }
  append(child) {
    const node = typeof child === 'string' ? { nodeType: 3, textContent: child } : child;
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }
  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }
  get textContent() { return this.childNodes.map((node) => node.textContent).join(''); }
  get innerText() { return this.textContent; }
  get id() { return this.getAttribute('id') || ''; }
  get src() { return this.getAttribute('src') || ''; }
  get alt() { return this.getAttribute('alt') || ''; }
  get classList() { return (this.getAttribute('class') || '').split(/\s+/); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    return selector.split(',').some((raw) => {
      const part = raw.trim();
      if (part.startsWith('.')) return this.classList.includes(part.slice(1));
      if (part.startsWith('#')) return this.id === part.slice(1);
      const attribute = part.match(/^\[([^\s\]^$*=]+)([$^*]?=)?(?:"([^"]*)")?\]$/);
      if (attribute) {
        const value = this.getAttribute(attribute[1]);
        if (value === null) return false;
        switch (attribute[2]) {
          case '=': return value === attribute[3];
          case '$=': return value.endsWith(attribute[3]);
          case '^=': return value.startsWith(attribute[3]);
          case '*=': return value.includes(attribute[3]);
          default: return true;
        }
      }
      const compound = part.match(/^([\w-]+)(\[.*\])$/);
      if (compound) return this.tagName.toLowerCase() === compound[1] && this.matches(compound[2]);
      return this.tagName.toLowerCase() === part;
    });
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    function visit(node) {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    }
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(other) { return other === this || this.children.some((child) => child.contains(other)); }
  compareDocumentPosition(other) {
    const nodes = [];
    function visit(node) { nodes.push(node); node.children.forEach(visit); }
    let root = this;
    while (root.parentElement) root = root.parentElement;
    visit(root);
    return nodes.indexOf(this) < nodes.indexOf(other) ? 4 : 2;
  }
  getBoundingClientRect() { return { width: 100, height: 30 }; }
  scrollIntoView() {}
  dispatchEvent() {}
  click() { this.clicked += 1; }
}
const e = (tag, attributes, children) => new Element(tag, attributes, children);
function fixture(children) {
  global.document = e('document', {}, children);
  global.location = { href: 'https://chatgpt.com/c/test' };
  global.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' });
  global.MouseEvent = class {};
  delete global.__askBridgeResponseIdentity;
}
function modern(id, text = '回答') {
  return e('div', {
    'data-content-search-unit-key': `turn:2:assistant`,
    'data-chatgpt-search-unit-key': `turn:2:assistant`,
    'data-chatgpt-search-message-ids': `${id} ${id}`,
  }, [e('div', { 'data-markdown-text-style': 'assistant-message' }, [text])]);
}
function target(provider = 'chatgpt') {
  const state = responses.snapshot(provider);
  return { ...state.messages.at(-1), url: state.url };
}

test('新版雙標記與內部 Markdown 合併為同一則回答', () => {
  const answer = modern('answer-id');
  fixture([answer]);
  assert.deepEqual(responses.findResponses('chatgpt'), [answer]);
  assert.equal(responses.snapshot('chatgpt').messages[0].key, 'message:answer-id');
});

test('舊版 author-role 與 agent-turn 外層不重複計算', () => {
  const answer = e('div', { 'data-message-author-role': 'assistant', 'data-message-id': 'old' }, ['舊回答']);
  fixture([e('article', { class: 'agent-turn' }, [answer])]);
  assert.deepEqual(responses.findResponses('chatgpt'), [answer]);
});

test('不使用泛用 response 字樣誤選側欄或其他 UI', () => {
  fixture([e('div', { 'data-testid': 'response-options' }, ['其他介面'])]);
  assert.equal(responses.latest('chatgpt'), null);
});

test('同時存在多則回答時選取最後一則，並拒絕最後提問之前的回答', () => {
  const first = modern('first');
  const last = modern('last');
  fixture([first, last]);
  assert.equal(responses.latest('chatgpt'), last);
  document.append(e('div', { 'data-user-message-bubble': 'true' }, ['新的提問']));
  assert.equal(responses.snapshot('chatgpt').messages.at(-1).after_user, false);
});

test('沒有完成操作列的搜尋停頓不視為完成', () => {
  fixture([modern('answer', '搜尋中暫時停頓')]);
  assert.equal(responses.snapshot('chatgpt').messages[0].complete_signal, false);
});

test('回答與操作列為兄弟元素時能找到完成訊號，排除使用者與表格複製按鈕', () => {
  const userCopy = e('button', { 'aria-label': '複製訊息' });
  const tableCopy = e('button', { 'aria-label': '複製表格' });
  const codeCopy = e('button', { 'aria-label': 'Copy code' });
  const answer = modern('answer');
  answer.append(e('div', { 'data-markdown-copy': 'exclude' }, [tableCopy]));
  answer.append(codeCopy);
  const copy = e('button', { 'aria-label': '複製' });
  fixture([e('div', {}, [
    e('div', { class: 'group/user-message' }, [userCopy]),
    answer,
    e('div', { class: 'turn-action-controls' }, [copy, e('button', { 'aria-label': '重新產生回覆' })]),
  ])]);
  const state = responses.snapshot('chatgpt');
  assert.equal(state.messages[0].complete_signal, true);
  assert.equal(responses.clickCopy('chatgpt', target()).ok, true);
  assert.equal(copy.clicked, 1);
  assert.equal(userCopy.clicked, 0);
  assert.equal(tableCopy.clicked, 0);
  assert.equal(codeCopy.clicked, 0);
});

test('不能借用上一則回答的操作列判定最新回答完成', () => {
  const old = e('div', {}, [modern('old'), e('button', { 'aria-label': '複製' }), e('button', { 'aria-label': '重新產生回覆' })]);
  fixture([e('main', {}, [old, modern('new')])]);
  assert.equal(responses.snapshot('chatgpt').messages.at(-1).complete_signal, false);
});

test('即使已有完成操作列，串流標記或停止按鈕仍阻止擷取完整回答', () => {
  const answer = modern('stream');
  answer.attributes['data-is-streaming'] = 'true';
  fixture([e('div', {}, [answer, e('button', { 'aria-label': '重新產生回覆' }), e('button', { 'aria-label': '複製' })])]);
  assert.equal(responses.snapshot('chatgpt').messages[0].streaming, true);
  assert.throws(() => responses.markdown('chatgpt', target()), /generating/);
  assert.equal(responses.markdown('chatgpt', target(), true).content, '回答');
  delete answer.attributes['data-is-streaming'];
  document.append(e('button', { 'aria-label': 'Stop generating' }));
  assert.equal(responses.snapshot('chatgpt').generating, true);
});

test('擷取前核對 URL、回答識別碼及文字指紋', () => {
  const answer = modern('answer');
  fixture([e('div', {}, [answer, e('button', { 'aria-label': '重新產生回覆' }), e('button', { 'aria-label': '複製' })])]);
  const expected = target();
  assert.throws(() => responses.markdown('chatgpt', { ...expected, url: 'https://chatgpt.com/c/other' }), /URL changed/);
  assert.throws(() => responses.markdown('chatgpt', { ...expected, key: 'other' }), /not found/);
  answer.children[0].append('後續變動');
  assert.throws(() => responses.markdown('chatgpt', expected), /content changed/);
});

test('Gemini 與 Claude 保留各自的回答定位與完成判斷', () => {
  for (const [provider, answer] of [
    ['gemini', e('model-response', {}, ['Gemini 回答'])],
    ['claude', e('div', { class: 'font-claude-response' }, ['Claude 回答'])],
  ]) {
    fixture([e('article', {}, [answer, e('button', { 'aria-label': 'Copy response' }), e('button', { 'aria-label': 'Retry' })])]);
    assert.equal(responses.latest(provider), answer);
    assert.equal(responses.snapshot(provider).messages[0].complete_signal, true);
    assert.match(responses.markdown(provider, target(provider)).content, /回答/);
  }
});

test('DOM 備援保留標題、引用連結、表格及程式碼', () => {
  const answer = modern('formatted', '');
  const body = answer.children[0];
  body.append(e('h2', {}, ['公司簡介']));
  body.append(e('p', {}, [e('a', { href: 'https://example.com/' }, ['官方網站'])]));
  body.append(e('table', {}, [e('tr', {}, [e('th', {}, ['名稱']), e('th', {}, ['業務'])]), e('tr', {}, [e('td', {}, ['公司']), e('td', {}, ['A | B'])])]));
  body.append(e('pre', {}, [e('code', { class: 'language-rust' }, ['println!("ok");'])]));
  fixture([e('article', {}, [answer, e('button', { 'aria-label': 'Copy response' }), e('button', { 'aria-label': 'Retry' })])]);
  const markdown = responses.markdown('chatgpt', target()).content;
  assert.match(markdown, /## 公司簡介/);
  assert.match(markdown, /\[官方網站\]\(https:\/\/example.com\/\)/);
  assert.match(markdown, /\| 名稱 \| 業務 \|\n\| --- \| --- \|/);
  assert.match(markdown, /A \\\| B/);
  assert.match(markdown, /```rust\nprintln!\("ok"\);\n```/);
});

test('引用小圖示不算生成圖片，也不影響回答文字指紋', () => {
  const answer = modern('answer');
  const icon = e('img', { src: 'https://example.com/source-icon.png' });
  icon.naturalWidth = 16;
  icon.naturalHeight = 16;
  answer.children[0].append(icon);
  fixture([answer]);
  const signature = responses.snapshot('chatgpt').messages[0].signature;
  icon.attributes.src = 'https://example.com/another-icon.png';
  assert.equal(responses.snapshot('chatgpt').messages[0].signature, signature);
  assert.deepEqual(responses.responseImages(answer), []);
  const image = e('img', { src: 'https://example.com/generated.png' });
  image.naturalWidth = 512;
  image.naturalHeight = 512;
  answer.children[0].append(image);
  assert.deepEqual(responses.responseImages(answer), [image]);
});

test('停用的操作按鈕不是完成訊號', () => {
  const copy = e('button', { 'aria-label': 'Copy response', 'aria-disabled': 'true' });
  const regenerate = e('button', { 'aria-label': 'Retry', 'aria-disabled': 'true' });
  fixture([e('article', {}, [modern('answer'), copy, regenerate])]);
  assert.equal(responses.snapshot('chatgpt').messages[0].complete_signal, false);
});

test('Gemini 中文操作列與自訂元件可辨識完成，不依賴英文標籤', () => {
  const answer = e('model-response', {}, [
    e('message-content', {}, ['GEMINI_BRIDGE_OK']),
    e('regenerate-button', {}, [e('gem-icon-button', { 'data-test-id': 'regenerate-button' }, [e('button', { 'aria-label': '重做' })])]),
    e('thumb-up-button', {}, [e('button', { 'aria-label': '答得好' })]),
    e('copy-button', {}, [e('button', { 'aria-label': '複製' })]),
  ]);
  fixture([answer]);
  assert.equal(responses.snapshot('gemini').messages[0].complete_signal, true);
  assert.equal(responses.markdown('gemini', target('gemini')).content, 'GEMINI_BRIDGE_OK');
});
