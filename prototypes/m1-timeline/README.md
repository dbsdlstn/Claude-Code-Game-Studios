# M1 프로토타입: 사료 카드 + 왕대 연표 + 간격 반복 (PROTOTYPE - NOT FOR PRODUCTION)

**상태**: 진행 중. 규칙은 `design/leitner-spec.md`(§3~§6, §10)와 M1 설정(`production/playtest/m1-plan.md`)을 따른다(D66). 결정 기록: `docs/decision-log.md` D56, D59, D61, D64, D66, D72, D75, D82. **사람 테스트 준비 완료**(M1 테스트 빌드는 브랜치 `claude/m1-test-build`에 보존, D79). 이 폴더는 M2로 발전 중: 진행자 안내는 `STUDY.md`.

## 검증할 가설
한능검 심화 수험생에게 "이름 없는 사료 지문을 읽고 한 나라의 왕대 연표 사이에 꽂기 + 단서 비용 + Leitner 간격 반복"이
**같은 내용을 플래시카드로 외우는 것보다 낫다**(더 오래 기억하고, 순서·왕대를 근거로 말할 수 있다). 판단은 사람 테스트로 한다(D56 ④).

## 실행

### PC에서 바로 해 보기(일반 학습 모드)
필요한 것: Python 3(설치만 하면 된다, 추가 패키지 없음)과 최신 브라우저(Chrome·Edge·Firefox·Safari). 인터넷 연결은 필요 없다.

1. 저장소를 받는다(`git clone` 또는 GitHub의 Code → Download ZIP 후 압축 풀기).
2. 터미널을 **저장소 맨 위 폴더**(`CLAUDE.md`가 있는 곳)에서 연다. 카드 데이터 `assets/data/...`를 읽으려면 반드시 이 폴더에서 띄워야 한다.
   - Windows: 탐색기에서 그 폴더를 열고 주소창에 `cmd` 입력 후 Enter(또는 폴더 빈 곳 Shift+우클릭 → "PowerShell 창 열기/터미널에서 열기").
   - macOS: 터미널에서 `cd 저장소경로`.
3. 정적 서버를 띄운다.

   | 운영체제 | 명령 |
   |---|---|
   | Windows | `py -m http.server 8000` (안 되면 `python -m http.server 8000`) |
   | macOS·Linux | `python3 -m http.server 8000` |

4. 브라우저에서 **http://localhost:8000/prototypes/m1-timeline/** 를 연다. 타이틀에서 나라(고구려·백제·신라·통일신라·고려)를 고르고 [새 카드 시작]을 누르면 일반 학습 모드다. 기록·레벨·도감은 이 브라우저에 저장되어 다음에 열면 이어진다.
5. 끝낼 때는 터미널에서 Ctrl+C.

자주 막히는 것:
- **"데이터를 읽지 못했다: … (HTTP 404)"**: 서버를 `prototypes/m1-timeline` 안에서 띄웠을 때다. 저장소 맨 위 폴더에서 다시 띄운다. 파일을 더블클릭(`file://`)으로 열면 동작하지 않는다(브라우저가 모듈·데이터 읽기를 막는다).
- **`py`를 찾을 수 없음**: python.org에서 설치할 때 "Add python.exe to PATH"와 "py launcher"를 켠다. Microsoft Store판이면 `python` 명령을 쓴다.
- **8000 포트가 이미 쓰임**: 숫자를 바꾼다(`py -m http.server 8080` → http://localhost:8080/prototypes/m1-timeline/).
- **처음부터 다시**: [숙련 도감] → 오답 노트 탭 아래 [학습 기록 초기화](학습 기록과 레벨·업적을 지운다). 모든 나라 기록을 한 번에 확실히 비우려면 브라우저 개발자 도구 → Application → Local Storage → `localhost:8000`을 지운다. 기록을 남기려면 먼저 [기록 내보내기(JSONL)].
- 휴대폰으로 보려면 PC와 같은 Wi-Fi에서 `http://PC의IP:8000/prototypes/m1-timeline/`(Windows 방화벽이 물으면 "개인 네트워크" 허용). 공개 인터넷에 올리지 않는다(프로토타입 배포 금지).

### 사람 테스트용 실행(M2, 고구려·고려만)
M2 사람 테스트는 나라를 두 개(고구려·고려)로 줄인 덱 목록 `assets/data/cards/v2/manifest-m2test.json`을 쓴다(D194). 카드 파일은 실제 `manifest.json`과 같다.

1. 위 "PC에서 바로 해 보기" 1~3단계대로 **저장소 맨 위 폴더**에서 서버를 띄운다(Windows `py -m http.server 8000`, macOS·Linux `python3 -m http.server 8000`).
2. 브라우저에서 아래 주소를 연다(한 줄).

   ```
   http://localhost:8000/prototypes/m1-timeline/?manifest=../../assets/data/cards/v2/manifest-m2test.json
   ```

3. 타이틀에 고구려·고려 두 나라만 보이면 맞다. 나라를 바꿔도 주소의 `manifest=`가 유지된다.
4. 참가자마다 **새 브라우저 프로필**(또는 시크릿 창, 단 닫으면 기록이 사라진다)을 쓴다. 기록은 브라우저 저장소에 남고 다른 덱 목록과 공유된다. 테스트가 끝나면 [숙련 도감] → [기록 내보내기(JSONL)]로 로그를 받는다.
5. 휴대폰 참가자: PC와 같은 Wi-Fi에서 `http://PC의IP:8000/prototypes/m1-timeline/?manifest=../../assets/data/cards/v2/manifest-m2test.json`.

이 주소는 일반 학습 모드다. M1 방식 비교용 `?study=1`(아래)과는 다른 테스트다. 묶음(`build.py`)은 기본 `manifest.json`만 싣는다.

### 주소 옵션
- `?nation=baekje`처럼 나라를 바로 고른다(goguryeo, baekje, silla, usilla, goryeo).
- `?study=1`은 M1 사람 테스트 모드다(아래). 일반 학습과 저장이 따로다.

- 데이터: `js/config.js`의 `dataUrls` 순서로 찾는다. 스키마 v2 `assets/data/cards/v2/goguryeo-m1.json`(앵커 10 + 사료 12) → `data/sample.json`(테스트용 8장, 왕 앵커 5개). `?data=경로`로 고정, `?seed=7`로 섞기 고정. 임시 형식(D58) 변환은 v2로 옮겨 지웠다(D72).
- **사람 테스트 모드** `?study=1`: 진행자 메뉴(참가자 ID, P1/P2 교차 배정, 단계 pre / learn-A / learn-B / post0 / post1), 방식 B 플래시카드, 테스트 화면("어느 왕 때인가" 기준 왕 10명 + 근거, 단서·정답 없음), 진행자 메뉴 잠금(코드), 참가자별 저장과 JSONL 내보내기. 코드: `js/study.js`(규칙), `js/study-ui.js`(화면), 방식 A는 일반 화면을 반(6장)만 걸러 쓴다. 안내: `STUDY.md`.
- 지금 데이터는 전부 사실 확인 전이다. 화면 아래에 "사실 확인 전 카드입니다"를 늘 표시한다.

## 조작
- 위: 사료 카드(이름 숨김). **단서 보기**: 1단계 관계(구간), 2단계 직접. 카드에 지금 맞혔을 때의 상자 변화가 보인다.
- 아래: 왕대 연표. 기준 카드는 **왕 단위**("소수림왕 371~384, 즉위 371년", 재위 기간은 앵커 데이터의 `reign_range`). **칸 = 앵커 k 이후 ~ 앵커 k+1 이전**(스키마 v2). 첫 앵커 앞은 칸이 아니다. 이번 세션에 놓은 카드는 그 칸 안에 보이지만 칸을 더 나누지 않는다.
- 꽂기: 터치 화면은 칸을 눌러 고른 뒤 "이 칸에 꽂기"로 확정(취소 가능). 마우스·키보드는 한 번(Tab+Enter, 끌어 놓기도 됨). `?confirm=1|0`으로 강제.
- 정답이면 이름·연도·왕대·해설·수험 정리·출처, 오답이면 고른 칸과 맞는 칸(한 칸 차이면 "한 칸 차이").
- 세션 끝에 그 세션에서 틀린 카드를 한 번 더(재도전, 상자 변화 없음). "세션 끝내기"로 일찍 끝낼 수 있다.
- 도래 카드와 새 카드가 없으면 빈 세션: **미리 복습**(연습, 상태 안 바뀜) 또는 **다음 세션으로**(세션 +1).
- **숙련 도감**: 카드별 현재 등급(동 상자≥3, 은 ≥4, 금 = 상자 5이고 마지막이 깨끗한 정답)과 최고 등급, 상자, 다음 복습, 틀린 횟수. **오답 노트**(틀린 적 있고 지금 상자 2 이하)와 "다시 풀기(연습)". **기록 내보내기(JSONL)**: m1-plan §11 로그 규격, 참가자 ID는 도감에서 입력하거나 `?participant=P1`.
- **M2(D82)**: 타이틀 화면(시작하기/이어하기, 숙련 도감, 하는 방법, 나라 선택: 지금은 고구려만), 덱 목록(`data/decks.json`, 또는 콘텐츠의 `assets/data/cards/v2/manifest.json`)으로 나라별 여러 파일을 합쳐 읽기, 보상 골격(XP·레벨·연속일·하루 목표·업적, 수치는 `config.rewards`). 저장은 카드 id 기준이라 덱이 늘어도 진행이 유지된다. `?title=0`이면 타이틀 없이 바로 학습. `?manifest=경로`로 덱 목록을 바꿔 끼울 수 있다(테스트: `tests/fixtures/manifest-two-nations.json`, 백제는 가상 고정 데이터). 테스트 모드에서는 타이틀·보상이 꺼진다.
- 처음 실행하면 30초 안내(4장, 건너뛰기 가능, 도감에서 다시 보기). `?intro=0|1`로 강제. 테스트 모드에서는 끔.
- 저장: localStorage(`hanyang-m1:save:v2`, 형식 leitner-spec §2). 학습 세션을 1장 이상 하고 닫으면, 다시 열 때 그 세션을 끝난 것으로 처리한다(§5). 도감의 "학습 기록 초기화"(두 번 확인).

## 규칙 수치(`js/config.js` 한 곳)
`LEITNER_DEFAULT` = leitner-spec §8, 그 위에 `M1_OVERRIDE`(세션 6장, 첫 세션에 6장 도입).

| 항목 | 값 |
|---|---|
| 간격(세션 수) | 상자 1:1, 2:2, 3:4, 4:7, 5:12 |
| 상자 갱신 | 깨끗한 정답 +1(최대 5) · 관계 단서 후 정답 그대로 · 직접 단서 후 정답 -1(최소 1) · 오답 1 |
| 재학습 표시(D74) | 상자 1(새 카드 포함)에서 틀리면 표시. 표시가 있으면 깨끗한 정답 2번 연속이어야 상자 2. 단서 정답은 연속을 끊음 |
| 세션 구성 | 새 카드 예약 new_min → 도래 카드(상자 낮은 순, due 오래된 순, 덱 순서) → 새 카드 new_max까지 → 남으면 채우지 않음 → 시드(세션 번호·덱 해시) 섞기 |
| 재도전 | 그 세션의 오답 각 한 번, 상자 변화 없음 |
| 등급 | 동 상자≥3, 은 ≥4, 금 상자 5 + 마지막 깨끗한 정답. 최고 등급은 내려가지 않음 |

## 테스트
```sh
node --test prototypes/m1-timeline/tests/rules.test.js   # 규칙 단위(판정, 단서 비용, 상자, 세션 구성, 저장, 데이터 로더)
node --test prototypes/m1-timeline/tests/e2e.test.mjs    # Playwright: 모바일 390×844(터치), 데스크톱 1280×720
node --test prototypes/m1-timeline/tests/e2e-dist.test.mjs  # build.py로 묶은 dist/m1만으로 실행 확인(사람 테스트 모드 포함)
node --test prototypes/m1-timeline/tests/m2.test.js          # M2 단위(덱 합치기, 나라별 저장, 보상)
node --test prototypes/m1-timeline/tests/e2e-m2.test.mjs     # M2: 타이틀, 보상 자리, 저장 옮기기, 테스트 모드에서 꺼짐
node --test prototypes/m1-timeline/tests/e2e-ux.test.mjs     # 처음 안내, 모바일 가림
node --test prototypes/m1-timeline/tests/e2e-study.test.mjs # 사람 테스트: 한 참가자 pre → A/B → post0 → post1, 로그 규격
node prototypes/m1-timeline/tests/screenshots.mjs        # → production/qa/evidence/m1/
```

## 묶음(플레이테스트용)
```sh
python3 prototypes/m1-timeline/build.py                  # → dist/m1/ (git 제외). 콘텐츠 데이터(v2)를 data/로 넣고 경로를 맞춘다
python3 -m http.server 8000 --directory dist/m1          # → http://localhost:8000/
```
Windows는 `python3` 대신 `py`(예: `py prototypes\m1-timeline\build.py`, `py -m http.server 8000 --directory dist\m1`). 묶은 `dist/m1`은 그 폴더만 복사해 다른 PC에서 같은 명령으로 띄울 수 있다.

## 발견(진행 중)
- 아직 사람 테스트 없음. 모델·자동 테스트만 돌렸다.
