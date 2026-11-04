extends GdUnitTestSuite
## TutorialSession과 TutorialData: 먹물 없는 연습, 본 덱과 겹치지 않는 연습 카드.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func _deck() -> CardSet:
	return CardLoader.build(Fx.valid_set(), Fx.nation_ids(), Fx.era_ids(), false)


func _config() -> GameConfig:
	return GameConfig.from_dict(Fx.config_dict())


func _tutorial_text(card_id: String, title_override: String = "") -> String:
	var c := Fx.card(card_id, "goguryeo", "peak")
	if not title_override.is_empty():
		c["title"] = title_override
	return JSON.stringify({"anchor_id": Fx.ANCHOR_ID, "cards": [c]})


func test_session_correct_placement_solves() -> void:
	var t := TutorialSession.new(_deck().get_card("silla-peak"))
	assert_bool(t.place("silla", "peak")).is_true()
	assert_bool(t.solved).is_true()


func test_session_wrong_placement_reveals_all_clues_without_solving() -> void:
	var t := TutorialSession.new(_deck().get_card("silla-peak"))
	assert_bool(t.place("gaya", "ending")).is_false()
	assert_int(t.wrong_tries).is_equal(1)
	assert_int(t.revealed_clues).is_equal(3)
	assert_bool(t.solved).is_false()


func test_data_parses_separate_practice_card() -> void:
	var t := TutorialData.parse(_tutorial_text("practice-01"), _deck(), _config())
	assert_array(t.errors).is_empty()
	assert_str(t.card.id).is_equal("practice-01")
	assert_str(t.anchor.id).is_equal(Fx.ANCHOR_ID)


func test_data_rejects_card_id_already_in_deck() -> void:
	var t := TutorialData.parse(_tutorial_text("silla-peak"), _deck(), _config())
	assert_bool(t.is_valid()).is_false()


func test_data_rejects_title_already_in_deck() -> void:
	var t := TutorialData.parse(_tutorial_text("practice-01", "제목 silla-peak"), _deck(), _config())
	assert_bool(t.is_valid()).is_false()


func test_data_rejects_unknown_anchor() -> void:
	var text := JSON.stringify({"anchor_id": "nope", "cards": [Fx.card("practice-01", "goguryeo", "peak")]})
	assert_bool(TutorialData.parse(text, _deck(), _config()).is_valid()).is_false()


func test_release_mode_skips_unverified_practice_card() -> void:
	# 리뷰 2 N2: 출시 모드는 본 덱처럼 verified && !disputed 연습 카드만 쓴다.
	var c := Fx.card("practice-01", "goguryeo", "peak")
	c["verified"] = false
	c["verified_by"] = null
	var text := JSON.stringify({"anchor_id": Fx.ANCHOR_ID, "cards": [c]})
	assert_bool(TutorialData.parse(text, _deck(), _config(), true).is_valid()).is_false()
	assert_bool(TutorialData.parse(text, _deck(), _config(), false).is_valid()).is_true()


func test_release_mode_accepts_verified_practice_card() -> void:
	var t := TutorialData.parse(_tutorial_text("practice-01"), _deck(), _config(), true)
	assert_bool(t.is_valid()).is_true()


func test_board_anchors_include_main_anchor() -> void:
	var t := TutorialData.parse(_tutorial_text("practice-01"), _deck(), _config())
	assert_int(t.board_anchors.size()).is_equal(1)
	assert_str(t.board_anchors[0].id).is_equal(Fx.ANCHOR_ID)


func test_disputed_anchor_id_is_rejected() -> void:
	var cards := Fx.valid_set()
	var extra := Fx.anchor("anchor-disputed", "silla", "peak")
	extra["disputed"] = true
	extra["disputed_note"] = "견해가 나뉜다."
	# disputed 기준 카드는 검증 규칙 6에서 걸리므로 CardSet을 직접 만든다.
	var deck := CardSet.new()
	for raw: Dictionary in cards:
		deck.add(CardData.from_dict(raw))
	deck.add(CardData.from_dict(extra))
	var text := JSON.stringify({"anchor_id": "anchor-disputed", "cards": [Fx.card("practice-01", "silla", "peak", "anchor-disputed")]})
	assert_bool(TutorialData.parse(text, deck, _config()).is_valid()).is_false()
