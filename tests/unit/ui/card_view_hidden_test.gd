extends GdUnitTestSuite
## 숨김 상태 카드는 유형을 보이지 않는다(decision-log D37, 아트 바이블 §3).
## CardView의 정적 함수만 쓴다(노드를 만들지 않는다).

const Fx = preload("res://tests/fixtures/card_fixtures.gd")
const TYPES := ["event", "artifact", "person", "myth"]


func _card(card_type: String) -> CardData:
	var raw := Fx.card("silla-peak", "silla", "peak")
	raw["type"] = card_type
	return CardData.from_dict(raw)


func test_hidden_texts_are_identical_for_every_type() -> void:
	# Arrange: 유형만 다른 같은 카드
	var base := _card("event")
	var expected := CardView.hidden_texts(base, base.clues)
	for t: String in TYPES:
		var c := _card(t)
		# Act / Assert
		assert_array(Array(CardView.hidden_texts(c, c.clues))).is_equal(Array(expected))


func test_hidden_texts_contain_no_type_badge() -> void:
	for t: String in TYPES:
		var c := _card(t)
		var joined := "\n".join(CardView.hidden_texts(c, c.clues))
		for other: String in TYPES:
			if other == "event":
				continue  # 숨김 제목 "? 사건 카드"는 모든 카드에 같다(바이블 §7)
			assert_str(joined).not_contains(HanjiTheme.type_label(other))


func test_hidden_texts_do_not_show_title() -> void:
	var c := _card("myth")
	assert_str("\n".join(CardView.hidden_texts(c, c.clues))).not_contains(c.title)


func test_hidden_heading_is_shared_constant() -> void:
	var c := _card("artifact")
	var no_clues: Array[Dictionary] = []
	assert_str(CardView.hidden_texts(c, no_clues)[0]).is_equal(CardView.HIDDEN_HEADING)
