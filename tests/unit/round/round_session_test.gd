extends GdUnitTestSuite
## RoundSession: 단서 공개, 배치 판정, 먹물, 오답 시 정답 공개와 카드 소모, 클리어/실패.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


## 정해진 순서의 카드로 라운드를 만든다(난수 없음).
func _session(card_ids: Array, start_ink: int = 5) -> RoundSession:
	var cs := CardLoader.build(Fx.valid_set(), Fx.nation_ids(), Fx.era_ids(), false)
	var queue: Array[CardData] = []
	for id: String in card_ids:
		queue.append(cs.get_card(id))
	return RoundSession.new(queue, start_ink, Fx.nation_ids(), Fx.era_ids())


func test_new_round_shows_only_first_clue() -> void:
	var s := _session(["silla-peak"])
	assert_int(s.revealed_clues).is_equal(1)
	assert_int(s.visible_clues().size()).is_equal(1)
	assert_str(s.visible_clues()[0]["kind"]).is_equal("description")


func test_reveal_more_opens_up_to_three_clues() -> void:
	var s := _session(["silla-peak"])
	assert_bool(s.reveal_more()).is_true()
	assert_bool(s.reveal_more()).is_true()
	assert_bool(s.reveal_more()).is_false()
	assert_int(s.visible_clues().size()).is_equal(3)
	assert_int(s.hints_used).is_equal(2)


func test_correct_placement_keeps_ink_and_fills_cell() -> void:
	# Arrange
	var s := _session(["silla-peak", "gaya-ending"])
	# Act
	var r := s.place_current("silla", "peak")
	# Assert
	assert_bool(r["accepted"]).is_true()
	assert_bool(r["correct"]).is_true()
	assert_int(s.ink.current).is_equal(5)
	assert_str(s.cell_occupant("silla", "peak")["card_id"]).is_equal("silla-peak")
	assert_str(s.current_card().id).is_equal("gaya-ending")


func test_wrong_placement_spends_ink_and_reveals_answer_cell() -> void:
	var s := _session(["silla-peak", "gaya-ending"])
	var r := s.place_current("baekje", "founding")
	assert_bool(r["accepted"]).is_true()
	assert_bool(r["correct"]).is_false()
	assert_int(s.ink.current).is_equal(4)
	# 정답 칸에 공개된다.
	assert_str(r["answer_nation"]).is_equal("silla")
	assert_str(r["answer_era"]).is_equal("peak")
	assert_str(s.cell_occupant("silla", "peak")["card_id"]).is_equal("silla-peak")
	assert_bool(s.cell_occupant("silla", "peak")["correct"]).is_false()
	# 고른 칸은 비어 있다.
	assert_dict(s.cell_occupant("baekje", "founding")).is_empty()


func test_wrong_placement_consumes_card() -> void:
	var s := _session(["silla-peak", "gaya-ending"])
	s.place_current("baekje", "founding")
	assert_str(s.current_card().id).is_equal("gaya-ending")
	assert_int(s.placed_count()).is_equal(1)


func test_next_card_starts_from_first_clue_again() -> void:
	var s := _session(["silla-peak", "gaya-ending"])
	s.reveal_more()
	s.reveal_more()
	s.place_current("silla", "peak")
	assert_int(s.revealed_clues).is_equal(1)


func test_occupied_cell_is_rejected_without_ink_loss() -> void:
	var s := _session(["silla-peak", "gaya-ending"])
	s.place_current("silla", "peak")
	var r := s.place_current("silla", "peak")
	assert_bool(r["accepted"]).is_false()
	assert_str(r["reason"]).is_equal(RoundSession.REJECT_OCCUPIED)
	assert_int(s.ink.current).is_equal(5)
	assert_str(s.current_card().id).is_equal("gaya-ending")


func test_unknown_cell_is_rejected() -> void:
	var s := _session(["silla-peak"])
	var r := s.place_current("goryeo", "peak")
	assert_bool(r["accepted"]).is_false()
	assert_str(r["reason"]).is_equal(RoundSession.REJECT_INVALID_CELL)
	assert_int(s.ink.current).is_equal(5)


func test_placing_all_cards_with_ink_left_clears_round() -> void:
	var s := _session(["silla-peak", "gaya-ending"])
	s.place_current("silla", "peak")
	s.place_current("goguryeo", "founding")  # 오답이어도 먹물이 남으면 계속
	assert_int(s.status).is_equal(RoundSession.Status.CLEARED)
	assert_object(s.current_card()).is_null()


func test_ink_reaching_zero_fails_round() -> void:
	var s := _session(["silla-peak", "gaya-ending", "baekje-peak"], 2)
	s.place_current("goguryeo", "founding")
	assert_int(s.status).is_equal(RoundSession.Status.PLAYING)
	s.place_current("goguryeo", "founding")
	assert_int(s.status).is_equal(RoundSession.Status.FAILED)
	assert_int(s.ink.current).is_equal(0)


func test_last_card_wrong_with_last_ink_fails_round() -> void:
	var s := _session(["silla-peak"], 1)
	s.place_current("goguryeo", "founding")
	assert_int(s.status).is_equal(RoundSession.Status.FAILED)


func test_placement_after_round_over_is_rejected() -> void:
	var s := _session(["silla-peak"])
	s.place_current("silla", "peak")
	var r := s.place_current("gaya", "ending")
	assert_bool(r["accepted"]).is_false()
	assert_str(r["reason"]).is_equal(RoundSession.REJECT_ROUND_OVER)


func test_full_twelve_card_round_all_correct_clears() -> void:
	var ids: Array = []
	for n: String in Fx.NATIONS:
		for e: String in Fx.ERAS:
			ids.append(Fx.cell_card_id(n, e))
	var s := _session(ids)
	for n: String in Fx.NATIONS:
		for e: String in Fx.ERAS:
			s.place_current(n, e)
	assert_int(s.status).is_equal(RoundSession.Status.CLEARED)
	assert_int(s.correct_count).is_equal(12)
	assert_int(s.ink.current).is_equal(5)


func test_history_records_clues_seen() -> void:
	var s := _session(["silla-peak"])
	s.reveal_more()
	s.place_current("silla", "peak")
	assert_int(s.history[0]["clues_seen"]).is_equal(2)
	assert_bool(s.history[0]["correct"]).is_true()
