# Godot MVP 2차 정적 검토 (한양 도감)

- 날짜: 2026-11-04
- 대상: `git diff 560d9c5 01ebfd8 -- src tests project.godot assets/data` (37개 파일), 1차 처리 표(`docs/reviews/godot-static-review.md` 끝)
- 기준: `docs/engine-reference/godot/` (breaking-changes, deprecated-apis, current-best-practices, modules/ui·input), `docs/decision-log.md` D11·D12·D16·D17·D22·D23·D29·D30·D31, `.claude/rules/ui-code.md`
- **Godot를 실행하지 않았다.** 코드 읽기, gdtoolkit 4.5.0, `tools/gd_card_validator_port.py`(GDScript 검증기 이식), 테스트 기대값을 손으로 따라가기로 판단했다.

## 요약

| 심각도 | 개수 |
|---|---|
| 높음 | 0 |
| 중간 | 3 |
| 낮음 | 9 |

높음 0개: 에디터를 열거나 테스트를 돌릴 때 확실히 실패하게 만드는 문제는 이번에도 찾지 못했다. 1차의 13개 항목은 모두 고쳐졌거나 근거 있게 처리되었다(아래 표).

가장 중요한 것:
1. **N1** (D31) 웹 빌드는 `assets/data/cards/tutorial.json`을 지금 형태로는 읽지 못한다. 객체 형식이라 웹 `loadCards`가 거부하고, 기준 카드가 파일 밖(본 덱)에 있어 웹의 짝 찾기·검증도 실패한다. `tools/validate_cards.py`와 `tools/build_web.py`도 이 파일을 다루지 않는다.
2. **N2** 튜토리얼 카드는 출시 모드에서도 `verified` 검사 없이 쓰인다(D11 규칙 9 위반).
3. **N3** "이어하기" 뒤에는 그 전에 새로 모은 카드가 결과 화면과 플레이 기록(`round_log.new_ids`)에서 빠진다.
4. **L1** v1 저장을 읽으면 `rounds_played`는 있는데 플레이 기록은 "아직 끝낸 라운드가 없습니다"로 보인다.
5. **L4** 마우스로 카드를 골라도 보드 첫 칸에 키보드 초점(붉은 테두리)이 생겨 그 칸이 고른 칸처럼 보인다.

## 1차 처리 검증

| 1차 항목 | 처리 표 | 검증 결과 | 근거(현재 코드) |
|---|---|---|---|
| M1 빈 칸이 정답을 알려 줌 | 고침 | **확인** | `round_session.gd:90-131`에 채워진 칸 거부가 없고 칸마다 목록(`_placed[key]`)에 쌓는다. `round_builder.gd:15-30`은 칸과 무관하게 미수집 우선으로 뽑는다(D22). `board_cell.gd:94-99`의 `_can_drop_data`에 `_filled` 조건이 없다. 테스트 `test_occupied_cell_still_accepts_and_judges`, `test_same_cell_can_hold_several_cards_in_one_round`, `test_draw_ignores_cells_so_a_cell_can_repeat` |
| M2 라운드 클리어 표시 | 이미 고침 | **확인** | `result_view.gd:41` "라운드 클리어"/"실패", 도감 완성은 `ProgressData.is_complete`(`progress_data.gd:51`)로 따로, `main.gd:238-257`과 `result_view.gd:42-43`에서 표시 |
| M3 gdUnit4 안내 | 고침 | **확인** | `run-locally.md:48` godot-gdunit-labs 6.2.2 이상, `:19` 첫 import 139 재실행 안내 |
| L1 저장 교체 중 끊김 | 고침 | **확인**(아래 "저장 실패 경로" 표) | `save_store.gd:39-68`, `:72-86` |
| L2 드래그 하이라이트 | 고침 | **확인** | `board_cell.gd:41`에서 한 번 만들고 `:96-98`에서 상태가 바뀔 때만 적용 |
| L3 미리보기 테마 | 고침 | **확인** | `card_view.gd:99` `preview.theme = HanjiTheme.current()`, `hanji_theme.gd:97-100` 정적 캐시 |
| L4 검증기 차이 | 고침 | **확인** | `card_validator.gd` 규칙 0~9가 Python 술어와 같다. `python3 tools/gd_card_validator_port.py --parity` 39/39, `python3 tools/validator_parity.py` 39/39, 픽스처가 두 검증기 모두 PASS |
| L5 옆 패널 스크롤 | 고침 | **확인** | `game_screen.gd:77-85`, `tutorial_view.gd:58-65`, `result_view.gd:20-27` |
| L6 체크리스트 | 고침 | **확인** | `run-locally.md:91,103,119` |
| L7 출시 빌드 안내 | 고침 | **확인** | `main.gd:280-295` 규칙 8만 있으면 안내문, `run-locally.md:43` 제외 필터 |
| L8 생성 파일 커밋 | 기록 | **확인**(문서) | `run-locally.md:21`. 아직 저장소에 `*.gd.uid`가 없다(첫 로컬 import 뒤 커밋 필요) |
| L9 gdlint | 고침 | **확인** | `gdlintrc` 추가, `gdlint src tests` → `Success: no problems found` |
| L10 렌더러 | 바꿈 | **확인** | `project.godot`: `gl_compatibility`(+`.mobile`), features "GL Compatibility" |

## 확인한 것(문제 없음)

| 항목 | 결과 |
|---|---|
| 문법 | `gdparse` 35개 파일 통과, `gdlint` 문제 없음 |
| 4.7 재정의 반환형 상속 | 반환형 없는 `func`가 하나도 없다(`grep`으로 확인). `_ready/_init/_gui_input/_notification -> void`, `_can_drop_data -> bool`, `_get_drag_data -> Variant` (breaking-changes.md 4.6→4.7 GDScript 행) |
| 4.5~4.7에서 바뀐 API | 사용 없음. 입력은 `is_action_pressed("ui_accept")`와 이벤트 타입으로 구분하고 `device == 0`을 쓰지 않는다(modules/input.md 4.7) |
| 4.1+ 문법 | `static var _current`(hanji_theme.gd:31), 정적 함수에서의 접근 모두 유효 |
| `:=` 추론 | 새 코드의 모든 `:=` 우변이 정적 타입. Variant 추론 없음 |
| `class_name` | 23개, 중복 없음. 새 클래스(`TutorialData`, `TutorialSession`, `BoardView`, `GameScreen`, `ResultView`, `TitleScreen`, `HelpView`, `TutorialView`)가 엔진·gdUnit4 이름과 겹치지 않는다 |
| JSON 숫자 | 저장 v2(`progress_data.gd:139-170`), 진행 중 라운드(`round_session.gd:204-245`의 `_num`) 모두 float을 int로 받는다. `test_to_dict_from_dict_restores_round_in_progress`가 JSON을 거쳐 확인한다 |
| Font API | `Font.has_char(int)`, `Font.fallbacks: Array[Font]`, `SystemFont.font_names`, `ResourceLoader.exists`가 4.x 형식 |
| 실제 데이터 | `samguk.json` 개발 모드 오류 0(기준 4·판정 36·견해 나뉨 4, 칸당 3장이라 경고 0). 출시 모드는 규칙 8만(의도됨). `tutorial.json`을 `TutorialData.parse`와 같은 방식(본 덱 기준 카드 스텁 + 연습 카드, 라벨 검사 포함, 규칙 8 제외)으로 이식 도구에 넣으면 **오류 0**. 연습 카드 id·제목이 본 덱과 겹치지 않는다 |
| 테스트 | 122개. 새·바뀐 테스트(`round_session` 18, `round_builder` 6, `progress_data` 12, `tutorial` 6, `save_store` 8, `validator_parity` 1, `card_file_loading` 9, `card_validator` 37, `game_config` 8)의 기대값을 코드 경로대로 따라가 맞음을 확인했다. gdUnit4 API(`assert_float().is_equal_approx`, `is_greater`, `is_less_equal`, `assert_object().is_not_null`)는 모두 있는 이름이다. 테스트가 Node를 만들지 않아 고아 노드 101 위험 없음 |
| D22 | 판정 카드 전체에서 미수집 먼저, 모자라면 수집 카드, 전체 재섞기(`round_builder.gd:15-30`). 채워진 칸 거부 없음. "칸마다 1장"을 암시하는 화면 문구 없음(`help_view.gd:21-25`) |
| D16 | 먹물 0이면 실패 우선(`round_session.gd:117-120`), 도감 완성은 판정 카드 전부(`main.gd:238-241`), 라운드 도중 완성이면 메시지 후 계속(`:255-257`) |

### 저장 실패 경로 (`save_store.gd`)

| 끊기거나 실패한 시점 | 디스크 상태 | 다음 읽기 결과 |
|---|---|---|
| 1) tmp 쓰는 도중 | path(이전), tmp(반쪽) | path → 이전 저장. 정상 |
| 1) 쓰기 실패(`store_string` false) | tmp 지움, path 그대로 | 이전 저장. `ERR_FILE_CANT_WRITE` |
| 1)과 2) 사이 | path(이전), tmp(새 완성본) | path → **이전** 저장(새 저장 한 번 잃음, 일관성은 유지) |
| 2) path→bak 실패 | tmp 지움, path 그대로 | 이전 저장 |
| 2)와 3) 사이 | path 없음, tmp(새), bak(이전) | tmp → 새 저장, "복구했다" 안내. 정상 |
| 3) tmp→path 실패 | bak→path로 되돌림, tmp 남음 | path → 이전 저장. 되돌리기도 실패하면 tmp(새) |
| 3)과 4) 사이 | path(새), bak(이전) | path → 새 저장. 다음 저장이 bak을 먼저 지운다 |
| path가 깨짐 | — | tmp → bak 순으로 온전한 것 |

모든 경우에 마지막으로 완성된 저장 하나 이상을 읽는다. 기존 파일 덮어쓰기에 기대지 않는다. 문제 없음.

## 문제 목록

### N1. 공용 튜토리얼 파일(D31)을 웹 빌드와 도구가 읽지 못한다 — 중간, 확실

- 위치: `assets/data/cards/tutorial.json`(형식 `{anchor_id, cards}`), `web/src/data.js:16-17`, `web/src/main.js:591-600`, `web/src/ui/tutorial.js:16-26`, `web/src/config.js:18`, `tools/validate_cards.py`, `tools/build_web.py:32-76`
- 근거:
  1. 웹 `loadCards`는 최상위가 배열이 아니면 거부한다(`data.js:17` "배열이 아님"). 공용 파일은 객체라 튜토리얼이 조용히 사라진다(`main.js:598` catch → null).
  2. 웹 `pickTutorialCards`는 기준 카드가 **같은 파일 안에** 있어야 짝을 찾는다(`tutorial.js:18-23`). 공용 파일의 기준 카드(`goguryeo-peak-anchor`)는 본 덱에 있다.
  3. 웹 `loadTutorial`은 튜토리얼 카드만 `validateCards`에 넣는다(`main.js:594`). 기준 카드가 없으니 R4(참조 대상 없음)로 실패한다. Godot는 기준 카드 스텁을 함께 넣어 이 문제를 피한다(`tutorial_data.gd:48-52`).
  4. `python3 tools/validate_cards.py assets/data/cards/tutorial.json` → `ERROR ... top level must be a JSON array`. D31의 "같은 검증"을 도구가 하지 못한다.
  5. `tools/build_web.py`는 `samguk.json`만 `dist/web/data/`로 복사한다(`:76`). D31은 튜토리얼 파일도 복사하라고 한다.
  6. 웹은 연습 카드의 **제목**이 본 덱과 겹치는지 보지 않는다(id만, `tutorial.js:17`). Godot는 둘 다 본다(`tutorial_data.gd:53-64`).
  - 웹 쪽은 아직 D31을 반영하지 않았다(`web/data/tutorial.json`이 남아 있다). 반영할 때 위 여섯 가지가 함께 바뀌어야 한다.
- 고치는 방법(웹 세션·도구 담당):
  ```js
  // web/src/config.js
  tutorialDataUrl: '../assets/data/cards/tutorial.json',   // build_web.py가 'data/tutorial.json'으로 바꾼다

  // web/src/main.js — loadCards 대신 직접 읽는다
  async function loadTutorial() {
    try {
      const res = await fetch(CONFIG.tutorialDataUrl, { cache: 'no-store' });
      const data = await res.json();
      if (!data || !Array.isArray(data.cards)) throw new Error('{anchor_id, cards} 형식이 아니다');
      const anchor = app.cards.find((c) => c.id === data.anchor_id && c.anchor);
      if (!anchor) throw new Error('anchor_id가 본 덱의 기준 카드가 아니다');
      const deckIds = new Set(app.cards.map((c) => c.id));
      const deckTitles = new Set(app.cards.map((c) => c.title));
      const card = data.cards[0];
      if (deckIds.has(card.id) || deckTitles.has(card.title)) throw new Error('연습 카드가 본 덱과 겹친다');
      const errs = validateCards([anchor, ...data.cards]).errors.filter((e) => e.rule !== 'R8');
      if (errs.length) throw Object.assign(new Error('튜토리얼 카드 오류'), { errs });
      return createTutorial({ anchor, card }, { onFinish: onTutorialFinish });
    } catch (e) { console.warn('[한양 도감] 튜토리얼 없이 진행', e); return null; }
  }
  ```
  ```python
  # tools/validate_cards.py — 최상위가 {anchor_id, cards}이면 튜토리얼 모드
  if isinstance(data, dict) and "cards" in data:
      deck = load(DEFAULT_DECK)                       # samguk.json
      anchor = next((c for c in deck if c["id"] == data["anchor_id"] and c["anchor"]), None)
      # anchor가 없으면 실패. [anchor] + data["cards"]를 검증하되 R8은 건너뛴다.
      # 연습 카드 id·제목이 deck과 겹치면 실패.
  ```
  `tools/build_web.py`: `shutil.copy2(ROOT/"assets/data/cards/tutorial.json", out/"data"/"tutorial.json")`와 `config.js` 경로 치환을 더한다. 웹 샘플 덱(`web/data/sample-cards.json`)에도 `goguryeo-peak-anchor`가 있어 대체 덱에서도 동작한다(확인함).

### N2. 출시 모드에서 확인 전 튜토리얼 카드를 쓴다 — 중간, 확실

- 위치: `src/core/tutorial_data.gd:32-74`, `src/ui/main.gd:159-168`
- 근거: D11 규칙 9는 "출시 빌드는 `verified: true && disputed: false` 카드만 로드"다. 본 덱은 `CardLoader.filter_for_mode`로 거르지만, `TutorialData.parse`는 모드를 모르고 연습 카드를 그대로 쓴다. 지금 연습 카드는 `verified: false`다(`tutorial.json`). 본 덱 카드가 확인되어 출시 빌드가 시작되는 순간, 확인 전 카드가 튜토리얼로 첫 화면에 나온다. 교육용 콘텐츠라 사실 확인 정책(D4) 위반이 곧 품질 문제다.
- 고치는 방법:
  ```gdscript
  # tutorial_data.gd
  static func parse(text: String, main: CardSet, config: GameConfig, release_mode: bool = false) -> TutorialData:
  	...
  	var raw_cards: Variant = data.get("cards")
  	...
  	raw_cards = CardLoader.filter_for_mode(raw_cards, release_mode)
  	if (raw_cards as Array).is_empty():
  		t._fail("출시 모드에서 쓸 수 있는(사실 확인된) 연습 카드가 없다")
  		return t

  # main.gd _load_tutorial
  var t := TutorialData.parse(FileAccess.get_file_as_string(path), _cards, _config, _cards.release_mode)
  ```
  테스트: "release_mode에서 verified: false 연습 카드는 거부" 한 개. 웹도 `onlyVerified`일 때 같은 규칙을 적용한다.

### N3. 이어하기 뒤 새로 모은 카드가 기록에서 빠진다 — 중간, 확실

- 위치: `src/ui/main.gd:213`(`_new_ids = []`), `src/core/round_session.gd:182-198`(`to_dict`에 없음), `src/core/progress_data.gd:66-85`
- 근거: `_new_ids`는 메모리에만 있다. 라운드 도중 게임을 끄거나 타이틀로 나갔다가 "이어하기"를 하면 빈 배열로 다시 시작한다. 라운드가 끝나면 그 전에 모은 카드는 결과 화면의 "새로 모은 카드 n장"과 목록(`result_view.gd:44-59`), `round_log[].new_ids`(D30 플레이 기록)에서 빠진다. 도감 수집 자체(`collected`)는 매 배치 후 저장되므로 잃지 않는다. 플레이테스트 지표를 모으는 단계라(decision-log "남은 문제": 수치 없음) 기록이 틀리면 판단이 틀린다.
- 고치는 방법: 진행 중 라운드에 함께 저장한다.
  ```gdscript
  # main.gd
  func _save_round() -> void:
  	var d := _session.to_dict()
  	d["new_ids"] = _new_ids.duplicate()
  	_progress.current_round = d
  	_save()
  # _start_new_round / _on_more_clues / _on_placement 의 두 줄을 _save_round()로 바꾼다.

  # _continue_round
  var saved_new: Variant = _progress.current_round.get("new_ids")
  _new_ids = (saved_new as Array).duplicate() if saved_new is Array else []
  ```
  `RoundSession.from_dict`는 모르는 키를 무시하므로 하위 호환이 깨지지 않는다. 테스트: 저장 → 되살리기 → 남은 카드 처리 → `round_log[0].new_ids`에 앞의 카드가 있는지.

### L1. v1 저장의 라운드 수와 플레이 기록이 어긋난다 — 낮음, 확실

- 위치: `src/core/progress_data.gd:90-106`, `src/ui/dogam_view.gd`(`format_stats`)
- 근거: `stats()`의 `rounds`는 `round_log.size()`, `cleared`/`failed`는 v1부터 있던 카운터다. v1 파일(`{"collected", "rounds_played": 2, ...}`)을 읽으면 `round_log`가 비어 `format_stats`가 "아직 끝낸 라운드가 없습니다"를 보인다. 같은 사용자의 첫 실행 판정은 `rounds_played`를 본다(`main.gd:69`). 숫자 출처가 둘이다.
- 고치는 방법: `stats()`의 `"rounds"`를 `rounds_played`로 하고, 정답률·평균 단서는 `round_log`가 있을 때만 계산한다(문구: "정답률은 기록이 있는 라운드 n개 기준"). 또는 v1에서 읽을 때 문구를 "이전 버전 기록 n라운드(세부 없음)"로 따로 보인다.

### L2. 저장 파일의 version을 보지 않는다 — 낮음, 확실

- 위치: `src/core/progress_data.gd:132-171`
- 근거: v3 이상(앞으로의 형식)을 v2 코드가 읽으면 아는 필드만 읽고, 다음 저장 때 모르는 필드를 지운 v2로 덮어쓴다. 지금은 v1·v2뿐이라 영향 없음.
- 고치는 방법: `version > SAVE_VERSION`이면 읽기만 하고 저장하지 않도록 `SaveStore`에 알리거나(`read_only` 표시), 원본을 `progress.v<N>.json`으로 복사해 둔다.

### L3. 시스템 글꼴 판정이 "한글 없음"으로 잘못 나올 수 있다 — 낮음, 가능성

- 위치: `src/ui/hanji_theme.gd:49-65`
- 근거: `SystemFont`는 `font_names` 중 처음 찾은 글꼴 하나를 쓴다. 목록의 한글 글꼴이 하나도 없고 마지막 `"sans-serif"`가 라틴 글꼴(예: DejaVu Sans)로 풀리면 `has_char(0xD55C)`가 false다. 하지만 실제 그리기는 OS 대체 글꼴(`allow_system_fallback`, 기본 켜짐)로 한글이 보일 수 있다. 그러면 화면은 멀쩡한데 "한글 글꼴을 찾지 못함" 안내가 뜬다. 반대로 대체도 없으면 안내가 맞다. 엔진 동작은 engine-reference에 없어 확인하지 못했다.
- 고치는 방법: 안내 문구를 "목록의 한글 글꼴을 찾지 못함(글자가 네모로 보이면 …)"으로 바꾸거나, `"sans-serif"`를 목록에서 빼고 판정한 뒤 테마에는 넣는다. 로컬 체크리스트에 "한글 글꼴이 없는 리눅스에서 안내와 실제 표시가 맞는가"를 넣는다.

### L4. 마우스로 카드를 골라도 첫 칸에 초점 테두리가 생긴다 — 낮음, 가능성

- 위치: `src/ui/game_screen.gd:159-164`, `src/ui/board_cell.gd:131-135`
- 근거: 카드 선택(`selection_changed(true)`)이 오면 입력 방법과 상관없이 고구려·건국기 칸에 `grab_focus()`를 한다. 칸은 초점이 있으면 붉은 3px 테두리로 그려진다. 마우스 사용자는 이 칸이 "고른 칸"처럼 보인다. 4.6부터 마우스와 키보드 초점이 분리되었고 `grab_focus()`는 키보드 초점이다(modules/ui.md 4.6 "Dual-focus"). 마우스 클릭으로 생긴 키보드 초점이 어떻게 그려지는지는 확인하지 못했다.
- 고치는 방법: 키보드로 고른 경우에만 초점을 옮긴다.
  ```gdscript
  # card_view.gd
  signal selection_changed(is_selected: bool, by_keyboard: bool)
  ...
  selection_changed.emit(selected, mb == null)
  # game_screen.gd
  func _on_selection_changed(is_selected: bool, by_keyboard: bool) -> void:
  	if is_selected and by_keyboard: ...
  ```

### L5. 키보드·게임패드 흐름에 빈 곳이 있다 — 낮음, 확실

- 위치: `src/ui/tutorial_view.gd:77-79`, `src/ui/result_view.gd:13-33`, `src/ui/dogam_view.gd`, `src/ui/help_view.gd:9-39`
- 근거: `.claude/rules/ui-code.md`는 "모든 상호작용에 키보드·마우스와 게임패드"를 요구한다.
  - 튜토리얼은 `CardView.selection_changed`를 연결하지 않아 Enter로 카드를 골라도 초점이 보드로 가지 않는다(본게임과 다름).
  - 결과·도감·하는 방법 화면은 열릴 때 기본 초점을 주지 않는다. 키보드 사용자는 Tab부터 눌러야 한다(타이틀만 `focus_default()`).
  - 놓은 뒤 초점이 보드 칸에 남아, 다음 카드를 고르려면 카드로 직접 옮겨야 한다.
  - 게임패드는 `ui_accept`·방향 입력에 기대지만 확인하지 못했다(D30).
- 고치는 방법: 튜토리얼에 본게임과 같은 `_on_selection_changed`를 연결한다. 각 화면에 `focus_default()`(첫 버튼 `grab_focus`)를 두고 `main._show_only` 뒤에 부른다. 배치 뒤에는 `_card_view.grab_focus()`로 카드에 초점을 돌려준다.

### L6. 한 칸에 여러 장이 쌓이면 보드가 화면 밖으로 넘칠 수 있다 — 낮음, 가능성

- 위치: `src/ui/board_cell.gd:75-79`, `src/ui/game_screen.gd:67-74`
- 근거: D22로 한 칸에 라운드당 최대 3장(칸당 판정 카드 수)이 쌓인다. 오답 줄 "제목 (오답 공개)"은 176px 칸에서 두 줄로 접힐 수 있다. 기준 카드 줄까지 더하면 칸 높이가 약 170px이 된다. 그런 행이 둘이면 보드 높이가 720을 조금 넘는다. 보드는 스크롤 영역 밖에 있다. 확률은 낮지만 1280×720 기준 해상도에서 생길 수 있다.
- 고치는 방법: 칸에 최근 2장만 보이고 나머지는 "외 n장"으로 줄이거나, `_board`를 세로 `ScrollContainer`로 감싼다. 체크리스트에 "한 칸에 3장, 그중 오답 2장"을 넣어 1280×720 스크린샷으로 확인한다.

### L7. 기본 경고 두 개(오류 아님) — 낮음, 확실

- 위치: `src/ui/result_view.gd:76` `func _heading(text: String, size: int)`(Control의 `size` 속성을 가림), `src/core/card_validator.gd:162` `var exp: Variant`(전역 함수 `exp()`를 가림)
- 근거: GDScript의 `SHADOWED_VARIABLE_BASE_CLASS`, `SHADOWED_GLOBAL_IDENTIFIER` 경고는 기본값이 "경고"다. 실행에는 영향이 없지만 첫 import 출력에 노란 줄로 나와 실제 오류를 찾을 때 방해된다.
- 고치는 방법: `size` → `font_size`, `exp` → `explanation`.

### L8. "시작하기"가 진행 중 라운드를 묻지 않고 버린다 — 낮음, 확실

- 위치: `src/ui/main.gd:192-198`, `src/ui/title_screen.gd:38`
- 근거: 이어하기가 켜져 있을 때 "시작하기"를 누르면 `current_round`를 새 라운드로 덮어쓴다. D12("라운드 도중 새 라운드는 기록하지 않는다")와 맞는 동작이지만 확인 없이 진행이 사라진다. 웹은 초기화에 두 번 확인을 둔다(D24).
- 고치는 방법: `has_current_round()`이면 "진행 중인 라운드를 버리고 새로 시작할까요?" `ConfirmationDialog`를 띄운다. 또는 타이틀 기본 초점이 이미 "이어하기"이므로 문서에 동작을 적고 둔다.

### L9. 되살린 라운드의 값끼리 맞는지 보지 않는다 — 낮음, 확실

- 위치: `src/core/round_session.gd:203-246`
- 근거: `from_dict`는 각 값의 타입과 범위만 본다. `correct + wrong == index`, `history.size() == index`, `placed`의 카드가 `card_ids[0..index)`와 같은지는 보지 않는다. 저장 파일을 손으로 고쳤거나 다른 버전이 쓴 경우 결과 화면 숫자(정답 수, 단서 분포)가 보드와 다를 수 있다. 정상 경로에서는 생기지 않는다.
- 고치는 방법: 맞지 않으면 `null`을 돌려 새 라운드로 시작한다(이미 있는 "버리고 새로" 경로).
  ```gdscript
  if s.correct_count + s.wrong_count != index or s.history.size() != index:
  	return null
  ```

## 실행한 도구

```bash
gdparse $(git ls-files 'src/*.gd' 'tests/*.gd')        # 35개 통과
gdlint src tests                                        # Success: no problems found
python3 tools/validate_cards.py                         # samguk.json PASS
python3 tools/validate_cards.py tests/fixtures/cards_fixture.json   # PASS (경고 12: 칸당 1장)
python3 tools/validate_cards.py assets/data/cards/tutorial.json     # ERROR: 최상위가 배열이 아님 (N1)
python3 tools/gd_card_validator_port.py --parity        # 39/39
python3 tools/validator_parity.py                       # 39/39
python3 tools/gd_card_validator_port.py assets/data/cards/samguk.json      # 0 errors; anchors 4, playable 36, disputed 4
python3 tools/gd_card_validator_port.py tests/fixtures/cards_fixture.json  # 0 errors; anchors 3, playable 12, disputed 1
# tutorial.json: 이식 도구의 validate()에 [본 덱 기준 카드 스텁] + cards, 라벨 포함 → 규칙 8 외 오류 0
```

## 로컬 첫 실행 때 특히 볼 것(1차 목록에 더해)

1. 첫 실행에 튜토리얼이 자동으로 열리고, 건너뛰기·완료 뒤 다시 열리지 않는지(`tutorial_done`)
2. 라운드 도중 종료 → 재실행 → "이어하기"로 보드·먹물·단서 단계가 그대로인지, 끝난 뒤 결과 화면의 "새로 모은 카드"(N3)
3. v1 형식 `progress.json`(`{"version":1,"collected":[...],"rounds_played":2}`)을 넣고 실행했을 때 타이틀·도감 플레이 기록(L1)
4. 마우스로 카드를 누른 뒤 고구려·건국기 칸에 붉은 테두리가 생기는지(L4)
5. 한 칸에 3장이 쌓인 1280×720 화면(L6)

## 처리 결과 (Godot MVP 세션, 2026-11-04)

Godot는 실행하지 않았다. gdparse·gdlint 통과, 튜토리얼과 검증기는 `tools/gd_card_validator_port.py`로 대조했다. 결정 기록 D35(콘텐츠 세션의 D34와 겹치지 않게).

| 항목 | 처리 | 내용 |
|---|---|---|
| N1 공용 튜토리얼 파일 | 확인(Godot 영향 없음) | 형식(`{anchor_id, cards}`)은 그대로라 `TutorialData.parse`가 그대로 읽는다. 튜토리얼 파일(병합 후 연습 카드 [엄리대수 건너기], 콘텐츠 D34)을 이식 도구로 검사: 개발 모드 오류 0, 본 덱과 id·제목 겹침 없음. 추가로 Python T2(anchor는 disputed 아님)·T5(relation은 본 덱의 아무 기준 카드)에 맞췄다 |
| N2 출시 모드의 확인 전 연습 카드 | 고침 | `parse(..., release_mode)`가 `filter_for_mode`를 적용, 남는 카드가 없으면 튜토리얼 건너뜀 + 안내. 지금 파일은 출시 모드에서 0장(의도대로 건너뜀). 테스트 2개. 참고: Python `--tutorial --release`는 verified를 보지 않아 PASS(도구 쪽 차이) |
| N3 이어하기 뒤 new_ids | 고침 | `RoundSession.new_ids`로 옮겨 `to_dict`·`summary`에 포함. 테스트: 저장 → 되살리기 → 남은 카드 → `round_log[0].new_ids`에 앞 카드 |
| L1 v1 라운드 수와 기록 | 고침 | 라운드 수는 `rounds_played`, 정답률·단서는 기록 있는 라운드만, v1은 "세부 없음" 문구. 테스트 2개 |
| L2 저장 version | 고침 | 새 형식이면 `progress.v<N>.json`에 보관하고 새로 시작. 통합 테스트 1개 |
| L3 글꼴 판정 오탐 | 고침 | 한글 목록만으로 판정, "sans-serif"는 테마에만. 안내 문구를 완화. 실제 표시는 체크리스트 |
| L4 마우스 선택 시 초점 테두리 | 고침 | `selection_changed(is_selected, by_keyboard)`. 마우스로 누르면 초점을 놓는다. 고름/초점 모양 분리 |
| L5 키보드 흐름 | 고침 | 모든 화면 `focus_default()`, 튜토리얼에 선택 → 첫 칸 초점 연결, 키보드로 놓은 뒤 카드로 초점. 게임패드는 미확인 |
| L6 칸 넘침 | 고침 | 최근 2줄 + "외 n장", 전체는 툴팁. `BoardCell.visible_text` 단위 테스트 3개. 1280×720 확인은 체크리스트 |
| L7 기본 경고 | 고침 | `size` → `font_size`, `exp` → `explanation_text` |
| L8 시작하기 확인 | 고침 | 진행 중 라운드가 있으면 `ConfirmationDialog` |
| L9 되살린 라운드 정합성 | 고침 | 개수·먹물·순서·보드 위치 검사, 틀리면 새 라운드. 테스트 4개 |
| 지시 5 하드코딩 | 확인 | 튜토리얼 통합 테스트는 파일에서 id·anchor를 읽는다. 단위 테스트는 공장 데이터(`Fx`)만 쓴다. 체크리스트의 카드 이름은 "지금은"으로 표시 |
