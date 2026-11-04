class_name CardLoader
extends RefCounted
## 카드 JSON을 읽고, 로드 모드로 거르고, 검증해서 CardSet으로 만든다.
## parse_text / build 는 파일을 읽지 않아 단위 테스트할 수 있다. load_file 만 파일을 읽는다.


## 규칙 9: 출시 모드는 verified: true && disputed: false 카드만 남긴다. 개발 모드는 전부 남긴다.
## 타입이 잘못된 카드는 출시 모드에서 빠진다(verified가 true로 확인되지 않으므로).
static func filter_for_mode(raw: Array, release_mode: bool) -> Array:
	if not release_mode:
		return raw.duplicate()
	var out: Array = []
	for item: Variant in raw:
		if not (item is Dictionary):
			continue
		var verified: Variant = item.get("verified")
		var is_disputed: Variant = item.get("disputed")
		if typeof(verified) == TYPE_BOOL and verified and typeof(is_disputed) == TYPE_BOOL and not is_disputed:
			out.append(item)
	return out


## 이미 파싱된 배열에서 CardSet을 만든다.
## nation_labels / era_labels: { id: 표시 이름 } — 라벨 검사용(CardValidator.validate 참고).
static func build(
	raw: Array,
	nation_ids: PackedStringArray,
	era_ids: PackedStringArray,
	release_mode: bool,
	nation_labels: Dictionary = {},
	era_labels: Dictionary = {},
) -> CardSet:
	var result := CardSet.new()
	result.release_mode = release_mode
	var filtered := filter_for_mode(raw, release_mode)
	result.errors = CardValidator.validate(filtered, nation_ids, era_ids, nation_labels, era_labels)
	result.warnings = CardValidator.warnings(filtered, nation_ids, era_ids)
	if not result.errors.is_empty():
		return result
	for item: Variant in filtered:
		result.add(CardData.from_dict(item))
	return result


## JSON 문자열에서 CardSet을 만든다. 최상위는 카드 배열이어야 한다.
static func parse_text(
	text: String,
	nation_ids: PackedStringArray,
	era_ids: PackedStringArray,
	release_mode: bool,
	nation_labels: Dictionary = {},
	era_labels: Dictionary = {},
) -> CardSet:
	var json := JSON.new()
	if json.parse(text) != OK:
		return _failed("JSON 파싱 실패 %d행: %s" % [json.get_error_line(), json.get_error_message()], release_mode)
	if not (json.data is Array):
		return _failed("카드 파일의 최상위가 배열이 아니다", release_mode)
	return build(json.data, nation_ids, era_ids, release_mode, nation_labels, era_labels)


## 파일에서 CardSet을 만든다.
static func load_file(
	path: String,
	nation_ids: PackedStringArray,
	era_ids: PackedStringArray,
	release_mode: bool,
	nation_labels: Dictionary = {},
	era_labels: Dictionary = {},
) -> CardSet:
	if not FileAccess.file_exists(path):
		return _failed("카드 파일이 없다: %s" % path, release_mode)
	return parse_text(FileAccess.get_file_as_string(path), nation_ids, era_ids, release_mode, nation_labels, era_labels)


## 설정에 따라 카드 경로를 고른다. 개발 모드이고 cards_path가 없으면 픽스처 경로를 쓴다.
## file_exists는 테스트에서 주입할 수 있다.
static func resolve_path(config: GameConfig, release_mode: bool, file_exists: Callable = Callable()) -> String:
	var exists := file_exists
	if not exists.is_valid():
		exists = func(p: String) -> bool: return FileAccess.file_exists(p)
	if exists.call(config.cards_path):
		return config.cards_path
	if not release_mode and not config.dev_fallback_cards_path.is_empty() and exists.call(config.dev_fallback_cards_path):
		return config.dev_fallback_cards_path
	return config.cards_path


## 설정에서 id·라벨을 모두 넘겨 파일을 읽는다(게임과 통합 테스트가 쓰는 경로).
static func load_with_config(path: String, config: GameConfig, release_mode: bool) -> CardSet:
	return load_file(path, config.nation_ids(), config.era_ids(), release_mode, config.nation_label_map(), config.era_label_map())


static func _failed(message: String, release_mode: bool) -> CardSet:
	var result := CardSet.new()
	result.release_mode = release_mode
	result.errors.append({"rule": CardValidator.RULE_SCHEMA, "id": "(file)", "message": message})
	return result
