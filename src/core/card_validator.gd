class_name CardValidator
extends RefCounted
## 카드 스키마 v1 검증. design/card-data-schema.md 의 검증 규칙과
## tools/validate_cards.py 의 규칙을 같은 술어로 구현한다(두 검증기는 같은 결과를 내야 한다).
## 입력은 JSON에서 읽은 그대로의 배열(딕셔너리 목록)이다. 파일을 읽지 않는다.
##
## 오류 하나는 { "rule": int, "id": String, "message": String } 이다.
## rule 0은 Python의 FIELD(필수 필드·타입·해설의 시기 라벨)다.
## 규칙 9의 "출시 모드 필터"는 CardLoader.filter_for_mode 가 맡고,
## 여기서는 "verified: true면 verified_by 필수"만 확인한다.
##
## 사용 예:
##   var errors := CardValidator.validate(raw, cfg.nation_ids(), cfg.era_ids(),
##       cfg.nation_label_map(), cfg.era_label_map())
##   if errors.is_empty(): ...

const RULE_SCHEMA := 0
const RULE_UNIQUE_ID := 1
const RULE_ANSWER := 2
const RULE_CLUES := 3
const RULE_RELATION_REFS := 4
const RULE_TITLE_IN_FIRST_CLUE := 5
const RULE_DISPUTED_NOTE := 6
const RULE_IMAGE_CREDITS := 7
const RULE_CELL_COVERAGE := 8
const RULE_RELEASE := 9

const CARD_TYPES := ["event", "artifact", "person", "myth"]
## level 1, 2, 3 에 대응하는 kind.
const CLUE_KINDS := ["description", "relation", "direct"]
## 값이 있으면 문자열이어야 하는 필드(null 허용).
const NULLABLE_STRING_FIELDS := [
	"explanation", "date_label", "verified_by", "disputed_note",
	"image", "image_source", "image_license",
]
## 목표 칸당 판정 카드 수. 모자라면 경고만 한다(warnings()).
const TARGET_PER_CELL := 3


## 카드 배열 전체를 검증하고 오류 목록을 돌려준다. 비어 있으면 통과.
## nation_labels / era_labels: { id: 표시 이름 }. 주면 1단계 단서의 나라·시기 라벨 금지와
## 해설의 시기 라벨 필수(decision-log D7)도 확인한다. 비우면 그 검사를 건너뛴다.
static func validate(
	raw: Array,
	nation_ids: PackedStringArray,
	era_ids: PackedStringArray,
	nation_labels: Dictionary = {},
	era_labels: Dictionary = {},
) -> Array[Dictionary]:
	var errors: Array[Dictionary] = []
	var cards: Array[Dictionary] = []
	var by_id: Dictionary = {}
	for i in raw.size():
		var item: Variant = raw[i]
		if not (item is Dictionary):
			errors.append(_err(RULE_SCHEMA, "#%d" % i, "카드가 객체가 아니다"))
			continue
		var card: Dictionary = item
		cards.append(card)
		var cid := _label(card, i)
		_check_schema(card, cid, era_labels, errors)
		var raw_id: Variant = card.get("id")
		if raw_id is String and not (raw_id as String).is_empty():
			if by_id.has(raw_id):
				errors.append(_err(RULE_UNIQUE_ID, cid, "id가 중복된다"))
			else:
				by_id[raw_id] = card

	var banned_words: Array = nation_labels.values() + era_labels.values()
	for i in cards.size():
		var card: Dictionary = cards[i]
		var cid := _label(card, i)
		var is_anchor := _is_true(card.get("anchor"))
		_check_answer(card, cid, nation_ids, era_ids, errors)
		_check_clues(card, cid, is_anchor, errors)
		if not is_anchor:
			_check_refs(card, cid, by_id, errors)
			_check_first_clue(card, cid, banned_words, errors)
		_check_disputed(card, cid, errors)
		_check_image(card, cid, errors)
		_check_release(card, cid, errors)

	_check_coverage(cards, nation_ids, era_ids, errors)
	return errors


## 오류는 아니지만 알릴 것: 칸당 판정 카드가 목표(3장)보다 적은 칸.
static func warnings(raw: Array, nation_ids: PackedStringArray, era_ids: PackedStringArray) -> Array[String]:
	var out: Array[String] = []
	var counts := cell_counts(raw)
	for n in nation_ids:
		for e in era_ids:
			var k := int(counts.get(CardData.make_cell_key(n, e), 0))
			if k > 0 and k < TARGET_PER_CELL:
				out.append("%s: 판정 카드 %d장(목표 %d)" % [CardData.make_cell_key(n, e), k, TARGET_PER_CELL])
	return out


## 칸 키("nation/era") → 판정 카드(anchor도 disputed도 아닌 카드) 수.
static func cell_counts(raw: Array) -> Dictionary:
	var counts: Dictionary = {}
	for item: Variant in raw:
		if not (item is Dictionary):
			continue
		var card: Dictionary = item
		if not _is_false(card.get("anchor")) or not _is_false(card.get("disputed")):
			continue
		var answer: Variant = card.get("answer")
		if not (answer is Dictionary):
			continue
		var n: Variant = answer.get("nation")
		var e: Variant = answer.get("era")
		if not (n is String) or not (e is String):
			continue
		var key := CardData.make_cell_key(n, e)
		counts[key] = int(counts.get(key, 0)) + 1
	return counts


## 오류 목록에서 규칙 번호만 뽑는다(테스트와 화면 표시용).
static func rules_of(errors: Array[Dictionary]) -> Array[int]:
	var out: Array[int] = []
	for e: Dictionary in errors:
		out.append(int(e["rule"]))
	return out


# --- 규칙 0: 필드와 타입 (Python FIELD) ------------------------------------

static func _check_schema(card: Dictionary, cid: String, era_labels: Dictionary, errors: Array[Dictionary]) -> void:
	if not _is_nonempty_str(card.get("id")):
		errors.append(_err(RULE_SCHEMA, cid, "id가 없다"))
	if not CARD_TYPES.has(card.get("type")):
		errors.append(_err(RULE_SCHEMA, cid, "type이 event/artifact/person/myth 중 하나가 아니다"))
	if not _is_nonempty_str(card.get("title")):
		errors.append(_err(RULE_SCHEMA, cid, "title이 없다"))
	for key: String in ["anchor", "verified", "disputed"]:
		if typeof(card.get(key)) != TYPE_BOOL:
			errors.append(_err(RULE_SCHEMA, cid, "%s가 bool이 아니다" % key))
	if not (card.get("answer") is Dictionary):
		errors.append(_err(RULE_SCHEMA, cid, "answer가 객체가 아니다"))
	if not (card.get("clues") is Array):
		errors.append(_err(RULE_SCHEMA, cid, "clues가 배열이 아니다"))
	for key: String in NULLABLE_STRING_FIELDS:
		var v: Variant = card.get(key)
		if typeof(v) != TYPE_NIL and not (v is String):
			errors.append(_err(RULE_SCHEMA, cid, "%s는 문자열이나 null이어야 한다" % key))
	if card.has("tags"):
		var tags: Variant = card.get("tags")
		var tags_ok := tags is Array
		if tags_ok:
			for t: Variant in tags:
				if not (t is String):
					tags_ok = false
		if not tags_ok:
			errors.append(_err(RULE_SCHEMA, cid, "tags는 문자열 배열이어야 한다"))
	_check_source(card.get("source"), cid, errors)
	var diff: Variant = card.get("difficulty")
	if not _is_int_like(diff) or int(diff) < 1 or int(diff) > 3:
		errors.append(_err(RULE_SCHEMA, cid, "difficulty가 1~3 정수가 아니다"))
	if not _is_true(card.get("anchor")):
		var exp: Variant = card.get("explanation")
		if not _is_nonempty_str(exp):
			errors.append(_err(RULE_SCHEMA, cid, "일반 카드에 explanation이 없다"))
		else:
			var answer: Variant = card.get("answer")
			var era: Variant = answer.get("era") if answer is Dictionary else null
			if era is String and era_labels.has(era) and (exp as String).find(era_labels[era]) == -1:
				errors.append(_err(RULE_SCHEMA, cid, "해설에 시기 라벨 '%s'가 없다" % era_labels[era]))


static func _check_source(src: Variant, cid: String, errors: Array[Dictionary]) -> void:
	if not (src is Dictionary):
		errors.append(_err(RULE_SCHEMA, cid, "source가 객체가 아니다"))
		return
	if not _is_nonempty_str(src.get("name")):
		errors.append(_err(RULE_SCHEMA, cid, "source.name이 없다"))
	if not src.has("url") or (typeof(src.get("url")) != TYPE_NIL and not (src.get("url") is String)):
		errors.append(_err(RULE_SCHEMA, cid, "source.url이 있어야 한다(문자열이나 null)"))
	elif src.get("url") is String:
		var url: String = src.get("url")
		if not url.begins_with("http://") and not url.begins_with("https://"):
			errors.append(_err(RULE_SCHEMA, cid, "source.url은 http(s)://로 시작해야 한다"))
	if not (src.get("note") is String):
		errors.append(_err(RULE_SCHEMA, cid, "source.note가 문자열이 아니다"))


# --- 규칙 2: 정답 나라·시기 ------------------------------------------------

static func _check_answer(card: Dictionary, cid: String, nation_ids: PackedStringArray, era_ids: PackedStringArray, errors: Array[Dictionary]) -> void:
	var answer: Variant = card.get("answer")
	if not (answer is Dictionary):
		return  # 규칙 0에서 보고했다.
	var n: Variant = answer.get("nation")
	var e: Variant = answer.get("era")
	if not (n is String) or not nation_ids.has(n):
		errors.append(_err(RULE_ANSWER, cid, "answer.nation이 정해진 값이 아니다: %s" % str(n)))
	if not (e is String) or not era_ids.has(e):
		errors.append(_err(RULE_ANSWER, cid, "answer.era가 정해진 값이 아니다: %s" % str(e)))


# --- 규칙 3: 단서 3개, level 1·2·3, kind ----------------------------------

static func _check_clues(card: Dictionary, cid: String, is_anchor: bool, errors: Array[Dictionary]) -> void:
	var clues: Variant = card.get("clues")
	if not (clues is Array):
		return  # 규칙 0에서 보고했다.
	var list: Array = clues
	if is_anchor:
		if not list.is_empty():
			errors.append(_err(RULE_CLUES, cid, "기준 카드의 clues는 비어 있어야 한다"))
		return
	if list.size() != CLUE_KINDS.size():
		errors.append(_err(RULE_CLUES, cid, "단서가 %d개다(3개여야 한다)" % list.size()))
		return
	for i in list.size():
		var clue: Variant = list[i]
		if not (clue is Dictionary):
			errors.append(_err(RULE_CLUES, cid, "단서 %d가 객체가 아니다" % (i + 1)))
			continue
		var lv: Variant = clue.get("level")
		if not _is_int_like(lv) or int(lv) != i + 1:
			errors.append(_err(RULE_CLUES, cid, "단서 %d번째의 level이 %d가 아니다" % [i + 1, i + 1]))
		if not _str_eq(clue.get("kind"), CLUE_KINDS[i]):
			errors.append(_err(RULE_CLUES, cid, "단서 %d의 kind는 %s여야 한다" % [i + 1, CLUE_KINDS[i]]))
		if not _is_nonempty_str(clue.get("text")):
			errors.append(_err(RULE_CLUES, cid, "단서 %d의 text가 없다" % (i + 1)))


# --- 규칙 4: refs ---------------------------------------------------------
# 카드가 나오는 순서는 무작위라 "먼저 놓이는 것이 보장된 카드"가 없다.
# 그래서 relation 단서의 refs는 기준 카드만 허용한다(decision-log D6, D10).
# relation 본문에는 참조 카드의 [제목]이 있어야 하고, 다른 단서의 refs는 비어 있어야 한다.

static func _check_refs(card: Dictionary, cid: String, by_id: Dictionary, errors: Array[Dictionary]) -> void:
	var clues: Variant = card.get("clues")
	if not (clues is Array):
		return
	for clue: Variant in clues:
		if not (clue is Dictionary):
			continue
		var refs: Variant = clue.get("refs")
		if not (refs is Array):
			errors.append(_err(RULE_RELATION_REFS, cid, "refs가 배열이 아니다"))
			continue
		var text: String = clue.get("text") if clue.get("text") is String else ""
		if not _str_eq(clue.get("kind"), "relation"):
			if not (refs as Array).is_empty():
				errors.append(_err(RULE_RELATION_REFS, cid, "relation이 아닌 단서의 refs는 비어 있어야 한다"))
			continue
		if (refs as Array).is_empty():
			errors.append(_err(RULE_RELATION_REFS, cid, "relation 단서에 refs가 없다"))
			continue
		for ref: Variant in refs:
			if not (ref is String) or not by_id.has(ref):
				errors.append(_err(RULE_RELATION_REFS, cid, "refs가 없는 카드를 가리킨다: %s" % str(ref)))
				continue
			var target: Dictionary = by_id[ref]
			if not _is_true(target.get("anchor")):
				errors.append(_err(RULE_RELATION_REFS, cid, "refs가 기준 카드가 아니다: %s" % ref))
			if _is_true(target.get("disputed")):
				errors.append(_err(RULE_RELATION_REFS, cid, "refs가 disputed 카드를 가리킨다: %s" % ref))
			var target_title: String = target.get("title") if target.get("title") is String else ""
			if text.find("[%s]" % target_title) == -1:
				errors.append(_err(RULE_RELATION_REFS, cid, "relation 본문에 [%s]가 없다" % target_title))


# --- 규칙 5: 1단계 단서에 title·나라·시기 라벨 없음 ---------------------------

static func _check_first_clue(card: Dictionary, cid: String, banned_words: Array, errors: Array[Dictionary]) -> void:
	var clues: Variant = card.get("clues")
	if not (clues is Array) or (clues as Array).is_empty():
		return
	var first: Variant = clues[0]
	if not (first is Dictionary) or not _is_int_like(first.get("level")) or int(first.get("level")) != 1:
		return
	if not _is_nonempty_str(first.get("text")):
		return
	var text: String = first.get("text")
	var title: Variant = card.get("title")
	if _is_nonempty_str(title) and text.find(title) != -1:
		errors.append(_err(RULE_TITLE_IN_FIRST_CLUE, cid, "1단계 단서에 title이 들어 있다"))
	for word: Variant in banned_words:
		if _is_nonempty_str(word) and text.find(word) != -1:
			errors.append(_err(RULE_TITLE_IN_FIRST_CLUE, cid, "1단계 단서에 '%s'가 들어 있다" % word))


# --- 규칙 6: disputed ------------------------------------------------------

static func _check_disputed(card: Dictionary, cid: String, errors: Array[Dictionary]) -> void:
	if _is_true(card.get("disputed")):
		if not _is_nonempty_str(card.get("disputed_note")):
			errors.append(_err(RULE_DISPUTED_NOTE, cid, "disputed 카드에 disputed_note가 없다"))
		if _is_true(card.get("anchor")):
			errors.append(_err(RULE_DISPUTED_NOTE, cid, "disputed 카드는 기준 카드일 수 없다"))
	elif typeof(card.get("disputed_note")) != TYPE_NIL:
		errors.append(_err(RULE_DISPUTED_NOTE, cid, "disputed가 false면 disputed_note는 null이어야 한다"))


# --- 규칙 7: image가 있으면 출처와 라이선스 ---------------------------------

static func _check_image(card: Dictionary, cid: String, errors: Array[Dictionary]) -> void:
	if typeof(card.get("image")) == TYPE_NIL:
		return
	if not _is_nonempty_str(card.get("image_source")):
		errors.append(_err(RULE_IMAGE_CREDITS, cid, "image가 있는데 image_source가 없다"))
	if not _is_nonempty_str(card.get("image_license")):
		errors.append(_err(RULE_IMAGE_CREDITS, cid, "image가 있는데 image_license가 없다"))


# --- 규칙 8: 12칸 각각에 판정 카드 1장 이상 ---------------------------------
# 기준 카드와 disputed 카드는 세지 않는다.

static func _check_coverage(cards: Array[Dictionary], nation_ids: PackedStringArray, era_ids: PackedStringArray, errors: Array[Dictionary]) -> void:
	var counts := cell_counts(cards)
	for n in nation_ids:
		for e in era_ids:
			var key := CardData.make_cell_key(n, e)
			if int(counts.get(key, 0)) < 1:
				errors.append(_err(RULE_CELL_COVERAGE, key, "이 칸에 판정 대상 카드가 없다"))


# --- 규칙 9: verified면 verified_by -----------------------------------------

static func _check_release(card: Dictionary, cid: String, errors: Array[Dictionary]) -> void:
	if _is_true(card.get("verified")) and not _is_nonempty_str(card.get("verified_by")):
		errors.append(_err(RULE_RELEASE, cid, "verified: true인데 verified_by가 없다"))


# --- 도우미 -------------------------------------------------------------

static func _err(rule: int, cid: String, message: String) -> Dictionary:
	return {"rule": rule, "id": cid, "message": message}


static func _label(card: Dictionary, index: int) -> String:
	var v: Variant = card.get("id")
	return v if _is_nonempty_str(v) else "#%d" % index


static func _is_true(v: Variant) -> bool:
	return typeof(v) == TYPE_BOOL and v


static func _is_false(v: Variant) -> bool:
	return typeof(v) == TYPE_BOOL and not v


## Python의 nonempty_str과 같다: 공백만 있는 문자열은 빈 것으로 본다.
static func _is_nonempty_str(v: Variant) -> bool:
	return v is String and not (v as String).strip_edges().is_empty()


## 타입이 다른 값끼리 ==를 쓰면 런타임 오류가 나므로, 문자열인지 먼저 확인한다.
static func _str_eq(v: Variant, expected: String) -> bool:
	return v is String and v == expected


## JSON 숫자는 Godot에서 float으로 읽히므로 2.0 같은 정수값 float도 정수로 본다.
static func _is_int_like(v: Variant) -> bool:
	if typeof(v) == TYPE_INT:
		return true
	return typeof(v) == TYPE_FLOAT and is_equal_approx(float(v), floorf(float(v)))
