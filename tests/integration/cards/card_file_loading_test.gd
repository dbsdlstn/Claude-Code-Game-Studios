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
	var cs := CardLoader.load_file(FIXTURE_PATH, cfg.nation_ids(), cfg.era_ids(), false)
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


func test_content_file_passes_validation_in_dev_mode_when_present() -> void:
	# 콘텐츠 세션이 samguk.json을 만드는 중이다. 파일이 생기면 이 테스트가 그 파일을 검증한다.
	var cfg := GameConfig.load_file(CONFIG_PATH)
	if not FileAccess.file_exists(cfg.cards_path):
		push_warning("samguk.json이 아직 없다: %s" % cfg.cards_path)
		return
	var cs := CardLoader.load_file(cfg.cards_path, cfg.nation_ids(), cfg.era_ids(), false)
	assert_array(cs.errors).is_empty()
