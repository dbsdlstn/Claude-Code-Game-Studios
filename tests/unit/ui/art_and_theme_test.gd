extends GdUnitTestSuite
## 일러스트 경로(CardArt), 아트 바이블 색 토큰과 인장(HanjiTheme), 보드 칸 문구(BoardCell),
## 관계 단서 강조용 기준 카드 → 칸 매핑(BoardView). 정적 함수만 쓴다.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func _card(card_type: String, image: Variant = null) -> CardData:
	var raw := Fx.card("silla-peak", "silla", "peak")
	raw["type"] = card_type
	raw["image"] = image
	return CardData.from_dict(raw)


func test_placeholder_path_per_type() -> void:
	for t: String in ["event", "artifact", "person", "myth"]:
		assert_str(CardArt.placeholder_path(t)).is_equal("res://assets/art/placeholders/placeholder-%s.svg" % t)


func test_unknown_type_uses_event_placeholder() -> void:
	assert_str(CardArt.placeholder_path("weird")).ends_with("placeholder-event.svg")


func test_revealed_path_uses_image_when_file_exists() -> void:
	var c := _card("artifact", "assets/art/cards/silla-peak.png")
	var always := func(_p: String) -> bool: return true
	assert_str(CardArt.revealed_path(c, always)).is_equal("res://assets/art/cards/silla-peak.png")


func test_revealed_path_falls_back_to_placeholder_when_image_missing() -> void:
	var c := _card("artifact", "assets/art/cards/silla-peak.png")
	var never := func(_p: String) -> bool: return false
	var path := CardArt.revealed_path(c, never)
	assert_str(path).ends_with("placeholder-artifact.svg")
	assert_bool(CardArt.is_placeholder(path)).is_true()


func test_revealed_path_without_image_is_placeholder() -> void:
	var always := func(_p: String) -> bool: return true
	assert_str(CardArt.revealed_path(_card("myth"), always)).ends_with("placeholder-myth.svg")


func test_nation_colors_match_art_bible() -> void:
	# 아트 바이블 §4.2의 hex(웹과 같은 값)
	var expected := {"goguryeo": "a23b2a", "baekje": "2f5d7c", "silla": "c79a2e", "gaya": "4f7a55"}
	for id: String in expected:
		assert_str(HanjiTheme.nation_color(id).to_html(false)).is_equal(expected[id])


func test_semantic_colors_match_art_bible() -> void:
	var expected := {
		"efe6d2": HanjiTheme.PAPER, "f7f0de": HanjiTheme.CELL, "e3d6b4": HanjiTheme.ANCHOR,
		"2b2118": HanjiTheme.INK, "5b4a35": HanjiTheme.MUTED, "8a6d3b": HanjiTheme.BORDER,
		"c79a2e": HanjiTheme.GOLD, "cfe8c4": HanjiTheme.CORRECT, "2e5a2a": HanjiTheme.CORRECT_TEXT,
		"f3c4c0": HanjiTheme.WRONG, "8a2a22": HanjiTheme.WRONG_TEXT, "ffe9a8": HanjiTheme.HOVER,
		"c0392b": HanjiTheme.ACCENT, "c9bc9b": HanjiTheme.INK_EMPTY,
	}
	for hex: String in expected:
		assert_str((expected[hex] as Color).to_html(false)).is_equal(hex)


func test_seal_char_is_first_letter_of_label() -> void:
	assert_str(HanjiTheme.seal_char("고구려")).is_equal("고")
	assert_str(HanjiTheme.seal_char("가야")).is_equal("가")


func test_type_label_for_revealed_card() -> void:
	assert_str(HanjiTheme.type_label("myth")).is_equal("전승")
	assert_str(HanjiTheme.type_label("artifact")).is_equal("유물")


func test_cell_line_marks_result_without_relying_on_color() -> void:
	assert_str(BoardCell.line_text("살수대첩", true)).is_equal("○ 살수대첩")
	assert_str(BoardCell.line_text("살수대첩", false)).is_equal("× 살수대첩 (오답)")


func test_anchor_cell_keys_map_anchor_to_its_cell() -> void:
	var cs := CardLoader.build(Fx.valid_set(), Fx.nation_ids(), Fx.era_ids(), false)
	var keys := BoardView.anchor_cell_keys(cs.anchors)
	assert_str(keys[Fx.ANCHOR_ID]).is_equal("goguryeo/peak")


func test_ref_titles_list_anchor_titles() -> void:
	var cs := CardLoader.build(Fx.valid_set(), Fx.nation_ids(), Fx.era_ids(), false)
	assert_str(GameScreen.ref_titles(cs.anchors)[Fx.ANCHOR_ID]).is_equal(Fx.anchor_title(Fx.ANCHOR_ID))
