extends GdUnitTestSuite
## ProgressData: 도감 수집과 저장 딕셔너리 변환(파일 없음).


func test_collect_adds_once() -> void:
	var p := ProgressData.new()
	assert_bool(p.collect("silla-peak")).is_true()
	assert_bool(p.collect("silla-peak")).is_false()
	assert_bool(p.is_collected("silla-peak")).is_true()


func test_to_dict_and_back_keeps_data() -> void:
	# Arrange
	var p := ProgressData.new()
	p.collect("b-card")
	p.collect("a-card")
	p.record_round(true)
	p.record_round(false)
	# Act
	var restored := ProgressData.from_dict(JSON.parse_string(JSON.stringify(p.to_dict())))
	# Assert
	assert_bool(restored.is_collected("a-card")).is_true()
	assert_bool(restored.is_collected("b-card")).is_true()
	assert_int(restored.rounds_played).is_equal(2)
	assert_int(restored.rounds_cleared).is_equal(1)
	assert_int(restored.rounds_failed).is_equal(1)


func test_to_dict_stores_sorted_card_ids() -> void:
	var p := ProgressData.new()
	p.collect("b-card")
	p.collect("a-card")
	assert_array(p.to_dict()["collected"]).is_equal(["a-card", "b-card"])


func test_from_dict_ignores_bad_values() -> void:
	var p := ProgressData.from_dict({"collected": ["ok", 3, null], "rounds_played": "x"})
	assert_int(p.collected.size()).is_equal(1)
	assert_int(p.rounds_played).is_equal(0)


func test_count_in_counts_only_listed_ids() -> void:
	var p := ProgressData.new()
	p.collect("a")
	p.collect("stale-id")
	assert_int(p.count_in(PackedStringArray(["a", "b"]))).is_equal(1)


func test_is_complete_when_all_judged_cards_collected() -> void:
	# 게임 클리어(D16): 판정 카드를 모두 모으면 도감 완성.
	var p := ProgressData.new()
	var ids := PackedStringArray(["a", "b"])
	p.collect("a")
	assert_bool(p.is_complete(ids)).is_false()
	p.collect("b")
	assert_bool(p.is_complete(ids)).is_true()


func test_is_complete_false_for_empty_list() -> void:
	assert_bool(ProgressData.new().is_complete(PackedStringArray())).is_false()


func _summary(cleared: bool, correct: int, levels: Array) -> Dictionary:
	return {"cleared": cleared, "correct": correct, "clue_levels": levels}


func test_record_round_result_accumulates_play_log() -> void:
	var p := ProgressData.new()
	p.current_round = {"version": 1}
	p.record_round_result(_summary(true, 3, [1, 2, 3, 1]), ["a"])
	p.record_round_result(_summary(false, 1, [3, 3]), [])
	var st := p.stats()
	assert_int(st["rounds"]).is_equal(2)
	assert_int(st["cleared"]).is_equal(1)
	assert_int(st["failed"]).is_equal(1)
	assert_float(st["accuracy"]).is_equal_approx(4.0 / 6.0, 0.0001)
	assert_float(st["avg_clue_level"]).is_equal_approx(13.0 / 6.0, 0.0001)
	assert_bool(p.has_current_round()).is_false()


func test_stats_without_rounds_are_negative() -> void:
	var st := ProgressData.new().stats()
	assert_int(st["rounds"]).is_equal(0)
	assert_float(st["accuracy"]).is_equal(-1.0)


func test_v2_fields_round_trip_through_json() -> void:
	var p := ProgressData.new()
	p.tutorial_done = true
	p.current_round = {"version": 1, "card_ids": ["a"]}
	p.record_round_result(_summary(true, 1, [2]), ["a"])
	p.current_round = {"version": 1, "card_ids": ["b"]}
	var r := ProgressData.from_dict(JSON.parse_string(JSON.stringify(p.to_dict())))
	assert_bool(r.tutorial_done).is_true()
	assert_int(r.round_log.size()).is_equal(1)
	assert_array(r.round_log[0]["new_ids"]).is_equal(["a"])
	assert_array(r.current_round["card_ids"]).is_equal(["b"])


func test_v1_save_loads_with_defaults() -> void:
	var r := ProgressData.from_dict({"version": 1, "collected": ["a"], "rounds_played": 2})
	assert_bool(r.is_collected("a")).is_true()
	assert_bool(r.tutorial_done).is_false()
	assert_int(r.round_log.size()).is_equal(0)
	assert_bool(r.has_current_round()).is_false()


func test_v1_rounds_count_in_stats_without_details() -> void:
	# 리뷰 2 L1: 라운드 수는 rounds_played 하나에서 나온다. v1 라운드는 세부 기록이 없다.
	var r := ProgressData.from_dict({"version": 1, "rounds_played": 2, "rounds_cleared": 1, "rounds_failed": 1})
	var st := r.stats()
	assert_int(st["rounds"]).is_equal(2)
	assert_int(st["logged_rounds"]).is_equal(0)
	assert_float(st["accuracy"]).is_equal(-1.0)


func test_rounds_played_is_never_below_logged_rounds() -> void:
	var r := ProgressData.from_dict({"version": 2, "rounds_played": 0, "round_log": [
		{"cleared": true, "correct": 1, "clue_levels": [1]}]})
	assert_int(r.stats()["rounds"]).is_equal(1)


func test_version_of_reads_number_or_defaults_to_one() -> void:
	assert_int(ProgressData.version_of({"version": 3.0})).is_equal(3)
	assert_int(ProgressData.version_of({})).is_equal(1)
