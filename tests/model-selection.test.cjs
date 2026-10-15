'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  availablePrimaryLabels,
  findMatchingEntry,
  findPicker,
  parseMenuEntry,
  parseSliderStatusLabel,
  selectProviderOption,
  selectSliderOption,
  selectionVerified,
} = require('../src/model-selection.cjs');

function fixture(text, attributes = {}) {
  return parseMenuEntry({
    text,
    ariaChecked: attributes.ariaChecked,
    dataState: attributes.dataState,
    badgeText: attributes.badgeText,
  });
}

test('matches ChatGPT reasoning by primary label and ignores secondary version text', () => {
  const entries = [
    fixture('即時\n5.5'),
    fixture('中'),
    fixture('高'),
  ];

  assert.equal(findMatchingEntry(entries, ['instant', '即時']).primaryLabel, '即時');
  assert.equal(findMatchingEntry(entries, ['medium', '中', '中等']).primaryLabel, '中');
  assert.equal(findMatchingEntry(entries, ['high', '高']).primaryLabel, '高');
  assert.equal(findMatchingEntry(entries, ['5.5']), undefined);
});

test('matches English ChatGPT reasoning labels', () => {
  const entries = [
    fixture('Instant\n5.5'),
    fixture('Medium'),
    fixture('High'),
  ];

  assert.equal(findMatchingEntry(entries, ['instant', '即時']).primaryLabel, 'Instant');
  assert.equal(findMatchingEntry(entries, ['medium', '中', '中等']).primaryLabel, 'Medium');
  assert.equal(findMatchingEntry(entries, ['high', '高']).primaryLabel, 'High');
});

test('matches ChatGPT Pro precisely and does not confuse it with Instant or another Pro label', () => {
  const entries = [
    fixture('Instant'),
    fixture('Pro Extended'),
    fixture('Pro\n進階推理', { ariaChecked: 'true' }),
  ];

  const selected = findMatchingEntry(entries, ['pro']);
  assert.equal(selected.primaryLabel, 'Pro');
  assert.equal(selectionVerified(selected, '', ['pro']), true);
  assert.equal(findMatchingEntry([fixture('Instant')], ['pro']), undefined);
});

test('finds the current ChatGPT model button by its accessible label', () => {
  const previousDocument = global.document;
  const picker = {
    getAttribute: (name) => name === 'aria-label' ? '選取 ChatGPT 模型' : null,
    getClientRects: () => [{}],
  };
  global.document = {
    querySelector: () => null,
    querySelectorAll: () => [
      { getAttribute: () => '新增檔案和更多內容', getClientRects: () => [{}] },
      picker,
    ],
  };
  try {
    assert.equal(findPicker('chatgpt'), picker);
  } finally {
    global.document = previousDocument;
  }
});

test('matches Gemini modes exactly without subtitles or badges', () => {
  const entries = [
    fixture('3.5 Flash-Lite\n回覆最快\n新模型', { badgeText: '新模型' }),
    fixture('3.6 Flash\n全方位協助\n新模型', { badgeText: '新模型' }),
    fixture('3.1 Pro\n進階數學與程式設計'),
    fixture('延伸思考\n解決複雜問題'),
  ];

  assert.equal(findMatchingEntry(entries, ['3.5 Flash-Lite']).primaryLabel, '3.5 Flash-Lite');
  assert.equal(findMatchingEntry(entries, ['3.6 Flash']).primaryLabel, '3.6 Flash');
  assert.equal(findMatchingEntry(entries, ['3.1 Pro']).primaryLabel, '3.1 Pro');
  assert.equal(findMatchingEntry(entries, ['extended thinking', '延伸思考']).primaryLabel, '延伸思考');
  assert.equal(findMatchingEntry(entries, ['3.5 Flash']), undefined);
  assert.deepEqual(availablePrimaryLabels(entries), [
    '3.5 Flash-Lite',
    '3.6 Flash',
    '3.1 Pro',
    '延伸思考',
  ]);
});

test('separates selected-state text from the Gemini primary label', () => {
  const selected = fixture('已選取\n3.1 Pro\n進階數學與程式設計');
  const selectedEnglish = fixture('Selected: Extended Thinking\nSolve complex problems');

  assert.equal(selected.primaryLabel, '3.1 Pro');
  assert.equal(selected.selected, true);
  assert.equal(selectedEnglish.primaryLabel, 'Extended Thinking');
  assert.equal(selectedEnglish.selected, true);
});

test('matches English Gemini Extended Thinking label', () => {
  const entries = [
    fixture('3.1 Pro\nAdvanced math and coding'),
    fixture('Extended Thinking\nSolve complex problems'),
  ];

  assert.equal(
    findMatchingEntry(entries, ['extended thinking', '延伸思考']).primaryLabel,
    'Extended Thinking',
  );
});

test('verifies selection through checked state or the picker primary label', () => {
  const checked = fixture('高', { ariaChecked: 'true' });
  const unchecked = fixture('高', { ariaChecked: 'false' });

  assert.equal(selectionVerified(checked, '', ['high', '高']), true);
  assert.equal(selectionVerified(unchecked, '高', ['high', '高']), true);
  assert.equal(selectionVerified(unchecked, '中', ['high', '高']), false);
  assert.equal(selectionVerified(undefined, 'Pro 延伸', ['Pro Extended', 'Pro 延伸']), true);
});

test('revisits ChatGPT nested menus when verifying a selected model', async () => {
  const previousDocument = global.document;
  const previousKeyboardEvent = global.KeyboardEvent;
  const previousMouseEvent = global.MouseEvent;
  const previousPointerEvent = global.PointerEvent;
  const pointerEventTypes = [];
  let menuState = 'closed';

  function element(text, attributes = {}, click = () => {}) {
    return {
      innerText: text,
      textContent: text,
      click,
      dispatchEvent() {},
      getAttribute(name) {
        const value = typeof attributes[name] === 'function'
          ? attributes[name]()
          : attributes[name];
        return value === undefined ? null : value;
      },
      getClientRects() {
        return [{}];
      },
      querySelector() {
        return null;
      },
    };
  }

  const picker = element('ChatGPT', {}, () => {
    menuState = menuState === 'closed' ? 'top' : 'closed';
  });
  const submenu = element('更多模型', { 'aria-haspopup': 'menu' }, () => {
    menuState = 'nested';
  });
  const model = element(
    'GPT-5.6 Sol\n適合程式設計',
    {
      'aria-checked': () => (menuState === 'nested' ? 'true' : 'false'),
    },
    () => {
      menuState = 'closed';
    },
  );

  global.KeyboardEvent = class KeyboardEvent {};
  global.MouseEvent = class MouseEvent {};
  global.PointerEvent = class PointerEvent {
    constructor(type) {
      pointerEventTypes.push(type);
    }
  };
  global.document = {
    dispatchEvent() {},
    querySelector(selector) {
      return selector === 'button.__composer-pill' ? picker : null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return [picker];
      if (menuState === 'top') return [submenu];
      if (menuState === 'nested') return [model];
      return [];
    },
  };

  try {
    const result = await selectProviderOption({
      provider: 'chatgpt',
      targetAliases: ['GPT-5.6 Sol'],
      verificationAliases: ['GPT-5.6 Sol'],
      sleep: async () => {},
    });

    assert.equal(result.ok, true);
    assert.equal(result.selected, 'GPT-5.6 Sol');
    assert.deepEqual(pointerEventTypes, [
      'pointerdown',
      'pointerup',
      'pointerenter',
      'pointermove',
      'pointerdown',
      'pointerup',
      'pointerenter',
      'pointermove',
    ]);
  } finally {
    global.document = previousDocument;
    global.KeyboardEvent = previousKeyboardEvent;
    global.MouseEvent = previousMouseEvent;
    global.PointerEvent = previousPointerEvent;
  }
});

function fakeSlider(labels, start) {
  let position = start;
  const keys = [];
  return {
    keys,
    position: () => position,
    readLabel: () => labels[position],
    readPosition: () => ({ now: position, max: labels.length - 1 }),
    press: async (key) => {
      keys.push(key);
      if (key === 'ArrowLeft') position = Math.max(0, position - 1);
      if (key === 'ArrowRight') position = Math.min(labels.length - 1, position + 1);
    },
  };
}

test('parses ChatGPT reasoning slider status labels', () => {
  assert.equal(parseSliderStatusLabel('中，第 2 項，共 5 項。'), '中');
  assert.equal(parseSliderStatusLabel('Extra High, item 4 of 5.'), 'Extra High');
  assert.equal(parseSliderStatusLabel(''), '');
});

test('moves the ChatGPT reasoning slider to the requested stop', async () => {
  const slider = fakeSlider(['Instant', 'Medium', 'High', 'Extra High', 'Pro'], 1);
  const result = await selectSliderOption(slider, {
    targetAliases: ['extra high', 'xhigh', '極高'],
    verificationAliases: ['extra high', 'xhigh', '極高'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.selected, 'Extra High');
  assert.equal(slider.position(), 3);
});

test('leaves the ChatGPT reasoning slider untouched when already selected', async () => {
  const slider = fakeSlider(['即時', '中', '高', '極高', 'Pro'], 1);
  const result = await selectSliderOption(slider, {
    targetAliases: ['medium', '中', '中等'],
    verificationAliases: ['medium', '中', '中等'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.selected, '中');
  assert.deepEqual(slider.keys, []);
});

test('restores the ChatGPT reasoning slider when the stop does not exist', async () => {
  const slider = fakeSlider(['即時', '中', '高', '極高', 'Pro'], 2);
  const result = await selectSliderOption(slider, {
    targetAliases: ['auto', '自動'],
    verificationAliases: ['auto', '自動'],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'option not found');
  assert.deepEqual(result.available, ['即時', '中', '高', '極高', 'Pro']);
  assert.equal(slider.position(), 2);
});

async function withReasoningPicker(labels, initial, persist, run) {
  const previous = Object.fromEntries(['document', 'KeyboardEvent', 'MouseEvent', 'PointerEvent']
    .map((name) => [name, global[name]]));
  let open = false;
  let position = initial;
  let saved = initial;
  const thumb = {
    getAttribute: (name) => ({ 'aria-valuenow': String(position), 'aria-valuemax': String(labels.length - 1) }[name] || null),
  };
  const slider = {
    focus() {},
    getClientRects: () => [{}],
    getAttribute: (name) => name === 'aria-describedby' ? 'reasoning-status' : null,
    querySelector: () => thumb,
    dispatchEvent(event) {
      if (event.key === 'ArrowLeft') position = Math.max(0, position - 1);
      if (event.key === 'ArrowRight') position = Math.min(labels.length - 1, position + 1);
    },
  };
  const picker = {
    dispatchEvent() {},
    click() { open = !open; if (open) position = saved; },
  };
  global.KeyboardEvent = class { constructor(type, options) { Object.assign(this, options); } };
  global.MouseEvent = class {};
  global.PointerEvent = class {};
  global.document = {
    dispatchEvent(event) {
      if (event.key === 'Escape' && open) {
        if (persist) saved = position;
        open = false;
      }
    },
    getElementById: () => ({ getAttribute: () => 'status', get textContent() { return `${labels[position]}，推理強度`; } }),
    querySelector: (selector) => selector === 'button[data-codex-intelligence-trigger]' ? picker : null,
    querySelectorAll: (selector) => open && selector === '[data-reasoning-slider]' ? [slider] : [],
  };
  try {
    await run(() => saved);
  } finally {
    Object.assign(global, previous);
  }
}

test('以標籤選取 Pro，重開新版選單後確認已保存，不依賴固定滑桿位置', async () => {
  await withReasoningPicker(['Instant', 'Medium', 'Pro', 'Extra High'], 0, true, async (saved) => {
    const result = await selectProviderOption({
      provider: 'chatgpt', kind: 'reasoning', targetAliases: ['pro'], verificationAliases: ['pro'], sleep: async () => {},
    });
    assert.equal(result.ok, true);
    assert.equal(result.selected, 'Pro');
    assert.equal(saved(), 2);
  });
});

test('Pro 暫時選取後未保存時拒絕宣稱成功', async () => {
  await withReasoningPicker(['Instant', 'Medium', 'High', 'Extra High', 'Pro'], 0, false, async () => {
    const result = await selectProviderOption({
      provider: 'chatgpt', kind: 'reasoning', targetAliases: ['pro'], verificationAliases: ['pro'], sleep: async () => {},
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /could not be verified/);
  });
});

test('目前帳號沒有 Pro 時回報失敗並還原原本推理選項', async () => {
  await withReasoningPicker(['Instant', 'Medium', 'High', 'Extra High'], 1, true, async (saved) => {
    const result = await selectProviderOption({
      provider: 'chatgpt', kind: 'reasoning', targetAliases: ['pro'], verificationAliases: ['pro'], sleep: async () => {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'option not found');
    assert.equal(saved(), 1);
  });
});

test('reveals redesigned ChatGPT model choices through the picker view toggle', async () => {
  const previousDocument = global.document;
  const previousKeyboardEvent = global.KeyboardEvent;
  const previousMouseEvent = global.MouseEvent;
  const previousPointerEvent = global.PointerEvent;
  let view = 'closed';
  let selectedModel = 'GPT-6';

  function element(text, attributes = {}, click = () => {}, hiddenIn) {
    return {
      innerText: text,
      textContent: text,
      click,
      dispatchEvent() {},
      closest() {
        return hiddenIn && view !== hiddenIn ? {} : null;
      },
      getAttribute(name) {
        const value = typeof attributes[name] === 'function'
          ? attributes[name]()
          : attributes[name];
        return value === undefined ? null : value;
      },
      getClientRects() {
        return [{}];
      },
      querySelector() {
        return null;
      },
    };
  }

  const picker = element('中', { 'data-codex-intelligence-trigger': 'true' }, () => {
    view = view === 'closed' ? 'simple' : 'closed';
  });
  const toggle = element('中', { 'data-model-picker-view-toggle': 'true' }, () => {
    view = 'models';
  }, 'simple');
  const slider = element('', { 'data-reasoning-slider': 'true' }, () => {}, 'simple');
  const modelItem = (name) => element(
    name,
    { 'aria-checked': () => String(selectedModel === name) },
    () => {
      selectedModel = name;
      view = 'closed';
    },
    'models',
  );
  const models = [modelItem('GPT-6'), modelItem('GPT-5.6 Sol')];

  global.KeyboardEvent = class KeyboardEvent {};
  global.MouseEvent = class MouseEvent {};
  global.PointerEvent = class PointerEvent {};
  global.document = {
    dispatchEvent() {},
    querySelector(selector) {
      return selector === 'button[data-codex-intelligence-trigger]' ? picker : null;
    },
    querySelectorAll() {
      return view === 'closed' ? [] : [toggle, slider, ...models];
    },
  };

  try {
    const result = await selectProviderOption({
      provider: 'chatgpt',
      kind: 'model',
      targetAliases: ['GPT-5.6 Sol'],
      verificationAliases: ['GPT-5.6 Sol'],
      sleep: async () => {},
    });

    assert.equal(result.ok, true);
    assert.equal(result.selected, 'GPT-5.6 Sol');
    assert.equal(selectedModel, 'GPT-5.6 Sol');
  } finally {
    global.document = previousDocument;
    global.KeyboardEvent = previousKeyboardEvent;
    global.MouseEvent = previousMouseEvent;
    global.PointerEvent = previousPointerEvent;
  }
});
