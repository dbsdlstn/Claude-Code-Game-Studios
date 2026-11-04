# 한양 도감 — 웹 플레이 빌드

Godot 빌드와 같은 규칙, 같은 카드 JSON(스키마 v1)을 쓰는 브라우저 빌드. 규칙 검증과 플레이테스트용이다.
빌드 도구·외부 CDN 없이 HTML/CSS/ES 모듈만 쓴다.

## 실행

저장소 루트에서 정적 서버를 띄우고 브라우저로 연다(`file://`로는 카드 JSON을 읽지 못한다).

```sh
python3 -m http.server 8000
```

→ http://localhost:8000/web/

- 카드 데이터는 `../assets/data/cards/samguk.json`을 먼저 찾고, 없으면 `web/data/sample-cards.json`(12칸 각 1장 + 기준 카드 3장 + 판정 제외 카드 1장)을 쓴다. 경로는 `web/src/config.js` 한 곳에서 바꾼다.
- 쿼리로 덮어쓰기: `?data=data/sample-cards.json`(데이터 고정), `?seed=42`(카드 순서 고정), `?notitle=1`(타이틀·튜토리얼 건너뜀, 테스트용).
- 하단 바에 읽은 데이터 파일과 카드 수가 나온다. 검증 규칙은 `tools/validate_cards.py`와 같고(FIELD, R1~R9), 오류가 하나라도 있으면 게임을 시작하지 않고 오류 목록을 보여 준다(D11).

## 정적 배포(itch.io 등)

```sh
python3 tools/build_web.py            # → dist/web/ (카드 검증 → web 복사 → 카드·튜토리얼 JSON을 data/로, 경로 수정)
python3 tools/build_web.py --release  # verified 카드만. 지금은 전부 verified: false라 실패가 정상
```

`dist/web/` 안의 파일만으로 돈다(저장소 루트 불필요). itch.io에는 `dist/web`의 내용을 zip으로 묶어(`index.html`이 zip 최상위) HTML 프로젝트로 올린다. 로컬 확인: `python3 -m http.server 8000 --directory dist/web` → http://localhost:8000/. `dist/`는 git에 넣지 않는다.

## 조작

- **처음 화면**: 시작하기(첫 실행이면 튜토리얼부터) / 이어하기 / 도감 / 하는 방법. 본게임 상단 `처음 화면`으로 돌아온다.
- **튜토리얼**: Godot과 같은 공용 튜토리얼 파일(`assets/data/cards/tutorial.json`: 본 덱의 기준 카드 `anchor_id` + 본 덱에 없는 연습 카드)로 시기 정의 → 단서 1 → 관계 단서로 칸 좁히기 → 배치 → 해설을 직접 해 본다. 먹물·도감에 영향 없음, `건너뛰기` 가능, `하는 방법`에서 다시 할 수 있다.
- **배치**: 왼쪽 카드를 마우스로 끌어 보드 칸에 놓는다(손 아래 칸이 강조된다). 또는 카드를 눌러 고른 뒤(붉은 테두리) 칸을 누른다.
- **키보드**: 카드에 포커스 → Enter(고르기, 보드로 포커스 이동) → 방향키로 칸 이동 → Enter로 놓기. Esc는 취소. `단서 더 보기`·`도감`은 Tab으로 간다.
- **단서 더 보기**: 2단계(기준 카드와의 관계) → 3단계(직접 힌트).
- **정답**: 칸에 이름이 공개되고(○) 도감에 수집된다. **오답**: 먹물 1 소모, 카드는 정답 칸에 공개(✕)되고 소모된다.
- **라운드**: 판정 카드 12장. 칸과 무관하게 뽑으므로 한 칸에 여러 장, 빈 칸도 생긴다. 아직 수집하지 않은 카드가 먼저 나온다(D22). 상단에 `카드 n / 12`, `도감 m / 36`.
- 먹물 5개가 모두 떨어지면 라운드 실패 → 재도전. 먹물이 남은 채 12장을 처리하면 라운드 클리어.
- 판정 카드 36장을 모두 수집하면 **도감 완성**(게임 클리어) 화면이 뜬다.
- **라운드 결과**: 정답 수, 몇 단계 단서에서 놓았는지 분포, 새로 수집한 카드, 오답 해설 다시 보기.
- **도감**: 상단 `도감` 버튼. 칸별 수집 수(`n / 3`)와 카드, 누르면 해설과 출처. 판정 제외(disputed) 카드는 아래 "견해가 나뉘는 기록"에 견해 요약과 함께 따로 싣는다.
- **플레이 기록**: 끝난 라운드마다 이 브라우저에 쌓인다(라운드 수, 정답률, 평균 단서 단계). 도감의 `기록 내보내기 (JSON)`로 플레이테스트 데이터를 받는다. 형식: `format: "hanyang-dogam-playlog"`, `history[]`(라운드별 `levels`, `placements[{id, correct, level}]`).
- **저장**: 브라우저 localStorage에 자동 저장(라운드 진행 + 도감). 카드 데이터 식별자(경로·카드 수·id 해시)를 함께 저장해, 데이터가 바뀌면 진행 중 라운드는 버리고 수집 기록은 지금 덱에 있는 id만 남긴다. 새로고침해도 이어진다. `새 라운드`는 보드와 먹물만 초기화하고 도감 기록은 남긴다. 전부 지우려면 도감의 `진행 초기화`(두 번 확인).
- **접근성**: 정답·오답은 색 외에 ○/✕ 기호와 글자로 표시, 글자 대비 WCAG AA(4.5:1) 이상, 키보드 포커스 표시, 화면 낭독기에 정답·오답·남은 먹물을 알린다.

## 테스트

저장소 루트에서:

```sh
node --test web/tests/rules.test.js               # 규칙·검증·저장·로딩 단위 테스트
node --test web/tests/validator-parity.test.js    # JS 검증기와 tools/validate_cards.py 결과 일치(python3 필요)
node --test web/tests/e2e.test.mjs                # 브라우저 E2E: 샘플 데이터 + 실제 samguk.json(Playwright, 정적 서버 자동 기동)
node --test web/tests/e2e-flow.test.mjs           # 타이틀·튜토리얼·결과 화면·도감 disputed 분리·플레이 기록·초기화·낭독 알림 E2E
node --test web/tests/e2e-dist.test.mjs           # tools/build_web.py를 돌려 dist/web만으로 E2E
node web/tests/screenshots.mjs           # 화면별 스크린샷 → production/qa/evidence/web/
```

E2E와 스크린샷은 사전 설치된 Playwright(`require('playwright')`)와 `python3`을 쓴다.
실제 데이터 E2E와 일치 테스트의 samguk.json 항목은 그 파일이 없으면 건너뛴다.

## 구조

| 파일 | 역할 |
|---|---|
| `src/rules.js` | 게임 규칙(순수 함수, DOM 없음): 스키마 검증, 라운드·판정·먹물·클리어/실패, 도감 기록, 저장 복원 |
| `src/data.js` | 카드 JSON 로딩(후보 경로 순서대로) |
| `src/storage.js` | localStorage 저장(전부 try/catch) |
| `src/config.js` | 데이터 경로, 시작 먹물, verified 전용 여부, 저장 키 |
| `src/main.js` | 타이틀, 본게임, 결과 화면, 도감, 기록 내보내기 |
| `src/ui/dom.js`, `src/ui/drag.js` | DOM 도우미, 포인터 드래그 |
| `src/ui/tutorial.js` | 첫 실행 튜토리얼 |
| `.gdignore` | Godot가 이 폴더를 가져오지 않게 한다 |
