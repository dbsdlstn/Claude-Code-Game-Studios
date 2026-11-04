# 로컬 실행 가이드 (한양 도감 Godot MVP)

클라우드 세션에서는 Godot를 실행하지 못했다. 코드와 테스트는 정적 검토와 `gdparse`(gdtoolkit 4.5) 문법 검사만 거쳤다. **아래 순서로 처음 실행하고 결과를 확인해야 한다.**

## 1. 준비

- Godot **4.7.x** 표준판(.NET 아님). `godot`가 PATH에 없으면 아래 명령의 `godot`를 실행 파일 전체 경로로 바꾼다.
- 저장소 루트(`project.godot`가 있는 폴더)에서 실행한다.

## 2. 처음 한 번: 가져오기(import)

`class_name` 전역 클래스 목록(`.godot/global_script_class_cache.cfg`)이 있어야 스크립트끼리 서로를 찾는다.

```bash
godot --headless --import
```

에디터로 프로젝트를 한 번 열어도 된다. 이때 **출력(Output) 패널에 빨간 파서 오류가 없는지** 확인한다. 정적 검토만 했으므로 여기서 오류가 나올 수 있다.

## 3. 게임 실행

```bash
godot --path . --windowed --resolution 1280x720
```

메인 씬은 `res://src/main.tscn`이다. `assets/data/cards/samguk.json`이 없으면 개발 모드에서 `tests/fixtures/cards_fixture.json`(테스트용: 기준 3 + 칸당 1장 12 + 견해가 나뉨 1)을 대신 읽고, 화면 위쪽에 그 사실을 표시한다.

스크린샷 증거(`production/qa/evidence/`)를 남기려면:

```bash
mkdir -p production/qa/evidence/godot-mvp
godot --path . --windowed --resolution 1280x720 --write-movie production/qa/evidence/godot-mvp/01-board.png --quit-after 60 res://src/main.tscn
```

## 4. 테스트 (gdUnit4)

### 설치
1. https://github.com/MikeSchulze/gdUnit4/releases 에서 **Godot 4.7을 지원한다고 적힌** 최신 릴리스를 받는다(4.7 호환 버전은 이 세션에서 확인하지 못했다).
2. 압축을 풀어 `addons/gdUnit4/` 폴더를 프로젝트의 `addons/gdUnit4/`로 복사한다.
3. 에디터에서 프로젝트 → 프로젝트 설정 → 플러그인 → gdUnit4 **사용** 체크. 에디터를 다시 연다.
   (에디터의 Asset Store에서 설치해도 된다. 4.7은 Asset Library 대신 Asset Store다.)

### 실행 (헤드리스)

```bash
godot --headless --import
godot --headless -s -d --remote-debug tcp://127.0.0.1:0 res://addons/gdUnit4/bin/GdUnitCmdTool.gd -a res://tests --ignoreHeadlessMode
```

종료 코드 0이면 통과. 에디터 하단 GdUnit 패널에서 `res://tests`를 실행해도 된다.

### 테스트 목록

| 파일 | 다루는 것 |
|---|---|
| `tests/unit/cards/card_validator_test.gd` | 스키마 검증 규칙 0(기본 필드)~8 |
| `tests/unit/cards/card_loader_test.gd` | JSON 파싱, 규칙 9(출시/개발 모드 필터), 판정 제외(규칙 6), 경로 선택 |
| `tests/unit/config/game_config_test.gd` | 설정 읽기, 시기 정의, 출시 빌드 강제 |
| `tests/unit/round/round_session_test.gd` | 단서 공개, 배치 판정, 오답 시 정답 공개·소모, 거부 규칙, 클리어/실패 |
| `tests/unit/round/ink_meter_test.gd` | 먹물 규칙 |
| `tests/unit/round/round_builder_test.gd` | 칸당 1장, 같은 시드 같은 순서, 미수집 우선 |
| `tests/unit/progress/progress_data_test.gd` | 도감 수집, 저장 딕셔너리 변환 |
| `tests/integration/cards/card_file_loading_test.gd` | 설정 파일, 픽스처 파일, samguk.json(있을 때) 검증 |
| `tests/integration/save/save_store_test.gd` | user:// 저장/불러오기, 덮어쓰기, 깨진 파일 |

## 5. 확인 체크리스트

- [ ] 에디터를 열었을 때 파서 오류 0개
- [ ] gdUnit4 전체 통과
- [ ] 보드: 행 고구려·백제·신라·가야, 열 건국기·전성기·결말기, **열 머리글 아래 시기 정의가 보인다**
- [ ] 기준 카드 3장(광개토대왕릉비, 황산벌 전투, 박혁거세 신화)이 해당 칸에 "기준: …"으로 보인다
- [ ] 한글이 네모(□)로 깨지지 않는다(시스템 한글 글꼴 사용. 깨지면 기록해 달라)
- [ ] 카드에는 이름이 없고 단서 1단계만 보인다. "단서 더 보기"로 2·3단계가 열리고 3단계 뒤에는 버튼이 꺼진다
- [ ] 카드를 끌어 칸에 놓을 수 있다. 끄는 동안 대상 칸이 노랗게 바뀐다
- [ ] 카드를 눌러(빨간 테두리) 고른 뒤 칸을 눌러도 놓인다
- [ ] 정답: 칸이 초록, 이름 공개, 해설 표시, 먹물 그대로
- [ ] 오답: 고른 칸이 잠깐 붉게, 정답 칸에 "(오답 공개)"로 이름 공개, 먹물 1 감소, 다음 카드로 넘어감
- [ ] 이미 채워진 칸에 놓으면 "이미 카드가 놓인 칸입니다", 먹물 그대로
- [ ] 먹물 5개를 다 쓰면 실패 메시지, "새 라운드"로 재도전
- [ ] 12장을 다 놓으면 클리어 메시지와 요약(정답 수, 단서 사용 수, 남은 먹물)
- [ ] "도감": 맞힌 카드만 이름이 열리고, 누르면 해설·근거·사실 확인 상태가 보인다. 기준 카드와 "견해가 나뉘는 기록"(덩이쇠 수출)은 항상 보인다
- [ ] 게임을 껐다 켜도 도감 수집이 남아 있다(저장: `user://progress.json`. 위치는 에디터의 프로젝트 → 사용자 데이터 폴더 열기)
- [ ] 1280×720에서 글자가 잘리거나 칸이 넘치지 않는다

## 6. 설정 바꾸기

`assets/data/config/game_config.json`:
- `start_ink`: 시작 먹물(기본 5)
- `release_mode`: `true`면 `verified: true && disputed: false` 카드만 로드. 내보낸 출시 빌드(디버그 아님)는 이 값과 무관하게 출시 모드다
- `nations`, `eras`: 보드 행·열과 라벨, 시기 정의
- `save_path`: 저장 경로

## 문제가 생기면

결과를 `docs/decision-log.md` "남은 문제"에 적거나, 오류 메시지 그대로 다음 세션에 전달한다.
