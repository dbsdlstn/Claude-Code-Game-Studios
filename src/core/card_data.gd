class_name CardData
extends RefCounted
## 카드 한 장(스키마 v1, design/card-data-schema.md).
## CardValidator를 통과한 딕셔너리로만 만든다.

var id: String = ""
## event / artifact / person / myth
var type: String = ""
## 정답 공개 후 표시되는 이름.
var title: String = ""
## true면 보드에 미리 놓이는 기준 카드.
var anchor: bool = false
var nation: String = ""
var era: String = ""
## [{ "level": int, "kind": String, "text": String, "refs": PackedStringArray }] — level 순서.
var clues: Array[Dictionary] = []
var explanation: String = ""
var date_label: String = ""
var source_name: String = ""
var source_url: String = ""
var source_note: String = ""
var verified: bool = false
var verified_by: String = ""
var disputed: bool = false
var disputed_note: String = ""
var difficulty: int = 1
var image: String = ""
var image_source: String = ""
var image_license: String = ""
var tags: PackedStringArray = PackedStringArray()


## 검증된 딕셔너리에서 카드를 만든다.
static func from_dict(d: Dictionary) -> CardData:
	var c := CardData.new()
	c.id = _s(d.get("id"))
	c.type = _s(d.get("type"))
	c.title = _s(d.get("title"))
	c.anchor = _b(d.get("anchor"))
	var answer: Variant = d.get("answer")
	if answer is Dictionary:
		c.nation = _s(answer.get("nation"))
		c.era = _s(answer.get("era"))
	var raw_clues: Variant = d.get("clues")
	if raw_clues is Array:
		for rc: Variant in raw_clues:
			if not (rc is Dictionary):
				continue
			var refs := PackedStringArray()
			var raw_refs: Variant = rc.get("refs")
			if raw_refs is Array:
				for r: Variant in raw_refs:
					if r is String:
						refs.append(r)
			var lv: Variant = rc.get("level")
			c.clues.append({
				"level": int(lv) if (typeof(lv) == TYPE_INT or typeof(lv) == TYPE_FLOAT) else 0,
				"kind": _s(rc.get("kind")),
				"text": _s(rc.get("text")),
				"refs": refs,
			})
	c.explanation = _s(d.get("explanation"))
	c.date_label = _s(d.get("date_label"))
	var src: Variant = d.get("source")
	if src is Dictionary:
		c.source_name = _s(src.get("name"))
		c.source_url = _s(src.get("url"))
		c.source_note = _s(src.get("note"))
	c.verified = _b(d.get("verified"))
	c.verified_by = _s(d.get("verified_by"))
	c.disputed = _b(d.get("disputed"))
	c.disputed_note = _s(d.get("disputed_note"))
	var diff: Variant = d.get("difficulty")
	if typeof(diff) == TYPE_INT or typeof(diff) == TYPE_FLOAT:
		c.difficulty = int(diff)
	c.image = _s(d.get("image"))
	c.image_source = _s(d.get("image_source"))
	c.image_license = _s(d.get("image_license"))
	var tag_list := PackedStringArray()
	var raw_tags: Variant = d.get("tags")
	if raw_tags is Array:
		for t: Variant in raw_tags:
			if t is String:
				tag_list.append(t)
	c.tags = tag_list
	return c


## 판정 대상인지(기준 카드도, 학설이 갈리는 카드도 아님).
func is_judgeable() -> bool:
	return not anchor and not disputed


## 이 카드의 정답 칸이 (nation, era)인지. 배치 판정의 유일한 기준이다.
func matches(cell_nation: String, cell_era: String) -> bool:
	return nation == cell_nation and era == cell_era


## 정답 칸 키 "nation/era".
func cell_key() -> String:
	return make_cell_key(nation, era)


## 칸 키를 만든다.
static func make_cell_key(cell_nation: String, cell_era: String) -> String:
	return "%s/%s" % [cell_nation, cell_era]


static func _s(v: Variant) -> String:
	return v if v is String else ""


static func _b(v: Variant) -> bool:
	return typeof(v) == TYPE_BOOL and v
