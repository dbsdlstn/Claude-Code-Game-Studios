// JS 검증기(web/src/rules.js)와 tools/validate_cards.py가 같은 (규칙, 대상) 오류를 내는지 확인한다.
// python3이 필요하다. 실행: node --test web/tests/validator-parity.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateCards } from '../src/rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const PY = path.join(ROOT, 'tools', 'validate_cards.py');
const SAMPLE = path.join(here, '..', 'data', 'sample-cards.json');
const SAMGUK = path.join(ROOT, 'assets', 'data', 'cards', 'samguk.json');

function pythonErrors(file, release = false) {
  let out;
  try {
    out = execFileSync('python3', [PY, file, ...(release ? ['--release'] : [])], { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout;
  }
  return out.split('\n').map((l) => /^FAIL {2}\[(\w+)\] (.+?): /.exec(l)).filter(Boolean).map((m) => `${m[1]} ${m[2]}`).sort();
}

function jsErrors(file, release = false) {
  return validateCards(JSON.parse(readFileSync(file, 'utf8')), { release }).errors.map((e) => `${e.rule} ${e.id}`).sort();
}

/** 규칙마다 하나씩 어기는 카드 묶음. */
function brokenDeck() {
  const base = JSON.parse(readFileSync(SAMPLE, 'utf8'));
  const card = base.find((c) => c.id === 'goguryeo-peak-01');
  const v = (id, patch) => ({ ...structuredClone(card), id, ...patch(structuredClone(card)) });
  return [
    ...base.filter((c) => !(c.answer.nation === 'gaya' && c.answer.era === 'ending')),
    v('dup', () => ({})), v('dup', () => ({})),
    v('bad-answer', () => ({ answer: { nation: 'balhae', era: 'x' } })),
    v('bad-order', (c) => ({ clues: [c.clues[1], c.clues[0], c.clues[2]] })),
    v('title-leak', (c) => ({ clues: [{ ...c.clues[0], text: `${c.title} 백제 건국기` }, c.clues[1], c.clues[2]] })),
    v('non-anchor-ref', (c) => ({ clues: [c.clues[0], { ...c.clues[1], refs: ['goguryeo-founding-01'] }, c.clues[2]] })),
    v('direct-ref', (c) => ({ clues: [c.clues[0], c.clues[1], { ...c.clues[2], refs: ['goguryeo-peak-anchor'] }] })),
    v('no-note', () => ({ disputed: true, disputed_note: null })),
    v('stray-note', () => ({ disputed_note: 'x' })),
    v('no-license', () => ({ image: 'a.png' })),
    v('no-era', () => ({ explanation: '설명' })),
    v('bad-url', (c) => ({ source: { ...c.source, url: 'ftp://x' } })),
    v('verified-no-by', () => ({ verified: true })),
    v('missing-type', () => ({ type: 'place', difficulty: 0 })),
  ];
}

test('샘플 데이터: 두 검증기 모두 오류 없음', () => {
  assert.deepEqual(jsErrors(SAMPLE), pythonErrors(SAMPLE));
  assert.deepEqual(jsErrors(SAMPLE), []);
});

test('samguk.json: 두 검증기 결과 일치', { skip: !existsSync(SAMGUK) && 'samguk.json 없음' }, () => {
  assert.deepEqual(jsErrors(SAMGUK), pythonErrors(SAMGUK));
  assert.deepEqual(jsErrors(SAMGUK, true), pythonErrors(SAMGUK, true));
});

test('규칙 위반 묶음: 두 검증기의 (규칙, 대상) 오류 목록이 같다', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hanyang-'));
  try {
    const file = path.join(dir, 'broken.json');
    writeFileSync(file, JSON.stringify(brokenDeck()));
    const py = pythonErrors(file);
    assert.ok(py.length >= 15, `python 오류 수 ${py.length}`);
    assert.deepEqual(jsErrors(file), py);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
