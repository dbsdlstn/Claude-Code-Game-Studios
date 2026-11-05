extends GdUnitTestSuite
## 보드 관계 단서 강조(리뷰 3 H5, 웹 refs.js와 같은 동작), 공개 카드 그림의 대체 경로(H3),
## 먹물 수 표시(H4). 노드는 auto_free로 정리한다.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")
const UiTexts = preload("res://tests/fixtures/ui_texts.gd")


func _board() -> BoardView:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	var cards := Fx.valid_set()
	cards.append(Fx.anchor("anchor-silla-founding", "silla", "founding"))
	var cs := CardLoader.build(cards, Fx.nation_ids(), Fx.era_ids(), false)
	var board: BoardView = auto_free(BoardView.new())
	board.setup(cfg, cs.anchors)
	return board


func test_sticky_ref_highlight_stays_until_cleared() -> void:
	var board := _board()
	board.show_ref(Fx.ANCHOR_ID, true)
	assert_bool(board.cell("goguryeo", "peak").is_ref_highlighted()).is_true()
	board.clear_ref()
	assert_bool(board.cell("goguryeo", "peak").is_ref_highlighted()).is_false()


func test_only_one_cell_is_highlighted_at_a_time() -> void:
	var board := _board()
	board.show_ref(Fx.ANCHOR_ID, true)
	board.show_ref("anchor-silla-founding", true)
	assert_bool(board.cell("goguryeo", "peak").is_ref_highlighted()).is_false()
	assert_bool(board.cell("silla", "founding").is_ref_highlighted()).is_true()


func test_unknown_anchor_only_clears() -> void:
	var board := _board()
	board.show_ref(Fx.ANCHOR_ID, true)
	board.show_ref("no-such-anchor", true)
	assert_bool(board.cell("goguryeo", "peak").is_ref_highlighted()).is_false()


func test_highlight_survives_mouse_exit_and_focus_changes() -> void:
	# 강조 중에 다른 입력이 와도 강조 상태가 유지된다(_restore_style이 강조를 지우지 않음).
	var board := _board()
	board.show_ref(Fx.ANCHOR_ID, true)
	var bc := board.cell("goguryeo", "peak")
	bc.mouse_exited.emit()
	bc.focus_exited.emit()
	assert_bool(bc.is_ref_highlighted()).is_true()


func test_reset_clears_highlight() -> void:
	var board := _board()
	board.show_ref(Fx.ANCHOR_ID, true)
	board.reset()
	assert_bool(board.cell("goguryeo", "peak").is_ref_highlighted()).is_false()


func test_click_duration_matches_web() -> void:
	assert_float(BoardView.REF_CLICK_SECONDS).is_equal(2.5)


func test_revealed_art_never_shows_question_mark() -> void:
	# 리뷰 3 H3: 그림을 못 읽어도 공개 상태에 "?"를 쓰지 않는다(숨김 상태와 헷갈림).
	var raw := Fx.card("silla-peak", "silla", "peak")
	raw["image"] = "assets/art/cards/does-not-exist.png"
	raw["image_source"] = "테스트"
	raw["image_license"] = "CC0"
	var art: CardArtView = auto_free(CardArtView.new())
	art.show_revealed(CardData.from_dict(raw))
	assert_array(Array(UiTexts.visible_texts(art))).not_contains(["?"])


func test_hidden_art_shows_question_mark() -> void:
	var art: CardArtView = auto_free(CardArtView.new())
	art.show_hidden()
	assert_array(Array(UiTexts.visible_texts(art))).contains(["?"])


func test_ink_count_text() -> void:
	assert_str(GameScreen.ink_count_text(3, 5)).is_equal("3 / 5")


func test_empty_ink_glyph_color_meets_non_text_contrast() -> void:
	# 리뷰 3 H4: ○는 MUTED로 그린다(3:1 이상). 바이블 INK_EMPTY는 장식 전용.
	assert_float(HanjiTheme.contrast_ratio(HanjiTheme.MUTED, HanjiTheme.PAPER)).is_greater_equal(3.0)
	assert_float(HanjiTheme.contrast_ratio(HanjiTheme.INK_EMPTY, HanjiTheme.PAPER)).is_less(3.0)


func test_cell_lines_keep_their_own_result_color() -> void:
	# CI 화면 S2: 오답이 더해져도 앞의 정답 줄은 정답 글자색으로 남는다.
	var board := _board()
	board.show_placed("silla", "ending", "가", true)
	board.show_placed("silla", "ending", "나", false)
	var labels: Array = []
	for n: Node in board.cell("silla", "ending").find_children("*", "Label", true, false):
		var l := n as Label
		if l.text.begins_with("○") or l.text.begins_with("×"):
			labels.append(l)
	assert_int(labels.size()).is_equal(2)
	assert_str((labels[0] as Label).get_theme_color("font_color").to_html(false)).is_equal(HanjiTheme.CORRECT_TEXT.to_html(false))
	assert_str((labels[1] as Label).get_theme_color("font_color").to_html(false)).is_equal(HanjiTheme.WRONG_TEXT.to_html(false))
