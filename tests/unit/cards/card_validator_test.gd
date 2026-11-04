extends GdUnitTestSuite
## CardValidator: design/card-data-schema.md 검증 규칙 0~8.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func _validate(cards: Array) -> Array[int]:
	return CardValidator.rules_of(CardValidator.validate(cards, Fx.nation_ids(), Fx.era_ids()))


func test_valid_set_has_no_errors() -> void:
	# Arrange
	var cards := Fx.valid_set()
	# Act
	var errors := CardValidator.validate(cards, Fx.nation_ids(), Fx.era_ids())
	# Assert
	assert_array(errors).is_empty()


func test_rule0_missing_title_reports_schema_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak").erase("title")
	assert_array(_validate(cards)).contains([CardValidator.RULE_SCHEMA])


func test_rule0_non_dictionary_card_reports_schema_error() -> void:
	var cards := Fx.valid_set()
	cards.append("not a card")
	assert_array(_validate(cards)).contains([CardValidator.RULE_SCHEMA])


func test_rule0_difficulty_out_of_range_reports_schema_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["difficulty"] = 4
	assert_array(_validate(cards)).contains([CardValidator.RULE_SCHEMA])


func test_rule0_float_difficulty_from_json_is_accepted() -> void:
	# JSON 숫자는 float으로 읽힌다. 2.0은 정수로 본다.
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["difficulty"] = 2.0
	assert_array(_validate(cards)).is_empty()


func test_rule1_duplicate_id_reports_error() -> void:
	var cards := Fx.valid_set()
	cards.append(Fx.card("silla-peak", "silla", "peak"))
	assert_array(_validate(cards)).contains([CardValidator.RULE_UNIQUE_ID])


func test_rule2_unknown_nation_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["answer"] = {"nation": "goryeo", "era": "peak"}
	assert_array(_validate(cards)).contains([CardValidator.RULE_ANSWER])


func test_rule2_unknown_era_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["answer"] = {"nation": "silla", "era": "late"}
	assert_array(_validate(cards)).contains([CardValidator.RULE_ANSWER])


func test_rule3_two_clues_reports_error() -> void:
	var cards := Fx.valid_set()
	(Fx.find(cards, "silla-peak")["clues"] as Array).pop_back()
	assert_array(_validate(cards)).contains([CardValidator.RULE_CLUES])


func test_rule3_levels_out_of_order_reports_error() -> void:
	var cards := Fx.valid_set()
	var clues: Array = Fx.find(cards, "silla-peak")["clues"]
	clues[0]["level"] = 2
	clues[1]["level"] = 1
	assert_array(_validate(cards)).contains([CardValidator.RULE_CLUES])


func test_rule3_wrong_kind_for_level_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["clues"][2]["kind"] = "relation"
	assert_array(_validate(cards)).contains([CardValidator.RULE_CLUES])


func test_rule3_anchor_with_clues_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, Fx.ANCHOR_ID)["clues"] = [{"level": 1, "kind": "description", "text": "x", "refs": []}]
	assert_array(_validate(cards)).contains([CardValidator.RULE_CLUES])


func test_rule4_ref_to_missing_id_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["clues"][1]["refs"] = ["no-such-card"]
	assert_array(_validate(cards)).contains([CardValidator.RULE_RELATION_REFS])


func test_rule4_ref_to_non_anchor_reports_error() -> void:
	# 카드 순서가 무작위라 일반 카드를 참조하면 그 카드가 먼저 놓인다는 보장이 없다.
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["clues"][1]["refs"] = ["silla-founding"]
	assert_array(_validate(cards)).contains([CardValidator.RULE_RELATION_REFS])


func test_rule4_relation_without_refs_reports_error() -> void:
	var cards := Fx.valid_set()
	Fx.find(cards, "silla-peak")["clues"][1]["refs"] = []
	assert_array(_validate(cards)).contains([CardValidator.RULE_RELATION_REFS])


func test_rule5_title_in_first_clue_reports_error() -> void:
	var cards := Fx.valid_set()
	var c := Fx.find(cards, "silla-peak")
	c["clues"][0]["text"] = "이것은 %s 이야기다." % c["title"]
	assert_array(_validate(cards)).contains([CardValidator.RULE_TITLE_IN_FIRST_CLUE])


func test_rule5_title_in_third_clue_is_allowed() -> void:
	var cards := Fx.valid_set()
	var c := Fx.find(cards, "silla-peak")
	c["clues"][2]["text"] = "정답은 %s." % c["title"]
	assert_array(_validate(cards)).is_empty()


func test_rule6_disputed_without_note_reports_error() -> void:
	var cards := Fx.valid_set()
	var extra := Fx.card("gaya-peak-disputed", "gaya", "peak")
	extra["disputed"] = true
	cards.append(extra)
	assert_array(_validate(cards)).contains([CardValidator.RULE_DISPUTED_NOTE])


func test_rule6_disputed_with_note_passes() -> void:
	var cards := Fx.valid_set()
	var extra := Fx.card("gaya-peak-disputed", "gaya", "peak")
	extra["disputed"] = true
	extra["disputed_note"] = "견해가 나뉜다."
	cards.append(extra)
	assert_array(_validate(cards)).is_empty()


func test_rule7_image_without_license_reports_error() -> void:
	var cards := Fx.valid_set()
	var c := Fx.find(cards, "silla-peak")
	c["image"] = "assets/art/cards/silla-peak.png"
	c["image_source"] = "국립중앙박물관"
	assert_array(_validate(cards)).contains([CardValidator.RULE_IMAGE_CREDITS])


func test_rule7_image_with_source_and_license_passes() -> void:
	var cards := Fx.valid_set()
	var c := Fx.find(cards, "silla-peak")
	c["image"] = "assets/art/cards/silla-peak.png"
	c["image_source"] = "국립중앙박물관"
	c["image_license"] = "공공누리 제1유형"
	assert_array(_validate(cards)).is_empty()


func test_rule8_empty_cell_reports_error() -> void:
	var cards := Fx.valid_set()
	cards.erase(Fx.find(cards, "gaya-ending"))
	var errors := CardValidator.validate(cards, Fx.nation_ids(), Fx.era_ids())
	assert_array(CardValidator.rules_of(errors)).contains([CardValidator.RULE_CELL_COVERAGE])
	assert_str(errors[0]["id"]).is_equal("gaya/ending")


func test_rule8_cell_with_only_disputed_card_reports_error() -> void:
	var cards := Fx.valid_set()
	var c := Fx.find(cards, "gaya-peak")
	c["disputed"] = true
	c["disputed_note"] = "견해가 나뉜다."
	assert_array(_validate(cards)).contains([CardValidator.RULE_CELL_COVERAGE])


func test_rule8_anchor_does_not_count_for_its_cell() -> void:
	# goguryeo/peak에는 기준 카드가 있지만 판정 대상 카드가 없으면 오류다.
	var cards := Fx.valid_set()
	cards.erase(Fx.find(cards, "goguryeo-peak"))
	assert_array(_validate(cards)).contains([CardValidator.RULE_CELL_COVERAGE])
