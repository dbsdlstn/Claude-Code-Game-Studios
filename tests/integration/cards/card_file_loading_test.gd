extends GdUnitTestSuite
## 실제 파일(설정, 픽스처, 콘텐츠)을 읽어 검증한다.

const CONFIG_PATH := "res://assets/data/config/game_config.json"
const FIXTURE_PATH := "res://tests/fixtures/cards_fixture.json"


func test_game_config_file_is_valid() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	assert_array(cfg.errors).is_empty()
	assert_int(cfg.nation_ids().size()).is_equal(4)
	assert_int(cfg.era_ids().size()).is_equal(3)


func test_fixture_file_passes_validation_in_dev_mode() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(FIXTURE_PATH, cfg, false)
	assert_array(cs.errors).is_empty()
	assert_int(cs.anchors.size()).is_equal(3)
	assert_int(cs.playable.size()).is_equal(12)
	assert_int(cs.disputed.size()).is_equal(1)


func test_fixture_file_in_release_mode_loads_nothing_playable() -> void:
	# 픽스처는 전부 verified: false라 출시 모드에서는 칸이 비어 규칙 8 오류가 난다.
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_file(FIXTURE_PATH, cfg.nation_ids(), cfg.era_ids(), true)
	assert_array(CardValidator.rules_of(cs.errors)).contains([CardValidator.RULE_CELL_COVERAGE])


func test_missing_file_reports_error() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_file("res://no/such/file.json", cfg.nation_ids(), cfg.era_ids(), false)
	assert_bool(cs.is_valid()).is_false()


## 실제 콘텐츠: 기준 4, disputed 4, 판정 36(칸당 3). tools/validate_cards.py 도 PASS다.
func test_samguk_json_passes_validation_in_dev_mode() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, false)
	assert_array(cs.errors).is_empty()
	assert_int(cs.all_cards.size()).is_equal(44)
	assert_int(cs.anchors.size()).is_equal(4)
	assert_int(cs.disputed.size()).is_equal(4)
	assert_int(cs.playable.size()).is_equal(36)
	assert_array(cs.warnings).is_empty()


func test_samguk_json_has_three_judged_cards_per_cell() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, false)
	for n in cfg.nation_ids():
		for e in cfg.era_ids():
			assert_int(cs.playable_for_cell(n, e).size()).is_equal(3)
			assert_int(cs.anchors_for_cell(n, e).size()).is_less_equal(1)


func test_samguk_json_release_mode_reports_only_coverage() -> void:
	# 아직 사실 확인된 카드가 없으면 출시 모드에서는 칸이 비어 규칙 8만 나온다.
	# 카드가 확인되기 시작하면 이 테스트는 "오류가 있으면 규칙 8뿐"을 확인한다.
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, true)
	for rule in CardValidator.rules_of(cs.errors):
		assert_int(rule).is_equal(CardValidator.RULE_CELL_COVERAGE)


func test_samguk_json_round_has_twelve_unique_cards() -> void:
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, false)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var queue := RoundBuilder.build_queue(cs, cfg.round_size, rng)
	var ids := {}
	for c: CardData in queue:
		ids[c.id] = true
		assert_bool(c.is_judgeable()).is_true()
	assert_int(queue.size()).is_equal(12)
	assert_int(ids.size()).is_equal(12)


func test_tutorial_file_is_valid_and_separate_from_deck() -> void:
	# 튜토리얼 연습 카드는 본 덱과 겹치지 않아야 한다(decision-log D23).
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, false)
	var t := TutorialData.parse(FileAccess.get_file_as_string(cfg.tutorial_path), cs, cfg)
	assert_array(t.errors).is_empty()
	assert_bool(t.is_valid()).is_true()
	assert_bool(cs.has_card(t.card.id)).is_false()
	assert_bool(t.anchor.anchor).is_true()


func test_placeholder_art_exists_for_every_card_type() -> void:
	# 공개 후 이미지가 없을 때 쓰는 대체 문양(아트 바이블 §7.1). import 전에는 원본 파일로 확인한다.
	for t: String in CardArt.KNOWN_TYPES:
		assert_bool(FileAccess.file_exists(CardArt.placeholder_path(t))).is_true()


func test_samguk_hidden_texts_do_not_depend_on_card_type() -> void:
	# D37: 숨김 상태의 글은 유형과 무관해야 한다. 실제 카드마다 유형을 바꿔도 글이 같아야 한다.
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var cs := CardLoader.load_with_config(cfg.cards_path, cfg, false)
	var refs := GameScreen.ref_titles(cs.anchors)
	for c: CardData in cs.playable:
		var before := CardView.hidden_texts(c, c.clues, refs)
		var saved_type := c.type
		c.type = "event" if saved_type != "event" else "myth"
		var after := CardView.hidden_texts(c, c.clues, refs)
		c.type = saved_type
		assert_array(Array(after)).is_equal(Array(before))
