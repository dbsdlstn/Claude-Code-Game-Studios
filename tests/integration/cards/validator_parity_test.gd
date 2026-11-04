extends GdUnitTestSuite
## tests/fixtures/validator_parity_cases.json 의 케이스를 CardValidator로 돌린다.
## 같은 케이스를 tools/validator_parity.py 가 tools/validate_cards.py 로 돌린다.
## 두 쪽이 모두 통과하면 두 검증기가 같은 결과를 낸다.

const CASES_PATH := "res://tests/fixtures/validator_parity_cases.json"
const CONFIG_PATH := "res://assets/data/config/game_config.json"


func _apply(cards: Array, op: Dictionary) -> void:
	var kind: String = op["op"]
	if kind == "remove_card":
		cards.erase(_find(cards, op["card"]))
		return
	if kind == "copy_card":
		var dup: Dictionary = _find(cards, op["card"]).duplicate(true)
		dup["id"] = op["as"]
		cards.append(dup)
		return
	var node: Variant = _find(cards, op["card"])
	var path: Array = op["path"]
	for i in path.size() - 1:
		node = node[_key(path[i])]
	var last: Variant = _key(path[path.size() - 1])
	match kind:
		"set":
			var value: Variant = op.get("value")
			node[last] = value.duplicate(true) if (value is Array or value is Dictionary) else value
		"delete":
			(node as Dictionary).erase(last)
		"pop":
			(node[last] as Array).pop_back()


## JSON 숫자 인덱스(float)를 배열 인덱스(int)로 바꾼다.
func _key(k: Variant) -> Variant:
	return int(k) if typeof(k) == TYPE_FLOAT else k


func _find(cards: Array, id: String) -> Dictionary:
	for c: Variant in cards:
		if c is Dictionary and str(c.get("id")) == id:
			return c
	return {}


func test_every_parity_case_matches_expected_rule() -> void:
	# Arrange
	var cfg := GameConfig.load_file(CONFIG_PATH)
	var spec: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(CASES_PATH))
	var base: Array = JSON.parse_string(FileAccess.get_file_as_string(spec["base"]))
	var mismatches: Array[String] = []
	# Act
	for tc: Dictionary in spec["cases"]:
		var cards: Array = base.duplicate(true)
		for op: Dictionary in tc["ops"]:
			_apply(cards, op)
		var rules := CardValidator.rules_of(CardValidator.validate(
			cards, cfg.nation_ids(), cfg.era_ids(), cfg.nation_label_map(), cfg.era_label_map()))
		var expect: Variant = tc["expect"]
		var ok: bool = rules.is_empty() if typeof(expect) == TYPE_NIL else rules.has(int(expect))
		if not ok:
			mismatches.append("%s: expected %s, got %s" % [tc["name"], str(expect), str(rules)])
	# Assert
	assert_int(spec["cases"].size()).is_greater(30)
	assert_array(mismatches).is_empty()
