// 아트 검수 반영(D37) E2E: node --test web/tests/e2e-art.test.mjs
// 숨김 카드의 정보 누출 없음, 일러스트·대체 문양, 나라 인장·색, 바이블 색 토큰, 기준 카드 참조 강조.
import { test, before, after, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, startServer, openGame, currentCard, wrongCell, cellSel, clickPlace, REPO_ROOT, SAMPLE, SAMGUK, SAMGUK_BY_ID } from './helpers.mjs';

const TYPE_WORDS = ['사건', '유물', '인물', '전승', 'event', 'artifact', 'person', 'myth'];
const BIBLE = readFileSync(path.join(REPO_ROOT, 'design', 'art', 'art-bible.md'), 'utf8');
/** 바이블 표에서 `| 이름 | ... | \`#hex\`` 줄의 hex를 꺼낸다. */
const bibleHex = (rowStart) => {
  const line = BIBLE.split('\n').find((l) => l.startsWith(`| ${rowStart} `));
  return /`(#[0-9A-Fa-f]{6})`/.exec(line)?.[1].toLowerCase();
};

let server;
let browser;
let context;
let page;
let pageErrors;

before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.stop();
});
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e));
});
afterEach(async () => {
  assert.deepEqual(pageErrors.map(String), [], '페이지 스크립트 오류');
  await context.close();
});

/** 숨김 카드에 유형 정보가 없는지: 배지, 접근성 이름, 그림, data 속성. */
async function assertNoTypeLeak(sel) {
  const info = await page.locator(sel).evaluate((n) => ({
    badge: n.querySelectorAll('.card-type').length,
    imgs: n.querySelectorAll('img').length,
    aria: n.getAttribute('aria-label') ?? '',
    attrs: [...n.querySelectorAll('*'), n].flatMap((x) => [...x.attributes].map((a) => `${a.name}=${a.value}`)).join(' '),
    hidden: n.querySelectorAll('.illust-hidden').length,
  }));
  assert.equal(info.badge, 0, '유형 배지가 없어야 한다');
  assert.equal(info.imgs, 0, '숨김 상태에는 그림을 두지 않는다');
  assert.equal(info.hidden, 1, '먹 번짐 "?" 영역');
  for (const w of TYPE_WORDS) {
    assert.ok(!info.aria.includes(w), `접근성 이름에 "${w}"`);
    assert.ok(!info.attrs.includes(`placeholder-${w}`) && !info.attrs.includes(`type=${w}`), `속성에 "${w}"`);
  }
}

describe('숨김 카드의 유형 정보 누출 없음(D37)', () => {
  test('실제 데이터 한 라운드 12장 모두: 배지·접근성 이름·그림·속성에 유형이 없다', { skip: !SAMGUK && 'samguk.json 없음' }, async () => {
    await openGame(page, server.base, { data: null, seed: 3 });
    const types = new Set();
    for (let k = 0; k < 12; k++) {
      const card = await currentCard(page, SAMGUK_BY_ID);
      types.add(card.type);
      await assertNoTypeLeak('#card');
      await page.click('#more-clue');
      await page.click('#more-clue');
      await assertNoTypeLeak('#card');
      await clickPlace(page, card.answer);
      // 공개 후에는 유형과 대체 문양이 보인다
      assert.match(await page.innerText('#fb .fb-meta'), new RegExp({ event: '사건', artifact: '유물', person: '인물', myth: '전승' }[card.type]));
    }
    assert.ok(types.size >= 2, `여러 유형으로 확인했다: ${[...types]}`);
  });

  test('튜토리얼 카드도 숨김 상태에 유형이 없다', async () => {
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    await page.click('#tut-next');
    await assertNoTypeLeak('#tut-card');
    await page.click('#tut-more');
    await assertNoTypeLeak('#tut-card');
  });

  test('드래그 중 카드 그림자에도 유형이 없다', async () => {
    await openGame(page, server.base);
    const from = await page.locator('#card .card-head').boundingBox();
    await page.mouse.move(from.x + 10, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(from.x + 300, from.y + 100, { steps: 5 });
    const ghost = await page.innerText('#drag-ghost');
    await page.mouse.up();
    for (const w of TYPE_WORDS) assert.ok(!ghost.includes(w), ghost);
  });
});

describe('일러스트 영역과 대체 문양', () => {
  test('공개 후 피드백과 도감 상세: image가 없으면 유형별 대체 문양이 실제로 읽힌다', async () => {
    await openGame(page, server.base);
    const card = await currentCard(page);
    await clickPlace(page, card.answer);
    const fig = page.locator('#fb .illust');
    assert.equal(await fig.getAttribute('data-kind'), 'placeholder');
    assert.match(await fig.locator('img').getAttribute('src'), new RegExp(`assets/art/placeholders/placeholder-${card.type}\\.svg$`));
    await page.waitForFunction(() => document.querySelector('#fb .illust img').naturalWidth > 0);
    assert.match(await fig.innerText(), /그림 준비 중/);
    // 캡션은 문양 아래: 그림 영역과 겹치지 않는다(2차 아트 검수 §2)
    const imgBox = await fig.locator('img').boundingBox();
    const capBox = await fig.locator('figcaption').boundingBox();
    assert.ok(capBox.y >= imgBox.y + imgBox.height - 1.5, `캡션 top ${capBox.y} < 그림 bottom ${imgBox.y + imgBox.height}`);
    assert.ok(Math.abs(imgBox.width / imgBox.height - 4 / 3) < 0.02, '그림은 4:3');
    await page.click('#btn-dogam');
    await page.click(`#dogam [data-entry="${card.id}"]`);
    await page.waitForFunction(() => document.querySelector('#dogam-detail .illust img')?.naturalWidth > 0);
    // 미수집 카드는 그림 대신 먹 번짐
    const unknown = page.locator('#dogam-grid .entry[data-state="unknown"]').first();
    await unknown.click();
    assert.equal(await page.locator('#dogam-detail img').count(), 0);
    assert.equal(await page.locator('#dogam-detail .illust-hidden').count(), 1);
  });

  test('image가 있으면 그 그림, 파일이 없으면 대체 문양으로 바뀐다', async () => {
    const withImage = SAMPLE.map((c) => {
      if (c.anchor || c.disputed) return c;
      return { ...c, image: c.id.endsWith('01') && c.id.startsWith('goguryeo') ? 'assets/art/placeholders/placeholder-event.svg' : 'assets/art/cards/missing.png', image_source: '테스트', image_license: 'CC0' };
    });
    await page.route('**/data/sample-cards.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(withImage) }));
    await openGame(page, server.base);
    const seen = new Set();
    while (seen.size < 2 && await page.getAttribute('#card', 'data-card-id')) {
      const card = await currentCard(page);
      await clickPlace(page, card.answer);
      const fig = page.locator('#fb .illust');
      if (card.id.startsWith('goguryeo') && card.id.endsWith('01')) {
        assert.equal(await fig.getAttribute('data-kind'), 'image');
        assert.equal(await fig.locator('img').getAttribute('alt'), card.title);
        seen.add('image');
      } else if (!seen.has('fallback')) {
        await page.waitForFunction(() => document.querySelector('#fb .illust')?.dataset.kind === 'placeholder');
        assert.match(await fig.locator('img').getAttribute('src'), /placeholder-/);
        seen.add('fallback');
      }
    }
    assert.ok(seen.has('fallback') && seen.has('image'), [...seen].join(','));
  });
});

describe('나라 인장과 색 토큰', () => {
  test('행 머리글: 인장 글자 고·백·신·가와 바이블 나라색, 인장 글자 대비 AA', async () => {
    await openGame(page, server.base);
    const heads = await page.locator('#board .nation-head').evaluateAll((ns) => ns.map((n) => {
      const seal = n.querySelector('.seal');
      const cs = getComputedStyle(seal);
      return { nation: n.dataset.nation, text: seal.textContent, bg: cs.backgroundColor, fg: cs.color, name: n.querySelector('.nation-name').textContent };
    }));
    const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('');
    const lum = (h) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    assert.deepEqual(heads.map((h) => h.text), ['고', '백', '신', '가']);
    assert.deepEqual(heads.map((h) => h.name), ['고구려', '백제', '신라', '가야']);
    const expect = { goguryeo: bibleHex('고구려'), baekje: bibleHex('백제'), silla: bibleHex('신라'), gaya: bibleHex('가야') };
    for (const h of heads) {
      assert.equal(hex(h.bg), expect[h.nation], h.nation);
      assert.ok(ratio(hex(h.bg), hex(h.fg)) >= 4.5, `${h.nation} 인장 글자 대비 ${ratio(hex(h.bg), hex(h.fg)).toFixed(2)}`);
    }
  });

  test('색 토큰이 아트 바이블 값과 같다(선, 정답·오답 칸, 백제 청, 한지·먹)', async () => {
    await openGame(page, server.base);
    const tok = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return Object.fromEntries(['--paper', '--paper-2', '--paper-3', '--ink', '--ink-soft', '--line', '--celadon-soft', '--seal-soft', '--baekje', '--indigo', '--gold-accent', '--select']
        .map((k) => [k, cs.getPropertyValue(k).trim().toLowerCase()]));
    });
    const rows = BIBLE.split('\n');
    const semantic = (name) => [...rows.find((l) => l.startsWith(`| ${name} `)).matchAll(/`(#[0-9A-Fa-f]{6})`/g)].map((m) => m[1].toLowerCase());
    assert.equal(tok['--paper'], bibleHex('바탕'));
    assert.equal(tok['--paper-2'], bibleHex('칸'));
    assert.equal(tok['--paper-3'], bibleHex('기준 카드'));
    assert.equal(tok['--ink'], bibleHex('글자'));
    assert.equal(tok['--ink-soft'], bibleHex('보조 글자'));
    assert.equal(tok['--line'], bibleHex('선'));
    assert.equal(tok['--gold-accent'], bibleHex('강조'));
    assert.equal(tok['--celadon-soft'], semantic('정답')[0]);
    assert.equal(tok['--seal-soft'], semantic('오답')[0]);
    assert.equal(tok['--baekje'], bibleHex('백제'));
    assert.equal(tok['--indigo'], bibleHex('백제'));
    assert.equal(tok['--select'], /`(#[0-9A-Fa-f]{6})` 테두리/.exec(rows.find((l) => l.startsWith('| 선택(카드)')))[1].toLowerCase());
  });
});

describe('관계 단서의 기준 카드 참조 강조', () => {
  test('키보드 포커스로 기준 카드 칸 강조, 포커스가 빠지면 해제; 클릭하면 잠시 강조', async () => {
    await openGame(page, server.base);
    const card = await currentCard(page);
    await page.click('#more-clue');
    const anchorId = card.clues[1].refs[0];
    const anchor = SAMPLE.find((c) => c.id === anchorId);
    const target = cellSel(anchor.answer);
    const ref = page.locator(`#card .ref-link[data-ref-id="${anchorId}"]`);
    assert.equal(await ref.count(), 1);
    assert.match(await ref.getAttribute('aria-label'), /기준 카드 위치 보기/);
    // 키보드: Tab으로 참조 버튼에 도달
    await page.focus('#card');
    let reached = false;
    for (let k = 0; k < 6 && !reached; k++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate((id) => document.activeElement?.dataset.refId === id, anchorId);
    }
    assert.ok(reached, 'Tab으로 참조에 도달');
    assert.equal(await page.locator(`${target}.ref-target`).count(), 1);
    assert.equal(await page.locator('#board .ref-target').count(), 1);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#board .ref-target').count(), 0);
    // Enter로 눌러도 카드 선택이 바뀌지 않는다
    assert.equal(await page.locator('#card.selected').count(), 0);
    // 클릭: 강조 후 잠시 뒤 해제
    await page.mouse.click(0, 0);
    await ref.dispatchEvent('click');
    assert.equal(await page.locator(`${target}.ref-target`).count(), 1);
    await page.waitForFunction(() => document.querySelectorAll('#board .ref-target').length === 0, null, { timeout: 4000 });
  });

  test('튜토리얼에서도 참조가 튜토리얼 보드의 기준 카드 칸을 강조한다', async () => {
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    await page.click('#tut-next');
    await page.click('#tut-more');
    await page.locator('#tut-card .ref-link').focus();
    assert.equal(await page.locator('#tut-board .cell.ref-target .chip-anchor').count(), 1);
  });
});
