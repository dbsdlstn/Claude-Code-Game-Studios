# 로컬 실행 가이드 (한양 도감 Godot MVP)

클라우드 세션에서는 Godot를 실행하지 못했다. 코드와 테스트는 정적 검토, `gdparse`/`gdlint`(gdtoolkit 4.5), GDScript 검증기의 Python 이식(`tools/gd_card_validator_port.py`)으로만 확인했다. **아래 순서로 처음 실행하고 결과를 확인해야 한다.**

## 1. 준비

- Godot **4.7.x** 표준판(.NET 아님). `godot`가 PATH에 없으면 아래 명령의 `godot`를 실행 파일 전체 경로로 바꾼다(macOS: `Godot.app/Contents/MacOS/Godot`).
- 저장소 루트(`project.godot`가 있는 폴더)에서 실행한다.
- 렌더러는 **Compatibility**(OpenGL 3.3 / WebGL 2)다(decision-log D29).

## 2. 처음 한 번: 가져오기(import)

`class_name` 전역 클래스 목록(`.godot/global_script_class_cache.cfg`)이 있어야 스크립트끼리 서로를 찾는다.

```bash
godot --headless --path . --import
```

- 4.7.1·4.7.2에서 새 프로젝트의 첫 import가 **종료 코드 139(크래시)**로 끝날 수 있다(engine-reference 관찰: 17번 중 3번). **한 번 더 실행하면 0**으로 끝난다.
- 출력에 `Parse Error`나 `SCRIPT ERROR`가 없는지 본다. 정적 검토만 했으므로 여기서 오류가 나올 수 있다.
- import 뒤 `git status`에 나오는 `*.gd.uid`와 `.godot/global_script_class_cache.cfg`는 **커밋한다**(L8). 그러면 다음 클론은 import 없이도 클래스를 찾는다. `.gitignore`가 이 둘은 추적하도록 되어 있고, gdUnit4 리포트(`reports/`)와 `export_presets.cfg`는 무시한다.

## 3. 게임 실행

```bash
godot --path . --windowed --resolution 1280x720
```

- 메인 씬은 `res://src/main.tscn`이다. `assets/data/cards/samguk.json`(44장)을 읽는다. 이 파일이 없으면 개발 모드에서 `tests/fixtures/cards_fixture.json`을 대신 읽고 화면 위에 표시한다.
- 첫 실행(저장 없음)이면 튜토리얼이 열린다. 다시 보려면 저장 파일을 지운다(에디터: 프로젝트 → 사용자 데이터 폴더 열기 → `progress.json` 삭제).
- 저장: `user://progress.json`(도감, 플레이 기록, 튜토리얼 완료, 진행 중 라운드).

스크린샷 증거(`production/qa/evidence/`):

```bash
mkdir -p production/qa/evidence/godot-mvp
godot --path . --windowed --resolution 1280x720 --write-movie production/qa/evidence/godot-mvp/01-title.png --quit-after 60 res://src/main.tscn
```
`--write-movie`는 첫 화면(튜토리얼 또는 타이틀)만 찍는다. 보드·결과·도감은 에디터 실행 중 OS 캡처로 남긴다.

### 출시 내보내기에 대해 (L7)
- 디버그가 아닌 빌드는 무조건 출시 모드다(D11). 카드 44장이 모두 `verified: false`인 지금은 **"출시 빌드는 사실 확인이 끝난 카드만 씁니다" 안내와 규칙 8 오류 목록이 뜨는 것이 정상**이다. 플레이테스트는 에디터 실행이나 **디버그 내보내기**로 한다.
- 내보내기 프리셋을 만들 때 리소스 탭의 **제외 필터**에 `tests/*, addons/gdUnit4/*, prototypes/*, web/*, docs/*, tools/*, studio-tests/*, production/*`를 넣는다. `tests/`는 gdUnit4 없이는 로드되지 않는 스크립트를 담고 있다. (`export_presets.cfg`는 `.gitignore` 대상이라 저장소에 없다.)

## 4. 테스트 (gdUnit4)

### 설치 (M3)
1. https://github.com/godot-gdunit-labs/gdUnit4/releases 에서 **6.2.2 이상**을 받는다. 6.2.x의 README는 Godot 4.5~4.7.1 호환을 적고, 6.2.2는 4.7.2에서 동작이 확인됐다(`docs/engine-reference/godot/current-best-practices.md`, 2026-10-17).
2. 압축을 풀어 `addons/gdUnit4/` 폴더를 프로젝트의 `addons/gdUnit4/`로 복사한다(또는 에디터의 Asset Store 작업 공간에서 설치. 4.7은 Asset Library 대신 Asset Store다).
3. 에디터에서 프로젝트 → 프로젝트 설정 → 플러그인 → gdUnit4 **사용** 체크. 에디터를 다시 연다.

### 실행 (헤드리스)

```bash
godot --headless --path . --import
godot --headless -s -d --remote-debug tcp://127.0.0.1:0 res://addons/gdUnit4/bin/GdUnitCmdTool.gd -a res://tests --ignoreHeadlessMode
```

종료 코드: 0 통과, 100 실패, 101 경고(고아 노드 포함), 105 테스트 스크립트 파싱 오류, 1 import 전. `--remote-debug` 때문에 원격 포트 관련 `ERROR:` 두 줄이 나오는 것은 정상이다.

### 테스트 목록

| 파일 | 다루는 것 |
|---|---|
| `tests/unit/cards/card_validator_test.gd` | 검증 규칙 0~9, Python 검증기와 맞춘 라벨·참조 규칙, 경고 |
| `tests/unit/cards/card_loader_test.gd` | JSON 파싱, 규칙 9(출시/개발 모드 필터), 판정 제외(규칙 6), 경로 선택 |
| `tests/unit/config/game_config_test.gd` | 설정 읽기, 시기 정의, 라벨 맵, 출시 빌드 강제 |
| `tests/unit/round/round_session_test.gd` | 단서 공개, 판정, 오답 공개·소모, 채워진 칸도 받음, 한 칸 여러 장(D22), 클리어/실패, 요약, 진행 중 라운드 저장·복원, **이어하기 뒤 새로 모은 카드 유지**, **되살린 값 정합성 검사** |
| `tests/unit/round/round_builder_test.gd` | **칸과 무관하게 12장, 미수집 우선, 부족하면 수집 카드로**, 같은 시드 같은 순서 |
| `tests/unit/round/ink_meter_test.gd` | 먹물 규칙 |
| `tests/unit/round/tutorial_test.gd` | 연습 카드 판정(먹물 없음), 본 덱과 겹침 거부, **출시 모드에서 확인 전 연습 카드 거부**, disputed 기준 카드 거부, 보드 기준 카드 |
| `tests/unit/ui/board_cell_text_test.gd` | 한 칸에 많이 쌓일 때 "외 n장" 축약(노드 없이 정적 함수) |
| `tests/unit/progress/progress_data_test.gd` | 도감 수집, 도감 완성, 플레이 기록(정답률·평균 단서 단계), 저장 v1/v2, **v1 라운드 수와 기록 정합**, version 읽기 |
| `tests/integration/cards/card_file_loading_test.gd` | 설정, 픽스처, samguk.json(44장, 칸당 3장, 출시 모드는 규칙 8만), 라운드 12장, tutorial.json |
| `tests/integration/cards/validator_parity_test.gd` | Python 검증기와 같은 39개 케이스 |
| `tests/integration/save/save_store_test.gd` | user:// 저장/불러오기, 덮어쓰기, 깨진 파일, 교체 중 끊김 복구, 임시·백업 파일 정리, **모르는 새 형식 보관 후 새로 시작** |

### Python 쪽 확인(Godot 없이)

```bash
python3 tools/validate_cards.py                                   # samguk.json: PASS
python3 tools/validator_parity.py                                 # 39/39 cases match
python3 tools/validate_cards.py --tutorial assets/data/cards/tutorial.json   # TUTORIAL RESULT: PASS
python3 tools/gd_card_validator_port.py --parity                  # GDScript 검증기 이식: 39/39
python3 tools/gd_card_validator_port.py assets/data/cards/samguk.json   # 0 errors, anchors 4, playable 36, disputed 4
```

## 5. 확인 체크리스트

**시작과 타이틀**
- [ ] import·에디터 열기에서 파서 오류 0개, gdUnit4 전체 통과
- [ ] 첫 실행: 튜토리얼이 바로 열린다. 저장이 있으면 타이틀이 열린다
- [ ] 타이틀: 시작하기 / 이어하기(진행 중 라운드가 있을 때만 켜짐) / 도감 / 하는 방법, 아래에 "도감 m / 36"
- [ ] 진행 중 라운드가 있을 때 "시작하기" → "진행 중인 라운드를 버리고 새로 시작할까요?" 확인 창(한글이 보이는지, 취소하면 그대로)
- [ ] 키보드만으로: 타이틀·결과·도감·하는 방법이 열리면 첫 버튼에 초점이 있고 Enter로 누를 수 있다
- [ ] 하는 방법: 규칙과 시기 정의 3줄, 돌아가기

**튜토리얼**
- [ ] 보드에 `tutorial.json`의 `anchor_id` 기준 카드(지금은 [광개토대왕릉비])와 연습 카드가 relation으로 가리키는 기준 카드만 보인다. 연습 카드(지금은 [엄리대수 건너기], 정답 칸은 기준 카드와 다른 고구려 건국기)는 본 덱에 없는 카드다
- [ ] 튜토리얼도 키보드로: "다음"에 초점, 카드 Enter → 보드 첫 칸 → 방향키 → Enter
- [ ] 출시 모드(`release_mode: true`)에서는 `verified: false` 연습 카드를 쓰지 않는다: 튜토리얼이 열리지 않고 상단에 "튜토리얼 데이터 오류로 튜토리얼을 건너뜀"
- [ ] 다음 → 단서 1 → 단서 2(관계)로 넘어가고, 놓기 단계에서 카드를 끌어 놓을 수 있다
- [ ] 오답: 고른 칸이 붉게, 3단계까지 열림, 먹물 표시 없음, 다시 놓을 수 있다
- [ ] 정답: 해설과 "본게임 시작". 건너뛰기는 언제든 타이틀로. 둘 다 다음 실행부터 튜토리얼이 자동으로 안 열린다

**본게임**
- [ ] 보드: 행 고구려·백제·신라·가야, 열 건국기·전성기·결말기, **열 머리글 아래 시기 정의**
- [ ] 기준 카드 **4장**(광개토대왕릉비·황산벌 전투·박혁거세 신화·수로왕 탄생 신화)이 각 칸에 "기준: …"
- [ ] 상단: 먹물 ●●●●●, "카드 n / 12", "도감 m / 36", 도감·타이틀 버튼
- [ ] 카드는 이름 없이 단서 1단계만. "단서 더 보기"로 2·3단계, 3단계 뒤 버튼 꺼짐
- [ ] 끌어 놓기: 끄는 동안 대상 칸이 노랗게. **칸 여러 개 위를 지나가게 끌어도 지나간 칸이 원래 색으로 돌아온다**(L2)
- [ ] **드래그 미리보기 "? 사건 카드"의 한글이 보인다**(L3)
- [ ] 카드를 눌러(붉은 테두리) 고른 뒤 칸 누르기로도 놓인다
- [ ] 키보드: Tab으로 카드에 초점 → Enter로 고르기(초점이 보드 첫 칸으로) → 방향키로 칸 이동 → Enter로 놓기
- [ ] 정답: 칸 초록, 이름 공개, 해설, 먹물 그대로. 오답: 고른 칸 잠깐 붉게, 정답 칸에 "(오답 공개)", 먹물 -1
- [ ] **이미 카드가 있는 칸에도 놓을 수 있고 판정된다**(D22). 한 칸에 이름이 쌓이고, 3장 이상이면 최근 2장과 "외 n장"만 보인다(마우스를 올리면 전체 목록 툴팁). **한 칸에 3장, 그중 오답 2장**인 1280×720 화면에서 보드가 넘치지 않는다
- [ ] 마우스로 카드를 눌러 고르면 카드가 노란 바탕 + 붉은 테두리, 보드 칸에는 초점 테두리가 생기지 않는다. 키보드로 고를 때만 첫 칸에 붉은 초점 테두리
- [ ] 한 라운드에 같은 칸 카드가 여러 장 나올 수 있다(빈 칸이 정답을 알려 주지 않는다)
- [ ] 해설이 길어도 옆 패널이 스크롤된다(L5)
- [ ] 라운드 도중 "타이틀" → "이어하기"로 같은 카드·먹물·단서 단계·보드에서 계속. 게임을 껐다 켜도 이어하기가 된다
- [ ] 이어하기 전에 모은 카드도 결과 화면의 "새로 모은 카드"와 도감 플레이 기록에 들어간다

**결과·도감**
- [ ] 라운드 끝: 결과 화면(라운드 클리어 또는 실패, 정답 수, 남은 먹물, 새로 모은 카드 수와 목록, 단서 단계 분포, 틀린 카드 해설), 새 라운드/도감/타이틀
- [ ] 먹물 5개를 다 쓰면 그 자리에서 실패 결과 화면
- [ ] 도감: 맞힌 카드만 이름이 열리고 누르면 해설·근거·사실 확인 상태. 기준 카드와 "견해가 나뉘는 기록" **4장**은 항상 보임. 플레이 기록 한 줄(라운드 수, 클리어·실패, 정답률, 평균 단서 단계)
- [ ] 36장을 다 모으면 "[도감 완성]"(라운드 도중이면 메시지, 마지막 카드면 결과 화면에), 도감 제목 "도감 완성 36 / 36". 빨리 보려면 `progress.json`의 `collected`에 35개 id를 넣고 시작
- [ ] 다시 켜도 도감·플레이 기록이 남는다
- [ ] v1 형식 `progress.json`(`{"version":1,"collected":[...],"rounds_played":2}`)을 넣으면 도감 플레이 기록이 "라운드 2 … 이전 버전 기록이라 세부가 없습니다"
- [ ] `{"version":99,...}`를 넣으면 `progress.v99.json`으로 보관되고 새로 시작한다는 안내가 뜬다

**화면·글꼴**
- [ ] 한글이 네모(□)로 깨지지 않는다. 목록의 한글 글꼴이 없으면 상단에 "목록의 한글 글꼴을 찾지 못함: 글자가 네모로 보이면 …" 안내가 뜬다. **한글 글꼴이 없는 리눅스에서 안내와 실제 표시가 맞는지**(OS 대체 글꼴로 한글이 보이는데 안내가 뜨면 기록). `assets/fonts/ui_font_kr.ttf`에 한글 TTF를 넣으면 그 글꼴로 바뀐다
- [ ] `--resolution 1280x720`, `1920x1080`, `2560x1440`, `1280x800`에서 글자가 잘리거나 칸이 넘치지 않고, 2560×1440에서 흐리지 않다

## 6. 설정 바꾸기

`assets/data/config/game_config.json`:
- `start_ink`(5), `round_size`(12)
- `release_mode`: `true`면 `verified: true && disputed: false` 카드만 로드. 디버그가 아닌 빌드는 이 값과 무관하게 출시 모드
- `nations`, `eras`: 보드 행·열, 라벨, 시기 정의(검증기의 라벨 검사도 이 값을 쓴다)
- `save_path`, `tutorial_path`(비우면 튜토리얼 없음), `ui_font_path`

## 문제가 생기면

오류 메시지를 그대로 `docs/decision-log.md` "남은 문제"에 적거나 다음 세션에 전달한다.
