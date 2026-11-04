# Godot MVP 정적 검토 (한양 도감)

- 날짜: 2026-11-04
- 대상: `src/` 전부, `tests/` 전부, `project.godot`, `assets/data/config/game_config.json`, `assets/data/cards/samguk.json`, `tests/fixtures/cards_fixture.json`, `docs/run-locally.md`
- 기준: `docs/engine-reference/godot/` (breaking-changes, deprecated-apis, current-best-practices, modules/ui·input), `design/game-brief.md`, `design/card-data-schema.md`, `docs/decision-log.md` D9~D13·D16
- **Godot를 실행하지 않았다.** 아래 판단은 코드 읽기, gdtoolkit 4.5.0(`gdparse`, `gdlint`), GDScript 검증기를 파이썬으로 옮긴 도구의 결과다. 실제 파서·런타임 결과는 로컬 첫 실행에서 확인해야 한다.

## 요약

| 심각도 | 개수 |
|---|---|
| 높음 | 0 |
| 중간 | 3 |
| 낮음 | 10 |

**높음 0개의 뜻**: 에디터를 열거나 테스트를 돌릴 때 확실히 실패하게 만드는 문제는 찾지 못했다. 파싱, API 이름, 시그니처, 타입 추론, 데이터 검증을 아래 "확인한 것"처럼 하나씩 대조했다. 실행해 보지 않았으므로 "실패하지 않는다"는 증명은 아니다.

가장 중요한 것:
1. **M1** 채워진 칸을 거부해서 남은 빈 칸이 곧 남은 카드의 정답 칸이 된다. 라운드의 마지막 카드는 항상 정답이다(설계 판단 필요).
2. **M2** 라운드 클리어를 "[도감 완성]"으로 표시한다. D16의 도감 완성(36장 수집)은 판정하지도 표시하지도 않는다.
3. **M3** `docs/run-locally.md`의 gdUnit4 설치 안내가 옛 저장소 주소이고 "4.7 호환 버전 미확인"이라고 적혀 있다. engine-reference에는 확인된 버전(6.2.x, 6.2.2)이 있다. 오래된 gdUnit4를 받으면 첫 테스트가 실패할 수 있다.
4. **L1** 저장할 때 기존 파일을 지운 뒤 이름을 바꾸는 사이에 끊기면 진행이 사라진다(주석의 의도와 반대).
5. **L4** GDScript 검증기가 `tools/validate_cards.py`보다 느슨하다. 픽스처 파일은 파이썬 검증기에서 FAIL이다.

## 확인한 것(문제 없음)

| 항목 | 결과 | 근거 |
|---|---|---|
| 문법 | `gdparse` 23개 파일 전부 통과. `gdlint`는 스타일 27건(줄 길이, 공개 메서드 수)뿐 | gdtoolkit 4.5.0 |
| 4.7 GDScript 변경(재정의 함수의 반환형 상속) | 반환형 없는 재정의 없음. `_ready`·`_init`·`_gui_input`·`_notification`·`before_test` 등 전부 `-> void`, `_can_drop_data -> bool`, `_get_drag_data -> Variant`가 모든 경로에서 `return` | breaking-changes.md "4.6 → 4.7" GDScript 행 |
| 4.7에서 바뀌거나 없어진 API | `RichTextLabel.add_image`, `UPDATE_WIDTH_IN_PERCENT`, `tap_back_pos`, `InputEvent.device == 0`, `is_class` 사용 없음 | breaking-changes.md, deprecated-apis.md |
| 4.4 `FileAccess.store_*` 반환형 | `save_store.gd:24`가 `store_string`의 `bool`을 받아 검사한다. 맞다 | breaking-changes.md "4.3 → 4.4" Core 행 |
| 4.x에서 없어진 API | `yield`, 문자열 `connect`, `instance()`, `OS.get_ticks_msec` 없음. 시그널은 전부 `signal.connect(callable)` | deprecated-apis.md |
| `:=` 추론 | 모든 `:=` 우변이 정적 타입(String/bool/Dictionary/Array[T]/클래스)이다. Variant로 추론되는 곳 없음. `const Fx = preload(...)`의 정적 함수 반환형은 analyzer가 안다 | 직접 대조(`grep ':='`) |
| `class_name` 충돌 | 14개 전부 한 번씩. 엔진·gdUnit4(`GdUnit*`) 클래스와 겹치지 않음. 순환 `preload` 없음(테스트만 픽스처를 preload) | `grep '^class_name'` |
| `res://` 경로 | `project.godot`의 main_scene, 설정의 카드·픽스처 경로, 테스트 preload 경로 모두 실제 파일 있음 | 경로 존재 검사 |
| 드래그 앤 드롭 시그니처 | `_get_drag_data(at_position: Vector2) -> Variant`, `_can_drop_data(at_position, data) -> bool`, `_drop_data(at_position, data) -> void`, `set_drag_preview`, `NOTIFICATION_DRAG_END` 모두 4.x 형식 | Control API |
| JSON 숫자 | Godot 4 JSON은 숫자를 float로 돌려준다. `difficulty`, `level`, `start_ink`, 저장 카운트 모두 int/float 둘 다 받는다(`_is_int_like`, `int()` 변환) | `card_validator.gd:244`, `card_data.gd:57,74`, `game_config.gd:30`, `progress_data.gd:66` |
| `user://` 저장 | `FileAccess.open` 실패 시 `get_open_error`, `DirAccess.*_absolute`로 user:// 경로 처리 | `save_store.gd` |
| 코드로 만든 Control의 앵커 | `set_anchors_preset(PRESET_FULL_RECT)`를 `add_child` 전에 불러 offset이 0으로 남는다(트리 밖에서는 부모 rect가 0) | `main.gd:27,64,168` |
| `project.godot` | `config_version=5`, `run/main_scene="res://src/main.tscn"`, `config/features=PackedStringArray("4.7", "Forward Plus")`, stretch `canvas_items`/`expand`(4.7 새 프로젝트 기본값과 같음) | breaking-changes.md Project 행, modules/ui.md 4.7 |
| `main.tscn` | `[gd_scene format=3]`, 루트 Control 전체 앵커, 스크립트 ext_resource. `load_steps`·`uid` 없어도 로드된다 | — |
| gdUnit4 형식 | 전부 `extends GdUnitTestSuite`, `test_` 접두사, 훅 `before_test`/`after_test`, `assert_bool/int/str/array/dict/object` 와 `is_equal/is_true/is_false/is_null/is_empty/is_not_empty/contains` 사용. 파일 이름 `[system]_[feature]_test.gd`(`.claude/rules/test-standards.md`) | — |
| 테스트 노드 누수 | 테스트가 Node를 만들지 않는다. 고아 노드 종료 코드 101 위험 없음 | current-best-practices.md "Command Line" |
| 테스트 기대값 손 계산 | `round_session_test` 14개, `round_builder_test` 4개, `card_loader_test` 14개, `card_validator_test` 24개, 나머지 단위 14개, 통합 9개(총 79개)의 기대값을 코드 경로대로 따라가 맞음을 확인했다 | — |
| 실제 데이터 | `tools/gd_card_validator_port.py`(GDScript 검증기 이식)로: `samguk.json` 개발 모드 **오류 0**, 기준 4·판정 36·견해 나뉨 4. 픽스처 개발 모드 오류 0, 기준 3·판정 12·견해 나뉨 1(통합 테스트 기대값과 같음). 출시 모드는 둘 다 규칙 8 오류 12개(전부 `verified: false`, D11의 의도된 동작) | 아래 "실행한 도구" |
| D16 규칙 | 칸마다 1장·총 12장, 미수집 우선(`round_builder.gd:16-22`), 기준 카드가 칸을 막지 않음(D9), 먹물 0이면 실패가 클리어보다 우선(`round_session.gd:111-114`), 수집은 정답만·라운드 넘어 유지·매 배치 후 저장(D12) | — |

## 문제 목록

### M1. 채워진 칸 거부가 정답을 알려 준다 — 중간, 확실(동작) / 설계 판단 필요

- 위치: `src/core/round_session.gd:96-98`, `src/ui/board_cell.gd:84`(`_can_drop_data`의 `not _filled`), `src/ui/main.gd:217-218`
- 근거: 라운드는 칸마다 정확히 1장이다(D16). 오답이어도 카드는 정답 칸에 놓인다(`round_session.gd:102`). 그래서 언제나 **비어 있는 칸 = 남은 카드들의 정답 칸**이다. 채워진 칸은 먹물 소모 없이 거부되고 드래그 하이라이트도 뜨지 않는다.
  - 12번째 카드는 빈 칸이 하나뿐이라 항상 정답이다. 11번째는 2지선다다.
  - 브리프의 "관계로 칸을 좁히는 추리"가 아니라 소거로 풀린다. 플레이 로그(정답률·단서 사용)가 부풀려진다.
- 고치는 방법(총괄 판단 필요. D16의 "한 칸에 카드가 여러 장 쌓일 수 있다"와 맞추는 쪽):
  ```gdscript
  # round_session.gd — 채워진 칸도 받는다. 판정은 정답 칸만 본다.
  # var _placed: Dictionary  # cell_key -> Array[Dictionary]
  func place_current(nation: String, era: String) -> Dictionary:
  	...
  	if not _nation_ids.has(nation) or not _era_ids.has(era):
  		result["reason"] = REJECT_INVALID_CELL
  		return result
  	# REJECT_OCCUPIED 검사 삭제
  	var correct := card.matches(nation, era)
  	var key := card.cell_key()
  	if not _placed.has(key):
  		_placed[key] = []
  	(_placed[key] as Array).append({"card_id": card.id, "correct": correct})
  ```
  `board_cell.gd`의 `_can_drop_data`에서 `not _filled` 조건을 빼고, `show_placed`는 제목을 덧붙이게 한다. 테스트 `test_occupied_cell_is_rejected_without_ink_loss`는 "채워진 칸에 놓아도 판정한다"로 바꾼다. 다만 이렇게 해도 "칸마다 1장"을 플레이어가 알게 되면 같은 소거가 가능하다. 근본적으로는 라운드 구성(D16)을 바꾸거나(예: 12장을 칸과 무관하게 뽑기), 이 성질을 알려진 한계로 decision-log에 적어야 한다.

### M2. 라운드 클리어를 "도감 완성"이라고 부르고, 진짜 도감 완성은 없다 — 중간, 확실

- 위치: `src/ui/main.gd:239`
- 근거: D16은 **라운드 클리어**(먹물이 남은 채 12장 처리)와 **도감 완성(게임 클리어)**(판정 카드 36장 전부 수집)를 나눈다. 코드는 라운드 클리어에 `[도감 완성]`을 붙이고, 36장 수집을 판정하는 곳이 없다(도감 화면의 `n / 36` 숫자만 있다).
- 고치는 방법:
  ```gdscript
  # main.gd _on_cell_target 끝부분
  var tag := "[라운드 클리어]" if cleared else "[실패]"
  _message_label.text += "\n\n%s %s" % [tag, summary]
  if _is_dogam_complete():
  	_message_label.text += "\n\n[도감 완성] 삼국시대 카드를 모두 모았습니다!"

  func _is_dogam_complete() -> bool:
  	for c: CardData in _cards.playable:
  		if not _progress.is_collected(c.id):
  			return false
  	return true
  ```
  판정 함수는 `ProgressData`나 `CardSet` 쪽 정적 함수로 두고 단위 테스트를 붙이는 편이 규칙(D13: 규칙은 `src/core/`)에 맞다.

### M3. 로컬 실행 안내의 gdUnit4 정보가 낡았다 — 중간, 확실(문서) / 가능성(영향)

- 위치: `docs/run-locally.md` 4절 "설치" 1번, 2절
- 근거: 안내는 `https://github.com/MikeSchulze/gdUnit4/releases`를 가리키고 "4.7 호환 버전은 이 세션에서 확인하지 못했다"고 적는다. `docs/engine-reference/godot/current-best-practices.md` "Command Line — Tests and Parse Check"에는 이미 확인된 정보가 있다: 저장소 `godot-gdunit-labs/gdUnit4`, **6.2.x가 Godot 4.5~4.7.1 호환**, **6.2.2가 4.7.2에서 동작**(2026-10-17 확인). 같은 문서에 "4.7.1·4.7.2에서 새 프로젝트의 첫 `--import`가 17번 중 3번 종료 시 크래시(139), 다시 실행하면 0"이라는 관찰도 있다. 안내에 없으면 사용자는 첫 단계에서 실패로 오해할 수 있다.
- 고치는 방법(문서):
  ```markdown
  1. https://github.com/godot-gdunit-labs/gdUnit4/releases 에서 **6.2.2 이상**(Godot 4.7.x 대상)을 받는다.
  ...
  ## 2. 처음 한 번: 가져오기(import)
  godot --headless --path . --import
  # 4.7.1·4.7.2에서 첫 import가 종료 코드 139(크래시)로 끝날 수 있다. 다시 실행하면 0으로 끝난다.
  ```

### L1. 저장 교체 중 끊기면 진행이 사라진다 — 낮음, 확실

- 위치: `src/core/save_store.gd:29-31`, `:38-41`
- 근거: 주석은 "쓰다 끊겨도 기존 저장이 깨지지 않게"인데, 기존 파일을 먼저 지우고(`remove_absolute`) 그다음 이름을 바꾼다. 그 사이에 끊기면 `progress.json`은 없고 `.tmp`만 남는다. `load_progress`는 `.tmp`를 보지 않으므로 빈 진행으로 시작한다. Unix의 rename은 대상 파일을 원자적으로 바꾸므로 먼저 지울 필요가 없다.
- 고치는 방법:
  ```gdscript
  func load_progress() -> ProgressData:
  	last_error = ""
  	var tmp_path := path + ".tmp"
  	if not FileAccess.file_exists(path) and FileAccess.file_exists(tmp_path):
  		DirAccess.rename_absolute(tmp_path, path)  # 교체 도중 끊긴 저장 복구
  	...
  ```
  Windows에서 `rename_absolute`가 기존 파일 위로 덮어쓰는지는 확인하지 못했다(Godot 구현을 읽지 않았다). 그래서 `save()`의 먼저 지우기는 두고 위 복구만 더하는 것이 안전하다.

### L2. 드래그 하이라이트가 남을 수 있고, 마우스가 움직일 때마다 StyleBox를 만든다 — 낮음, 가능성

- 위치: `src/ui/board_cell.gd:83-87`
- 근거: `_can_drop_data`는 드래그 중 마우스가 움직일 때마다 불리고 매번 `StyleBoxFlat`을 새로 만든다. 하이라이트를 되돌리는 것은 `mouse_exited`와 `NOTIFICATION_DRAG_END`다. 드래그 중에 `mouse_exited`가 오지 않으면 지나간 칸들이 놓을 때까지 노랗게 남는다(4.x 드래그 중 enter/exit 동작은 engine-reference에 없어 확인하지 못했다).
- 고치는 방법: 하이라이트 스타일을 한 번만 만들어 두고, 상태가 바뀔 때만 적용한다.
  ```gdscript
  var _hover_style := HanjiTheme.box(HanjiTheme.HOVER, HanjiTheme.ACCENT, 2)
  var _hovering := false

  func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
  	var ok: bool = not _filled and data is Dictionary and str(data.get("kind", "")) == CardView.DRAG_KIND
  	if ok and not _hovering:
  		_hovering = true
  		add_theme_stylebox_override("panel", _hover_style)
  	return ok

  func _restore_style() -> void:
  	_hovering = false
  	if _base_style != null:
  		add_theme_stylebox_override("panel", _base_style)
  ```
  로컬 실행 체크리스트에 "카드를 칸 여러 개 위로 지나가게 끌었을 때 지나간 칸이 원래 색으로 돌아오는가"를 넣는다.

### L3. 드래그 미리보기는 게임 테마(한글 글꼴)를 물려받지 않는다 — 낮음, 가능성

- 위치: `src/ui/card_view.gd:91-101`, `src/ui/main.gd:24`
- 근거: 테마는 `Main` 노드에만 붙는다(`theme = HanjiTheme.build()`). `set_drag_preview`의 미리보기는 `Main` 아래가 아니라 뷰포트의 드래그 레이어에 붙어 엔진 기본 테마를 쓴다. "? 사건 카드"의 한글은 엔진 기본 글꼴의 시스템 대체 글꼴에 기댄다. 대체 글꼴이 없는 환경이면 네모(□)로 보인다.
- 고치는 방법: 미리보기에 테마를 직접 준다(또는 프로젝트 설정 `gui/theme/custom`에 테마 리소스를 지정).
  ```gdscript
  var preview := PanelContainer.new()
  preview.theme = HanjiTheme.build()
  ```
  `HanjiTheme.build()`를 매번 부르지 않도록 정적 캐시를 두면 더 좋다.

### L4. GDScript 검증기가 파이썬 검증기보다 느슨하다 — 낮음, 확실

- 위치: `src/core/card_validator.gd:143-160`(규칙 4), `:180-182`(규칙 6), `tools/validate_cards.py` 머리 주석
- 근거: 두 검증기의 규칙이 다르다. 파이썬에만 있는 검사:
  - 비-relation 단서의 `refs`는 `[]`여야 한다(스키마 규칙 4는 "refs가 실제 id를 가리킨다"를 모든 단서에 건다. GDScript는 relation 단서만 본다)
  - 참조 대상이 disputed가 아니어야 한다(D7), disputed 카드는 기준 카드일 수 없다
  - D7 추가 검사(1단계 단서에 나라 이름·시기 라벨 금지, 해설에 시기 라벨 필수, relation 본문에 `[참조 제목]`)
  - 결과: `tests/fixtures/cards_fixture.json`은 GDScript 검증기에서 통과, `python3 tools/validate_cards.py tests/fixtures/cards_fixture.json`은 **FAIL**(`fx-gaya-peak-disputed`의 해설에 '전성기' 없음).
  - 기준 카드가 `disputed: true`면 `CardSet.add`가 기준 카드로 분류해 보드에 올린다(`card_set.gd:30-33`). 지금 데이터에는 없다.
- 고치는 방법: 최소한 런타임에 의미가 있는 두 가지를 GDScript에도 넣는다.
  ```gdscript
  # _check_disputed
  if _is_true(card.get("disputed")) and _is_true(card.get("anchor")):
  	errors.append(_err(RULE_DISPUTED_NOTE, cid, "기준 카드는 disputed일 수 없다"))
  # _check_relation_refs: 대상이 disputed면 오류
  if _is_true(target.get("disputed")):
  	errors.append(_err(RULE_RELATION_REFS, cid, "refs가 disputed 카드를 가리킨다: %s" % ref))
  ```
  픽스처의 `fx-gaya-peak-disputed` 해설에 "전성기"를 넣어 두 검증기를 모두 통과하게 한다. 두 검증기 중 무엇이 기준인지 `card-data-schema.md`에 한 줄 적는다.

### L5. 옆 패널에 스크롤이 없다 — 낮음, 가능성

- 위치: `src/ui/main.gd:107-117`
- 근거: 카드(단서 3개)와 메시지(해설 + 요약)가 세로로 쌓이고 스크롤이 없다. 현재 데이터의 최대 길이(단서 63자, 해설 80자)로 어림하면 약 500px로 720 안에 들어간다. 해설이 길어지면 화면 밖으로 넘친다.
- 고치는 방법: `side_panel`을 `ScrollContainer`(가로 스크롤 끔, 세로 EXPAND_FILL)로 감싼다. 1280×720 스크린샷으로 확인한다.

### L6. 로컬 체크리스트의 기준 카드 수가 데이터와 다르다 — 낮음, 확실

- 위치: `docs/run-locally.md` 5절 "기준 카드 3장(광개토대왕릉비, 황산벌 전투, 박혁거세 신화)"
- 근거: `samguk.json`이 있으므로 개발 모드는 픽스처가 아니라 `samguk.json`을 읽는다. 기준 카드는 4장이다(가야 건국기 "수로왕 탄생 신화", D6). 판정 카드 36장, 견해가 나뉘는 기록 4장(덩이쇠 수출 외 3장)이 도감에 보인다.
- 고치는 방법: 체크리스트를 "기준 카드 4장(… 수로왕 탄생 신화 포함)", "견해가 나뉘는 기록 4장", "도감 0 / 36"으로 고친다.

### L7. 내보낸 출시 빌드는 지금 오류 화면만 보인다, 내보내기 필터 없음 — 낮음, 확실

- 위치: `src/core/game_config.gd:72-73`, `src/ui/main.gd:35-43`
- 근거: 디버그가 아닌 빌드는 무조건 출시 모드(D11)이고, 카드 44장이 전부 `verified: false`라 규칙 8 오류 12개로 시작하지 않는다. D11의 의도된 동작이지만, 사용자가 "내보내기 → 실행"을 해 보면 고장으로 보인다. 또 내보내기 프리셋이 없어 `tests/`(gdUnit4 없이 로드 불가한 스크립트)와 `addons/gdUnit4/`가 함께 묶일 수 있다.
- 고치는 방법: `run-locally.md`에 "출시 내보내기는 사실 확인이 끝나기 전에는 오류 화면이 정상"을 적는다. 프리셋을 만들 때 제외 필터 `tests/*, addons/gdUnit4/*, prototypes/*`를 넣는다.

### L8. 첫 실행 후 생기는 파일을 커밋할지 정해야 한다 — 낮음, 확실

- 근거: Godot 4.4부터 스크립트마다 `*.gd.uid` 파일이 생긴다(UID 참조용, 커밋 대상). `.gitignore`는 `.godot/global_script_class_cache.cfg`를 일부러 추적하도록 예외를 두었지만 저장소에 이 파일이 없다. 둘 다 없으면 새로 받은 클론은 매번 `--import`부터 해야 한다(`run-locally.md` 2절이 이미 안내함).
- 고치는 방법: 로컬 첫 import 뒤 `git status`에 나오는 `*.gd.uid`와 `global_script_class_cache.cfg`를 커밋한다.

### L9. gdlint 스타일 27건 — 낮음, 확실

- 근거: `gdlint src tests` → 줄 길이 100 초과 26건, `card_validator_test.gd` 공개 메서드 20개 초과 1건. 실행에는 영향 없다. 프로젝트 코딩 표준에 줄 길이 규칙은 없다.
- 고치는 방법: 무시하거나 `gdlintrc`에 `max-line-length: 120`을 둔다.

### L10. 2D 카드 게임에 Forward+ 렌더러 — 낮음, 확실(설정) / 권장

- 위치: `project.godot` `[rendering] renderer/rendering_method="forward_plus"`, `config/features`
- 근거: UI만 그리는 게임에 Forward+는 무겁고, 오래된 GPU·노트북 내장 그래픽에서 시작이 실패할 수 있다. Compatibility가 웹 내보내기와도 맞는다. `project.yaml`도 `rendering: "Forward+"`라 의도된 선택일 수 있다.
- 고치는 방법(선택): `renderer/rendering_method="gl_compatibility"`, `config/features=PackedStringArray("4.7", "GL Compatibility")`. 바꾸면 `project.yaml`도 함께 고친다.

## 테스트가 다루지 않는 것(참고)

- UI(`src/ui/`) 전부: 자동 테스트도 스크린샷 증거(`production/qa/evidence/`)도 없다. coding-standards의 "A parse check is not a run"에 따라 로컬 실행 스크린샷이 필요하다.
- `SaveStore.save`의 실패 경로(열기 실패, 쓰기 실패), `GameConfig.load_file`의 파일 없음·깨진 JSON, `CardSet.get_card`의 없는 id(null) 경로.
- M2를 고치면 "36장 수집 = 도감 완성" 판정 테스트를 더한다.

## 실행한 도구

```bash
pip install "gdtoolkit==4.*"          # gdtoolkit 4.5.0
gdparse src/core/*.gd src/ui/*.gd tests/fixtures/*.gd tests/unit/*/*.gd tests/integration/*/*.gd   # 통과
gdlint src tests                       # 스타일 27건
python3 tools/validate_cards.py                                  # samguk.json PASS
python3 tools/validate_cards.py tests/fixtures/cards_fixture.json   # FAIL 1건 (L4)
python3 tools/gd_card_validator_port.py assets/data/cards/samguk.json            # 0 errors, anchors 4, playable 36, disputed 4
python3 tools/gd_card_validator_port.py assets/data/cards/samguk.json --release  # 규칙 8 오류 12 (의도됨)
python3 tools/gd_card_validator_port.py tests/fixtures/cards_fixture.json        # 0 errors, anchors 3, playable 12, disputed 1
```

`tools/gd_card_validator_port.py`는 이 검토를 위해 만든 `card_validator.gd`와 `CardLoader.filter_for_mode`의 줄 단위 이식이다. JSON 숫자를 Godot처럼 float으로 읽는다. GDScript 검증기를 고치면 이 파일도 함께 고쳐야 한다(아니면 지워도 된다).

## 로컬 첫 실행 때 특히 볼 것

1. `godot --headless --path . --import` 출력에 `Parse Error`나 `SCRIPT ERROR`가 없는지(정적 검토의 결론을 실제로 확인하는 단계)
2. gdUnit4 6.2.2 이상으로 `-a res://tests` 종료 코드 0(예상: 79개 테스트 통과)
3. M1: 마지막 카드에서 빈 칸이 하나뿐인지 직접 보고, 그대로 둘지 결정
4. L2: 드래그로 칸 여러 개를 지나갈 때 하이라이트가 돌아오는지
5. L3: 드래그 미리보기의 "? 사건 카드" 한글이 보이는지

## 처리 결과 (Godot MVP 세션, 2026-11-04)

대상 커밋: 이 표가 들어간 `claude/godot-mvp` 커밋. Godot는 여전히 실행하지 않았다(gdparse·gdlint 통과, Python 이식으로 검증기 대조).

| 항목 | 처리 | 내용과 이유 |
|---|---|---|
| M1 빈 칸이 정답을 알려 줌 | 고침 | D22 구현(D30): 라운드 12장을 칸과 무관하게 미수집 우선으로 뽑고, 채워진 칸도 받아 판정한다. `RoundBuilder`, `RoundSession.cell_cards`, `BoardCell`(거부 조건 삭제, 이름을 줄로 쌓음), `main.gd`/`game_screen.gd`. 테스트: "채워진 칸도 판정", "한 칸 여러 장", "미수집 우선", "칸 반복 가능" |
| M2 라운드 클리어를 도감 완성으로 표시 | 이미 고침(25aac52), 확인 | 결과 화면 제목 "라운드 클리어"/"실패", 도감 완성은 `ProgressData.is_complete`(단위 테스트 있음)로 따로 판정해 표시 |
| M3 gdUnit4 정보 | 고침 | `run-locally.md`: `godot-gdunit-labs/gdUnit4` 6.2.2 이상, 첫 import 139 크래시 후 재실행 안내, 종료 코드 표 |
| L1 저장 교체 중 끊김 | 고침 | tmp → bak → 교체 → bak 삭제, 읽기는 본 파일 → tmp → bak. 실패 시 이전 저장 유지. 기존 파일 덮어쓰기에 기대지 않는다(Windows 동작 미확인). 통합 테스트 4개 추가 |
| L2 드래그 하이라이트 | 고침 | 하이라이트 StyleBox를 칸마다 한 번 만들고 상태가 바뀔 때만 적용. 드래그 중 `mouse_exited`가 오는지는 여전히 미확인이라 체크리스트에 넣었다 |
| L3 드래그 미리보기 테마 | 고침 | `HanjiTheme.current()`(정적 캐시)를 미리보기에 직접 준다 |
| L4 검증기 차이 | 고침(25aac52) + 정리 | GDScript 검증기가 Python 술어와 같다(D17). 39개 동등성 케이스를 Python·GDScript(gdUnit)·이식 도구가 함께 돌린다. `tools/gd_card_validator_port.py`를 새 검증기에 맞춰 다시 썼다(`--parity` 39/39). 남긴 차이: Godot는 2.0 같은 정수값 float을 정수로 받는다(JSON 숫자가 float이라서) |
| L5 옆 패널 스크롤 | 고침 | 본게임·튜토리얼·결과·도감의 긴 영역을 `ScrollContainer`(가로 스크롤 끔)로 감쌌다 |
| L6 체크리스트 기준 카드 수 | 고침 | 기준 4장, 견해가 나뉘는 기록 4장, 도감 m / 36으로 고치고 새 기능까지 체크리스트를 다시 썼다 |
| L7 출시 내보내기 | 고침(안내) | 출시 빌드에서 규칙 8 오류만 있으면 "사실 확인된 카드가 부족해 시작할 수 없다, 디버그 내보내기로 플레이테스트" 안내를 먼저 보인다. 제외 필터 목록을 `run-locally.md`에 적었다. `export_presets.cfg`는 `.gitignore` 대상이라 만들지 않았다 |
| L8 첫 실행 생성 파일 | 판단·기록 | `*.gd.uid`와 `global_script_class_cache.cfg`는 커밋 대상(로컬 첫 import 뒤 커밋하라고 안내). 이 세션에서는 만들 수 없다. `.gitignore`에 gdUnit4 리포트 `reports/`를 추가 |
| L9 gdlint | 고침(설정) | `gdlintrc`: 한글 문자열 줄 때문에 `max-line-length` 160, 테스트 스위트 때문에 `max-public-methods` 60. 160을 넘던 5줄은 나눴다. `gdlint src tests` → no problems |
| L10 렌더러 | 바꿈 | Compatibility로(D29). 2D UI 게임, 오래된 GPU 안정성, 웹 내보내기와 같은 렌더러. `project.yaml`·technical-preferences도 갱신 |

남은 것: 실제 실행(파서·런타임), 스크린샷 증거, 게임패드 입력, 화면 문자열의 번역 시스템 경유(`tr()`).
