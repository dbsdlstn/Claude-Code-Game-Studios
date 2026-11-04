extends GdUnitTestSuite
## CardLoader: JSON 파싱, 로드 모드 필터(규칙 9), 분류. 파일을 읽지 않는다.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func _build(cards: Array, release_mode: bool) -> CardSet:
	return CardLoader.build(cards, Fx.nation_ids(), Fx.era_ids(), release_mode)


func test_parse_text_valid_json_builds_card_set() -> void:
	# Arrange
	var text := JSON.stringify(Fx.valid_set())
	# Act
	var cs := CardLoader.parse_text(text, Fx.nation_ids(), Fx.era_ids(), false)
	# Assert
	assert_bool(cs.is_valid()).is_true()
	assert_int(cs.all_cards.size()).is_equal(13)
	assert_int(cs.anchors.size()).is_equal(1)
	assert_int(cs.playable.size()).is_equal(12)


func test_parse_text_broken_json_reports_error() -> void:
	var cs := CardLoader.parse_text("[ { \"id\": ", Fx.nation_ids(), Fx.era_ids(), false)
	assert_bool(cs.is_valid()).is_false()
	assert_int(cs.all_cards.size()).is_equal(0)


func test_parse_text_object_root_reports_error() -> void:
	var cs := CardLoader.parse_text("{}", Fx.nation_ids(), Fx.era_ids(), false)
	assert_bool(cs.is_valid()).is_false()


func test_invalid_cards_leave_set_empty() -> void:
	var cards := Fx.valid_set()
	cards.append(Fx.card("silla-peak", "silla", "peak"))  # 중복 id
	var cs := _build(cards, false)
	assert_bool(cs.is_valid()).is_false()
	assert_int(cs.all_cards.size()).is_equal(0)


func test_rule9_release_mode_drops_unverified_card() -> void:
	# Arrange: 같은 칸에 검증 안 된 카드를 하나 더 둔다.
	var cards := Fx.valid_set()
	var extra := Fx.card("silla-peak-unverified", "silla", "peak")
	extra["verified"] = false
	cards.append(extra)
	# Act
	var cs := _build(cards, true)
	# Assert
	assert_bool(cs.is_valid()).is_true()
	assert_bool(cs.has_card("silla-peak-unverified")).is_false()
	assert_int(cs.playable.size()).is_equal(12)


func test_rule9_release_mode_drops_disputed_card() -> void:
	var cards := Fx.valid_set()
	var extra := Fx.card("gaya-peak-disputed", "gaya", "peak")
	extra["disputed"] = true
	extra["disputed_note"] = "견해가 나뉜다."
	cards.append(extra)
	var cs := _build(cards, true)
	assert_bool(cs.has_card("gaya-peak-disputed")).is_false()
	assert_int(cs.disputed.size()).is_equal(0)


func test_rule9_dev_mode_loads_unverified_and_disputed() -> void:
	var cards := Fx.valid_set()
	var unverified := Fx.card("silla-peak-unverified", "silla", "peak")
	unverified["verified"] = false
	var disputed := Fx.card("gaya-peak-disputed", "gaya", "peak")
	disputed["disputed"] = true
	disputed["disputed_note"] = "견해가 나뉜다."
	cards.append(unverified)
	cards.append(disputed)
	var cs := _build(cards, false)
	assert_bool(cs.has_card("silla-peak-unverified")).is_true()
	assert_bool(cs.has_card("gaya-peak-disputed")).is_true()


func test_rule9_release_mode_with_all_unverified_fails_coverage() -> void:
	var cards := Fx.valid_set()
	for c: Dictionary in cards:
		c["verified"] = false
	var cs := _build(cards, true)
	assert_array(CardValidator.rules_of(cs.errors)).contains([CardValidator.RULE_CELL_COVERAGE])


func test_rule9_release_mode_dropping_referenced_anchor_reports_rule4() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, Fx.ANCHOR_ID)["verified"] = false
	var cs := _build(cards, true)
	assert_array(CardValidator.rules_of(cs.errors)).contains([CardValidator.RULE_RELATION_REFS])


func test_rule6_disputed_card_is_not_playable() -> void:
	var cards := Fx.valid_set()
	var extra := Fx.card("gaya-peak-disputed", "gaya", "peak")
	extra["disputed"] = true
	extra["disputed_note"] = "견해가 나뉜다."
	cards.append(extra)
	var cs := _build(cards, false)
	assert_int(cs.disputed.size()).is_equal(1)
	assert_int(cs.playable_for_cell("gaya", "peak").size()).is_equal(1)
	assert_str(cs.playable_for_cell("gaya", "peak")[0].id).is_equal("gaya-peak")


func test_card_data_reads_json_float_numbers_as_int() -> void:
	var raw := Fx.card("silla-peak", "silla", "peak")
	raw["difficulty"] = 3.0
	var card := CardData.from_dict(raw)
	assert_int(card.difficulty).is_equal(3)
	assert_int(card.clues[2]["level"]).is_equal(3)


func test_resolve_path_dev_mode_falls_back_to_fixture() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	var only_fixture := func(p: String) -> bool: return p == cfg.dev_fallback_cards_path
	assert_str(CardLoader.resolve_path(cfg, false, only_fixture)).is_equal(cfg.dev_fallback_cards_path)


func test_resolve_path_release_mode_never_uses_fixture() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	var only_fixture := func(p: String) -> bool: return p == cfg.dev_fallback_cards_path
	assert_str(CardLoader.resolve_path(cfg, true, only_fixture)).is_equal(cfg.cards_path)


func test_resolve_path_prefers_real_cards_file() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	var all_exist := func(_p: String) -> bool: return true
	assert_str(CardLoader.resolve_path(cfg, false, all_exist)).is_equal(cfg.cards_path)
