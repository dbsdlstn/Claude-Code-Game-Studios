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
- 쿼리로 덮어쓰기: `?data=data/sample-cards.json`(데이터 고정), `?seed=42`(카드 순서 고정).
- 하단 바에 읽은 데이터 파일과 카드 수, 검증 오류·경고 수가 나온다. 검증 오류가 있는 카드는 빠진다.

## 조작

- **배치**: 왼쪽 카드를 마우스로 끌어 보드 칸에 놓는다. 또는 카드를 눌러 고른 뒤(붉은 테두리) 칸을 누른다. 키보드: 카드에 포커스 후 Enter로 고르고, Tab으로 칸에 가서 Enter.
- **단서 더 보기**: 2단계(기준 카드와의 관계) → 3단계(직접 힌트).
- **정답**: 칸에 이름이 공개되고(○) 도감에 수집된다. **오답**: 먹물 1 소모, 카드는 정답 칸에 공개(✕)되고 소모된다.
- 먹물 5개가 모두 떨어지면 실패 → 재도전. 먹물이 남은 채 모든 카드를 놓으면 클리어.
- **도감**: 상단 `도감` 버튼. 칸별로 수집(○)·오답 공개(점선)·미수집(？？？)·판정 제외(점선 금색) 카드를 보여 주고, 누르면 해설과 근거가 열린다.
- **저장**: 브라우저 localStorage에 자동 저장(라운드 진행 + 도감). 새로고침해도 이어진다. `새 라운드`는 보드와 먹물만 초기화하고 도감 기록은 남긴다.

## 테스트

저장소 루트에서:

```sh
node --test web/tests/rules.test.js      # 규칙·검증·저장·로딩 단위 테스트
node --test web/tests/e2e.test.mjs       # 브라우저 E2E(Playwright, 정적 서버 자동 기동)
node web/tests/screenshots.mjs           # 화면별 스크린샷 → production/qa/evidence/web/
```

E2E와 스크린샷은 사전 설치된 Playwright(`require('playwright')`)와 `python3`을 쓴다.
`assets/data/cards/samguk.json`이 생기면 단위 테스트가 그 파일의 스키마 검증도 함께 돌린다(없으면 건너뜀).

## 구조

| 파일 | 역할 |
|---|---|
| `src/rules.js` | 게임 규칙(순수 함수, DOM 없음): 스키마 검증, 라운드·판정·먹물·클리어/실패, 도감 기록, 저장 복원 |
| `src/data.js` | 카드 JSON 로딩(후보 경로 순서대로) |
| `src/storage.js` | localStorage 저장(전부 try/catch) |
| `src/config.js` | 데이터 경로, 시작 먹물, verified 전용 여부, 저장 키 |
| `src/main.js` | 화면 렌더와 입력(드래그·클릭) |
| `.gdignore` | Godot가 이 폴더를 가져오지 않게 한다 |
