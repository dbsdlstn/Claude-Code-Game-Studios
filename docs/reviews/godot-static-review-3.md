# Godot MVP 3차 정적 검토 (한양 도감)

- 날짜: 2026-11-04
- 대상: `git diff 743bef9 56a0c5f -- src tests project.godot assets/art` (병합한 통합 브랜치 끝은 d3bb5a8이지만 56a0c5f 뒤로 코드 변경 없음. 26개 파일: 2차 처리 + D37/D39 아트 반영), 2차 처리 표(`docs/reviews/godot-static-review-2.md` 끝)
- 기준: `docs/engine-reference/godot/`, `design/art/art-bible.md` §3·§4·§7, `docs/decision-log.md` D37·D38·D39·D40·D42, `.claude/rules/ui-code.md`
- **Godot를 실행하지 않았다.** 코드 읽기, gdtoolkit 4.5.0, `tools/gd_card_validator_port.py`, 색 대비 계산(WCAG 2.x 상대 휘도 공식)으로 판단했다.

## 요약

| 심각도 | 개수 |
|---|---|
| 높음 | 0 |
| 중간 | 3 |
| 낮음 | 6 |

높음 0개: 파싱·API·시그니처·타입 추론에서 실행을 막는 문제는 찾지 못했다. 2차 처리 표의 "고침" 11개는 모두 코드로 확인했다.

가장 중요한 것:
1. **P1** 숨김 상태 테스트는 실제 화면(`CardView.show_card`)이 아니라 같은 글을 따로 만드는 정적 함수(`hidden_texts`)를 검사한다. 그 함수는 카드 유형을 아예 읽지 않아서, "유형을 바꿔도 글이 같다"는 테스트가 어떤 경우에도 통과한다.
2. **P2** D42의 짙은 금 `#7D5A12`가 Godot에 없다. 신라 행 머리글 글자(대비 2.09), 신라·가야 인장 글자(2.09·3.98), 기준 카드 칸 강조 테두리(바탕 대비 1.8)가 WCAG AA에 못 미친다.
3. **P3** 키보드로 마지막 카드를 놓으면, 결과 화면이 뜬 뒤 숨겨진 본게임 카드로 초점을 옮기는 지연 호출이 실행된다. 결과 화면에서 키보드가 먹히지 않을 수 있다.

## 2차 처리 검증

| 2차 항목 | 처리 표 | 검증 | 근거(현재 코드) |
|---|---|---|---|
| N1 공용 튜토리얼 파일 | 확인 | **확인**(Godot 쪽) | `tutorial_data.gd`가 `{anchor_id, cards}`를 읽는다. 본 덱의 기준 카드 전부를 스텁으로 넣어 검증(T5). 웹 쪽은 D38·D40 범위로, 이번 검토 대상 밖 |
| N2 출시 모드 연습 카드 | 고침 | **확인** | `tutorial_data.gd` `parse(..., release_mode)`가 `CardLoader.filter_for_mode` 적용, 0장이면 실패. `main.gd`가 `_cards.release_mode`를 넘긴다. 테스트 `test_release_mode_skips_unverified_practice_card`, `test_release_mode_accepts_verified_practice_card` |
| N3 이어하기 new_ids | 고침 | **확인** | `RoundSession.new_ids`, `note_new_collected`, `to_dict`·`summary`·`from_dict`에 포함. `main.gd`가 `summary["new_ids"]`로 기록·표시 |
| L1 v1 라운드 수 | 고침 | **확인** | `stats()`의 `rounds = rounds_played`, `logged_rounds = round_log.size()`, `from_dict`가 `rounds_played >= cleared+failed, >= 기록 수`로 맞춘다. `dogam_view.format_stats`가 v1 문구 |
| L2 저장 version | 고침 | **확인**, 실패 경로 하나 남음(H1) | `save_store.gd:80-86`, `ProgressData.version_of` |
| L3 글꼴 판정 | 고침 | **확인** | `hanji_theme.gd:101-121`: 판정용 `probe`는 한글 목록만, 테마용 `system`은 `sans-serif`를 덧붙인다 |
| L4 마우스 선택 시 초점 | 고침 | **확인** | `card_view.gd:177-180` 마우스면 `release_focus()`, `selection_changed(…, by_keyboard)`. `board_cell.gd:144-152`도 같음. 게임·튜토리얼 모두 키보드일 때만 첫 칸 초점 |
| L5 키보드 흐름 | 고침 | **확인**, 부작용 하나(P3) | 모든 화면 `focus_default()`, `main.gd:131`에서 지연 호출 |
| L6 칸 넘침 | 고침 | **확인** | `BoardCell.visible_text`(최근 2줄 + "외 n장"), 전체는 `tooltip_text`. 테스트 3개 |
| L7 기본 경고 | 고침 | **확인** | `result_view.gd` `font_size`, `card_validator.gd` `explanation_text` |
| L8 시작하기 확인 | 고침 | **확인** | `main.gd` `ConfirmationDialog`(`ok_button_text`·`cancel_button_text`·`confirmed`·`popup_centered`는 4.x API). 화면 목록(`_screen_root`) 밖, Main에 붙인다 |
| L9 되살린 라운드 정합성 | 고침 | **확인** | `round_session.gd` `_is_consistent`: 정답+오답=놓은 수, 기록 수, 먹물=시작−오답, 기록 순서=큐 순서, 보드 카드는 앞서 놓은 카드이고 그 정답 칸에 있음 |

## 확인한 것(문제 없음)

| 항목 | 결과 |
|---|---|
| 문법 | `gdparse` 41개 파일 통과, `gdlint` 문제 없음 |
| 4.7 재정의 반환형 | 반환형 없는 `func` 없음. `CardArtView._init(art_size: Vector2 = …) -> void` 등 |
| 새 API | `Tween.tween_interval`, `tween_callback`, `Tween.kill/is_valid`, `Callable.call_deferred`, `Object.call_deferred`, `PackedStringArray.slice`, `TextureRect.EXPAND_IGNORE_SIZE`·`STRETCH_KEEP_ASPECT_CENTERED`, `DirAccess.copy_absolute`, `Color.to_html(false)`이 4.x 형식 |
| SVG를 텍스처로 쓰는 방법 | engine-reference에는 SVG 항목이 없다(4.5~4.7 변경 목록에 SVG 가져오기 변경도 없음). Godot 4는 `.svg`를 기본 텍스처 가져오기(ThorVG 래스터화)로 `CompressedTexture2D`를 만들고, `load("res://….svg")`가 `Texture2D`를 준다. `card_art_view.gd:53-54`는 `ResourceLoader.exists` → `load() as Texture2D`로, 내보낸 빌드에서도 가져온 리소스 경로로 동작한다(`FileAccess`로 원본 SVG를 읽지 않음). `Image.load_svg_from_buffer`는 가져오기 없이 런타임에 래스터화할 때 쓰는 방법이라 여기서는 필요 없다. 대체 문양 4개는 `rect/line/path/circle/ellipse/title`만 쓰고 `<text>`·`<filter>`·`<image>`·CSS가 없어 ThorVG가 그리지 못하는 요소가 없다 |
| 없는 image 경로 | `CardArt.revealed_path`: `image`가 없거나 `ResourceLoader.exists`가 false면 유형별 대체 문양, 모르는 유형이면 event 문양. 테스트 5개(주입한 `exists`) |
| 숨김 상태 노출 | `CardView.show_card`는 `card.type`·`nation`·`era`·`title`·`image`를 읽지 않는다. 일러스트 영역은 `show_hidden()`("?"만, 텍스처 null), 제목은 상수 `HIDDEN_HEADING`, 드래그 미리보기도 같은 상수, 관계 단서 버튼은 기준 카드 제목만(보드에 이미 보이는 정보). 화면 코드 자체에는 누출이 없다(테스트의 한계는 P1) |
| 테마 색 상수 | 15개 `Color()`를 32비트 float로 바꿔 255를 곱했을 때 반올림·내림 모두 주석 hex와 같다(`to_html`의 반올림 방식과 무관하게 테스트 `test_semantic_colors_match_art_bible`이 통과) |
| 트윈 정리 | `Timer` 노드·`SceneTreeTimer`·`await`가 없다. 트윈 두 개(`board_cell.gd:112` 칸 강조, `:120` 오답 깜박임)는 `Node.create_tween()`이라 노드에 묶여, 노드가 해제되면 함께 끝난다. 강조는 새로 시작할 때 이전 것을 `kill()`한다. 화면 전환으로 노드가 숨겨지기만 하면 1.2초 뒤 `_restore_style`이 한 번 불리고 끝난다(누수 없음). 튜토리얼 화면을 다시 열 때 이전 것은 `queue_free()`(`main.gd`) |
| 고아 노드 | 새 UI 테스트 3개 파일은 정적 함수만 부른다. 노드를 만들지 않아 gdUnit4 종료 코드 101 위험 없음 |
| 테스트 | 157개. 새 테스트(아트·테마 11, 숨김 4+1, 칸 문구 3, 튜토리얼 4, 진행 3, 저장 1, 라운드 정합성 등)의 기대값을 코드대로 따라가 맞음을 확인했다 |
| 데이터 | `samguk.json` 개발 모드 오류 0, parity 39/39. `image`가 null이 아닌 카드는 아직 없다(전부 대체 문양 경로) |

## 문제 목록

### P1. 숨김 상태 테스트가 실제 화면을 검사하지 않는다 — 중간, 확실

- 위치: `src/ui/card_view.gd:87-93`(`hidden_texts`), `:115-135`(`show_card`), `tests/unit/ui/card_view_hidden_test.gd:15-37`, `tests/integration/cards/card_file_loading_test.gd:98-109`
- 근거:
  - `hidden_texts(_card, clues, ref_titles)`는 첫 인자를 쓰지 않는다(이름도 `_card`). 그래서 `test_hidden_texts_are_identical_for_every_type`와 `test_samguk_hidden_texts_do_not_depend_on_card_type`(카드의 `type`을 바꿔 비교)은 어떤 구현에서도 통과한다. D37이 막으려는 "숨김 카드에 유형이 보이는" 회귀를 잡지 못한다.
  - 화면에 실제로 나오는 글은 `show_card`가 따로 만든다. 주석은 "show_card와 같은 순서"라고 약속하지만 강제하는 장치가 없다. 누군가 `show_card`에 `_heading.text = HanjiTheme.type_label(card.type)`을 넣어도 모든 테스트가 통과한다.
  - 화면에서 숨김 상태에 보이는 다른 글(`_help`, 관계 단서 버튼 `tooltip_text`, `CardArtView`의 `_question`·`_caption`)은 `hidden_texts`에 들어 있지 않다.
  - `test_hidden_texts_contain_no_type_badge`는 "사건"을 건너뛴다. 숨김 제목 "? 사건 카드"에 이미 들어 있기 때문이다. 그래서 event 배지가 새도 잡지 못한다.
- 고치는 방법: 실제 노드를 만들어 보이는 글을 모두 모아 비교한다. gdUnit4의 `auto_free()`로 고아 노드를 피한다.
  ```gdscript
  # tests/unit/ui/card_view_hidden_test.gd
  func _visible_texts(root: Node) -> PackedStringArray:
  	var out := PackedStringArray()
  	for n: Node in root.find_children("*", "", true, false):
  		if n is CanvasItem and not (n as CanvasItem).visible:
  			continue
  		if n is Label: out.append((n as Label).text)
  		elif n is Button: out.append((n as Button).text)
  		if n is Control and not (n as Control).tooltip_text.is_empty():
  			out.append((n as Control).tooltip_text)
  	return out

  func test_shown_card_texts_do_not_depend_on_type() -> void:
  	var view: CardView = auto_free(CardView.new())
  	view.set_ref_titles({Fx.ANCHOR_ID: Fx.anchor_title(Fx.ANCHOR_ID)})
  	var before := PackedStringArray()
  	for t: String in TYPES:
  		var c := _card(t)
  		view.show_card(c, c.clues, true)
  		var texts := _visible_texts(view)
  		if before.is_empty(): before = texts
  		assert_array(Array(texts)).is_equal(Array(before))
  		for label: String in HanjiTheme.TYPE_LABELS.values():
  			for s in texts:
  				if s != CardView.HIDDEN_HEADING:
  					assert_str(s).not_contains(label)
  ```
  `queue_free`로 지운 단서 줄이 같은 프레임에 남으므로, 유형마다 새 `CardView`를 만들거나 `show_card` 전에 `_clue_box`의 자식을 `free()`하는 테스트용 경로를 둔다. `hidden_texts`는 지우거나 이 테스트로 대체한다.

### P2. 짙은 금(D42)이 없고, 나라색·금 글자와 테두리가 대비 기준에 못 미친다 — 중간, 확실

- 위치: `src/ui/hanji_theme.gd:18`(GOLD만 있음), `:62-78`(`seal`, 글자 `PAPER`), `src/ui/board_view.gd:53`(행 머리글 글자에 나라색), `src/ui/board_cell.gd:47`(강조 테두리 `GOLD`)
- 근거: D42(총괄, 2026-11-04)는 "`#C79A2E`는 장식(선, 인장 바탕, 클리어 연출)에만, 글자·포커스에는 `#7D5A12`, Godot과 웹이 같은 두 값"으로 정했다. 아트 바이블 §4.1(52행)도 같다. Godot는 D39에서 이 결정 전에 작업해 반영되지 않았다. 대비(WCAG 2.x, 글자 4.5:1·비텍스트 3:1 기준):

  | 요소 | 글자/선 | 바탕 | 대비 | 기준 |
  |---|---|---|---|---|
  | 신라 행 머리글 글자(18px) | `#C79A2E` | 한지 `#EFE6D2` | **2.09** | 4.5 |
  | 가야 행 머리글 글자 | `#4F7A55` | 한지 | **3.98** | 4.5 |
  | 신라 인장 글자(15px) | 한지 `#EFE6D2` | `#C79A2E` | **2.09** | 4.5 |
  | 가야 인장 글자 | 한지 | `#4F7A55` | **3.98** | 4.5 |
  | 기준 카드 칸 강조 테두리 | `#C79A2E` | 기준 칸 `#E3D6B4` | **1.80** | 3 |
  | (참고) 고구려·백제 머리글·인장 | | | 5.30·5.68 | 통과 |

  웹(D38)은 인장 글자를 흰색으로, 신라 인장만 먹 글자(6.1:1)로 해결했다. 두 빌드의 모양이 다르다.
- 고치는 방법:
  ```gdscript
  # hanji_theme.gd
  const GOLD := Color(0.7804, 0.6039, 0.1804)        # 금 #C79A2E — 장식만(D42)
  const GOLD_TEXT := Color(0.4902, 0.3529, 0.0706)   # 짙은 금 #7D5A12 — 글자·포커스(D42)
  ## 인장 글자색: 웹 D38과 같게 흰색, 신라(금 바탕)만 먹색.
  static func seal_text_color(nation_id: String) -> Color:
  	return INK if nation_id == "silla" else Color.WHITE
  ```
  - `seal()`의 `PAPER` → `seal_text_color(nation_id)`(흰 글자: 고구려 6.6, 백제 7.1, 가야 4.9).
  - 행 머리글 이름은 나라색 글자 대신 먹색(`INK`) 글자로 쓰고, 나라색은 인장과 왼쪽 띠(웹 D38)로 보인다. 나라색 글자를 유지하려면 신라만 `GOLD_TEXT`(5.06), 가야는 더 어둡게 해야 한다(바이블 변경이라 총괄 판단).
  - 칸 강조 테두리는 `GOLD_TEXT`(기준 칸 바탕 대비 4.35)로 바꾼다. 웹은 관계 단서 강조에 청(백제색)을 쓴다(D38). 두 빌드 중 하나로 맞추는 것도 총괄 판단이다.
  - `test_semantic_colors_match_art_bible`에 `"7d5a12": HanjiTheme.GOLD_TEXT`를 넣는다.

### P3. 키보드로 마지막 카드를 놓으면 초점이 숨겨진 카드로 갈 수 있다 — 중간, 가능성

- 위치: `src/ui/game_screen.gd:184-190`, `src/ui/main.gd:126-131`, `:264`
- 근거: 키보드로 놓으면 순서가 이렇게 된다.
  1. `placement_requested.emit()`이 동기로 `main._on_placement`를 부른다.
  2. 라운드가 끝났으면 `main`이 `_show_only(_result)`를 부르고, 여기서 `_result.focus_default`를 지연 호출로 넣는다.
  3. emit이 돌아온 뒤 `game_screen.gd:190`이 `_card_view.grab_focus`를 지연 호출로 넣는다.
  4. 지연 호출은 넣은 순서대로 실행되므로, 결과 화면 "새 라운드" 버튼이 초점을 받은 직후 **숨겨진** 본게임 카드가 초점을 가져간다.

  Godot 4의 `Control.grab_focus()`가 보이지 않는 컨트롤을 거부하는지는 engine-reference에 없어 확인하지 못했다. 거부하지 않으면 결과 화면에서 Enter·방향키가 먹히지 않는다(마우스는 정상). 튜토리얼의 같은 패턴(`tutorial_view.gd:177-178`)은 화면이 바뀌지 않아 문제없다.
- 고치는 방법:
  ```gdscript
  # game_screen.gd
  if by_keyboard:
  	_focus_card_if_visible.call_deferred()

  func _focus_card_if_visible() -> void:
  	if _card_view.is_visible_in_tree():
  		_card_view.grab_focus()
  ```
  로컬 체크리스트: "키보드만으로 12장을 놓은 뒤 결과 화면에서 Enter로 새 라운드가 시작되는가".

### H1. 새 형식 저장을 보관하는 복사가 실패해도 계속 진행한다 — 낮음, 확실

- 위치: `src/core/save_store.gd:86`
- 근거: `DirAccess.copy_absolute(candidate, keep)`의 반환값을 보지 않는다. 복사가 실패하면(권한, 디스크 가득 참) 빈 진행으로 시작한다. 그 뒤 첫 `save()`가 원본을 bak으로 옮겼다가 지워서 새 형식 저장이 사라진다. 2차 L2가 막으려던 결과다.
- 고치는 방법: 복사가 `OK`가 아니면 `SaveStore`를 읽기 전용으로 표시(`var read_only := true`)하고 `save()`가 쓰지 않게 한다. 화면 안내에 "저장하지 않음"을 넣는다. 테스트는 쓸 수 없는 경로 대신 `copy`를 주입할 수 있게 `Callable`로 받는 방식이 단순하다.

### H2. 1024×768 SVG를 220×165로 줄일 때 가는 선이 흐려지거나 끊길 수 있다 — 낮음, 가능성

- 위치: `assets/art/placeholders/*.svg`(viewBox 1024×768, `stroke-width` 1~4), `src/ui/card_art_view.gd:21-23`
- 근거: SVG는 가져올 때 한 번 래스터화된다(기본 배율 1.0 → 1024×768 텍스처). 화면에서는 약 0.21배로 줄여 그린다. `stroke-width="1"` 선은 약 0.2px이 된다. 밉맵이 없으면 선형 필터로 줄일 때 선이 끊기거나 반짝인다. `TextureRect`는 `texture_filter`를 따로 정하지 않았고, 가져오기의 밉맵은 기본 꺼짐이다.
- 고치는 방법(하나):
  - 각 SVG의 `.import`에서 `svg/scale=0.5`(512×384), 또는 도감 상세 크기에 맞춘 값을 쓴다.
  - 또는 `mipmaps/generate=true` 가져오기 + `_texture_rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`.
  - 또는 원본 SVG의 가장 가는 선을 4 이상으로 올린다(바이블 §7.1 문양 사양과 맞춰 아트 쪽에서).
  
  engine-reference에 SVG 가져오기 항목이 없다. 로컬에서 확인한 뒤 `modules/rendering.md`(또는 새 `modules/assets.md`)에 적어 두면 다음 판단이 쉬워진다. 체크리스트: "공개 카드의 대체 문양 선이 끊기지 않는가(1280×720 스크린샷)".

### H3. 그림을 못 읽으면 공개 카드가 숨김 카드처럼 "?"로 보인다 — 낮음, 확실

- 위치: `src/ui/card_art_view.gd:50-58`
- 근거: `revealed_path`가 고른 경로를 `load()`했는데 `Texture2D`가 아니면(손상된 그림, 리소스 형식이 다른 파일, 가져오기 전) `show_hidden()`으로 "?"를 그린다. 공개 상태에서 "?"는 숨김 상태와 같은 모양이라 혼동된다. 바이블 §7.1은 이럴 때 대체 문양을 쓰라고 한다.
- 고치는 방법: 카드 그림이 실패하면 유형별 대체 문양을 한 번 더 시도하고, 그것도 실패할 때만 빈 바탕과 "그림 준비 중" 캡션을 보인다("?"는 쓰지 않는다).
  ```gdscript
  var tex := _try_load(path)
  if tex == null and not CardArt.is_placeholder(path):
  	path = CardArt.placeholder_path(card.type)
  	tex = _try_load(path)
  ```

### H4. 먹물 빈 칸 ○이 거의 보이지 않는다 — 낮음, 확실

- 위치: `src/ui/game_screen.gd:55`, `src/ui/hanji_theme.gd:21`(`INK_EMPTY #C9BC9B`)
- 근거: `#C9BC9B`는 한지 바탕 대비 **1.52**다. 남은 먹물(●, 먹색)은 잘 보이지만 전체 칸 수(○)가 보이지 않으면 "5개 중 몇 개"를 읽기 어렵다. 바이블 §4.3 값이라 바꾸려면 바이블과 함께 바꿔야 한다. 비텍스트 기준 3:1에 못 미친다.
- 고치는 방법: ○ 글자는 `MUTED`(한지 대비 약 7)로 그리고 `#C9BC9B`는 채움 없는 게이지 바탕 같은 장식에만 쓴다. 또는 "먹물 3 / 5" 숫자를 함께 보인다(화면 낭독에도 유리).

### H5. 기준 카드 칸 강조가 다른 입력에 일찍 끝나고, 웹과 동작이 다르다 — 낮음, 확실

- 위치: `src/ui/board_cell.gd:107-114`, `:169-173`, `src/ui/card_view.gd:190-191`
- 근거:
  - 강조 중에 그 칸에서 `mouse_exited`·`focus_entered/exited`·드래그 끝이 오면 `_restore_style()`이 곧바로 원래 스타일로 되돌린다(트윈은 살아 있다가 1.2초 뒤 한 번 더 되돌린다). 마우스를 보드 위로 움직이며 버튼을 누르면 강조가 거의 보이지 않을 수 있다.
  - 강조 스타일은 바탕을 기준 칸 색으로 바꾼다. 그 칸에 정답·오답 카드가 놓여 있으면 1.2초 동안 정답/오답 바탕색이 사라진다.
  - 웹(D38)은 버튼에 초점이 있는 동안 강조를 유지하고, 클릭만 하면 2.5초 뒤에 지운다. 테두리 색도 청이다. 플레이테스트에서 두 빌드를 비교하면 차이가 드러난다.
- 고치는 방법: `_highlighting` 플래그를 두고, `_restore_style()`이 강조 중이면 `_highlight_style`을 유지하게 한다. 강조 스타일은 `_base_style.duplicate()`에 테두리만 바꿔 바탕을 보존한다. 시간과 색은 웹과 맞춘다(2.5초, 또는 D42 짙은 금으로 양쪽 통일; 총괄 판단).

### H6. 새 SVG의 가져오기 파일과 스크립트 UID 파일을 커밋해야 한다 — 낮음, 확실(정보)

- 근거: 저장소에 `assets/art/placeholders/*.svg.import`와 새 스크립트 6개(`card_art.gd`, `card_art_view.gd`, `reveal_view.gd`, 테스트 3개)의 `*.gd.uid`가 없다. 첫 로컬 import에서 생긴다. `.import`가 없으면 클론마다 가져오기 설정(H2의 배율·밉맵)이 기본값으로 돌아간다.
- 고치는 방법: `run-locally.md` 2절의 "import 뒤 커밋할 것"에 `*.svg.import`를 더한다. H2의 설정을 바꾸면 그 `.import`도 커밋한다.

## 실행한 도구

```bash
gdparse $(git ls-files 'src/*.gd' 'tests/*.gd')   # 41개 통과
gdlint src tests                                   # Success: no problems found
grep -h '^func test_' -r tests | wc -l             # 157
python3 tools/gd_card_validator_port.py --parity   # 39/39
# 색: hanji_theme.gd의 Color()를 float32로 바꿔 hex 대조(반올림·내림 모두 일치),
#     WCAG 상대 휘도로 대비 계산(P2·H4 표)
# SVG: 사용 요소 집계(rect, line, path, circle, ellipse, title; text·filter·image·style 없음)
```

## 로컬 첫 실행 때 특히 볼 것(1·2차 목록에 더해)

1. 정답·오답 뒤 옆 패널과 도감 상세에 대체 문양이 보이는지, 선이 끊기지 않는지(H2), "그림 준비 중" 캡션
2. 키보드만으로 12장을 놓은 뒤 결과 화면에서 Enter가 먹히는지(P3)
3. 관계 단서 "▶ [기준 카드] 칸 보기"를 마우스로 눌렀을 때 강조가 1.2초 보이는지(H5)
4. 신라·가야 행 머리글과 인장 글자를 1280×720에서 읽을 수 있는지(P2)
5. import 뒤 `git status`의 `*.svg.import`, 새 `*.gd.uid` 커밋(H6)
