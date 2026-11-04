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
