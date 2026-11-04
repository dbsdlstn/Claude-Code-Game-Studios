extends GdUnitTestSuite
## GameConfig: 설정 딕셔너리 읽기와 로드 모드.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func test_from_dict_reads_axes_in_order() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	assert_bool(cfg.is_valid()).is_true()
	assert_array(Array(cfg.nation_ids())).is_equal(["goguryeo", "baekje", "silla", "gaya"])
	assert_array(Array(cfg.era_ids())).is_equal(["founding", "peak", "ending"])
	assert_int(cfg.start_ink).is_equal(5)


func test_era_definition_is_available_for_header() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	assert_str(cfg.era_label("ending")).is_equal("결말기")
	assert_str(cfg.era_definition("ending")).is_equal("멸망·통일로 이어지는 마지막 전쟁기")


func test_missing_era_definition_reports_error() -> void:
	var d := Fx.config_dict()
	(d["eras"][0] as Dictionary).erase("definition")
	assert_bool(GameConfig.from_dict(d).is_valid()).is_false()


func test_zero_start_ink_reports_error() -> void:
	assert_bool(GameConfig.from_dict(Fx.config_dict(0)).is_valid()).is_false()


func test_release_build_forces_release_mode() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	assert_bool(cfg.effective_release_mode(true)).is_false()
	assert_bool(cfg.effective_release_mode(false)).is_true()


func test_release_mode_setting_applies_in_debug_build() -> void:
	var d := Fx.config_dict()
	d["release_mode"] = true
	assert_bool(GameConfig.from_dict(d).effective_release_mode(true)).is_true()


func test_label_maps_follow_config() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	assert_str(cfg.nation_label_map()["silla"]).is_equal("신라")
	assert_str(cfg.era_label_map()["peak"]).is_equal("전성기")


func test_ui_font_path_is_optional() -> void:
	var cfg := GameConfig.from_dict(Fx.config_dict())
	assert_bool(cfg.is_valid()).is_true()
	assert_str(cfg.ui_font_path).is_empty()
