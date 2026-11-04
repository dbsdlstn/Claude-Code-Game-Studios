extends GdUnitTestSuite
## 숨김 상태 카드는 유형을 보이지 않는다(decision-log D37, 아트 바이블 §3, 리뷰 3 P1).
## 실제 CardView 노드를 만들어 show_card 뒤 보이는 글(Label·Button·툴팁)을 모두 모아 비교한다.
## 유형마다 새 노드를 만든다(queue_free로 지운 단서 줄이 같은 프레임에 남지 않게).

const Fx = preload("res://tests/fixtures/card_fixtures.gd")
const UiTexts = preload("res://tests/fixtures/ui_texts.gd")
const TYPES := ["event", "artifact", "person", "myth"]


func _card(card_type: String) -> CardData:
	var raw := Fx.card("silla-peak", "silla", "peak")
	raw["type"] = card_type
	return CardData.from_dict(raw)


func _shown_texts(c: CardData) -> PackedStringArray:
	var view: CardView = auto_free(CardView.new())
	view.set_ref_titles({Fx.ANCHOR_ID: Fx.anchor_title(Fx.ANCHOR_ID)})
	view.show_card(c, c.clues, true)
	return UiTexts.visible_texts(view)


func test_shown_card_texts_do_not_depend_on_type() -> void:
	# Arrange / Act
	var expected := _shown_texts(_card("event"))
	# Assert
	for t: String in TYPES:
		assert_array(Array(_shown_texts(_card(t)))).is_equal(Array(expected))


func test_shown_card_has_no_type_word() -> void:
	# 숨김 제목도 예외 없이 검사한다(바이블 §7 "? 이름 숨김": 유형을 암시하는 말 금지).
	for t: String in TYPES:
		for s: String in _shown_texts(_card(t)):
			for label: String in HanjiTheme.TYPE_LABELS.values():
				assert_str(s).not_contains(label)


func test_hidden_heading_follows_art_bible() -> void:
	assert_str(CardView.HIDDEN_HEADING).is_equal("? 이름 숨김")


func test_shown_card_has_no_title_nation_or_era() -> void:
	var c := _card("myth")
	var joined := "\n".join(_shown_texts(c))
	assert_str(joined).not_contains(c.title)
	for word: String in ["신라", "전성기"]:
		assert_str(joined).not_contains(word)


func test_shown_card_includes_hidden_heading_question_mark_and_ref_button() -> void:
	var texts := _shown_texts(_card("artifact"))
	assert_array(Array(texts)).contains([CardView.HIDDEN_HEADING, "?", CardView.ref_button_text(Fx.anchor_title(Fx.ANCHOR_ID))])


func test_texts_helper_sees_a_type_leak() -> void:
	# 검사 도구 자체 확인: 유형 글자를 넣으면 실제로 잡힌다(테스트가 항상 통과하지 않음을 보인다).
	var view: CardView = auto_free(CardView.new())
	var c := _card("myth")
	view.show_card(c, c.clues, true)
	var leak := Label.new()
	leak.text = HanjiTheme.type_label("myth")
	view.add_child(leak)
	assert_array(Array(UiTexts.visible_texts(view))).contains([HanjiTheme.type_label("myth")])
