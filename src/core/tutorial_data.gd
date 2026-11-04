class_name TutorialData
extends RefCounted
## 튜토리얼 전용 연습 카드. 본 덱과 겹치지 않는 카드를 따로 읽는다(decision-log D23).
##
## 파일 형식(assets/data/cards/tutorial.json):
##   { "anchor_id": "<본 덱 기준 카드 id>", "cards": [ <카드 스키마 v1 객체>, ... ] }
## 연습 카드는 카드 스키마 v1과 검증 규칙을 따르되, 칸 채움(규칙 8)은 보지 않는다.
## tools/validate_cards.py --tutorial 의 T1~T5와 같은 조건:
##   T1 최상위 {anchor_id, cards}, T2 anchor_id는 본 덱의 disputed 아닌 기준 카드,
##   T3 카드별 규칙(규칙 8 제외), T4 연습 카드 id·제목이 본 덱과 겹치지 않음,
##   T5 relation 단서는 본 덱의 기준 카드만 가리킴(다른 연습 카드를 가리키지 않음).
## 출시 모드에서는 본 덱과 같이 verified && !disputed 연습 카드만 쓴다(규칙 9, 리뷰 2 N2).
##
## 사용 예:
##   var t := TutorialData.parse(text, card_set, cfg, card_set.release_mode)
##   if t.is_valid(): TutorialSession.new(t.card)

## 튜토리얼 규칙 위반에 쓰는 규칙 번호(카드 검증 규칙과 겹치지 않게 100번대).
const RULE_TUTORIAL := 100

## 튜토리얼의 중심 기준 카드(anchor_id, 본 덱의 카드).
var anchor: CardData
## 보드에 보일 기준 카드: anchor와, 연습 카드가 relation으로 가리키는 다른 기준 카드.
var board_anchors: Array[CardData] = []
## 연습 카드(첫 번째 카드).
var card: CardData
## CardValidator 오류 형식.
var errors: Array[Dictionary] = []


## 오류 없이 읽혔는지.
func is_valid() -> bool:
	return errors.is_empty() and anchor != null and card != null


## JSON 문자열에서 만든다. main: 본 덱(이미 검증된 CardSet).
## release_mode: true면 출시 모드 필터(CardLoader.filter_for_mode)를 연습 카드에도 적용한다.
static func parse(text: String, main: CardSet, config: GameConfig, release_mode: bool = false) -> TutorialData:
	var t := TutorialData.new()
	var data: Variant = JSON.parse_string(text)
	if not (data is Dictionary):
		t._fail("튜토리얼 파일이 객체가 아니거나 JSON이 깨졌다")
		return t
	var anchor_id: Variant = data.get("anchor_id")
	if not (anchor_id is String) or main.get_card(anchor_id) == null or not main.get_card(anchor_id).anchor or main.get_card(anchor_id).disputed:
		t._fail("anchor_id가 본 덱의 기준 카드가 아니다: %s" % str(anchor_id))
		return t
	var raw_cards: Variant = data.get("cards")
	if not (raw_cards is Array) or (raw_cards as Array).is_empty():
		t._fail("튜토리얼 카드가 없다")
		return t
	raw_cards = CardLoader.filter_for_mode(raw_cards, release_mode)
	if (raw_cards as Array).is_empty():
		t._fail("출시 모드에서 쓸 수 있는(사실 확인된) 연습 카드가 없다")
		return t
	var a := main.get_card(anchor_id)
	# 본 덱의 기준 카드를 함께 넣어 규칙 4(relation → 기준 카드)를 검사한다. 규칙 8은 뺀다.
	var raw: Array = []
	for deck_anchor: CardData in main.anchors:
		raw.append(_anchor_stub(deck_anchor))
	raw.append_array(raw_cards)
	for e: Dictionary in CardValidator.validate(raw, config.nation_ids(), config.era_ids(), config.nation_label_map(), config.era_label_map()):
		if int(e["rule"]) != CardValidator.RULE_CELL_COVERAGE:
			t.errors.append(e)
	var titles: Dictionary = {}
	for c: CardData in main.all_cards:
		titles[c.title] = true
	for item: Variant in raw_cards:
		if not (item is Dictionary):
			continue
		var id: Variant = item.get("id")
		if id is String and main.has_card(id):
			t._fail("연습 카드 id가 본 덱과 겹친다: %s" % id)
		var title: Variant = item.get("title")
		if title is String and titles.has(title):
			t._fail("연습 카드 제목이 본 덱과 겹친다: %s" % title)
		if typeof(item.get("anchor")) == TYPE_BOOL and item.get("anchor"):
			t._fail("연습 카드는 기준 카드일 수 없다")
	if not t.errors.is_empty():
		return t
	t.anchor = a
	t.card = CardData.from_dict(raw_cards[0])
	t.board_anchors.append(a)
	for clue: Dictionary in t.card.clues:
		for ref: String in clue["refs"]:
			var target := main.get_card(ref)
			if target != null and target.anchor and not t.board_anchors.has(target):
				t.board_anchors.append(target)
	if not t.card.is_judgeable():
		t._fail("연습 카드는 판정 카드여야 한다(disputed 아님)")
		t.card = null
	return t


func _fail(message: String) -> void:
	errors.append({"rule": RULE_TUTORIAL, "id": "(tutorial)", "message": message})


## 검증용 기준 카드 딕셔너리(본 덱 CardData에서 만든다).
static func _anchor_stub(a: CardData) -> Dictionary:
	return {
		"id": a.id, "type": a.type, "title": a.title, "anchor": true,
		"answer": {"nation": a.nation, "era": a.era}, "clues": [],
		"explanation": a.explanation, "source": {"name": a.source_name, "url": null, "note": ""},
		"verified": false, "verified_by": null, "disputed": false, "disputed_note": null,
		"difficulty": a.difficulty, "image": null, "image_source": null, "image_license": null,
	}
