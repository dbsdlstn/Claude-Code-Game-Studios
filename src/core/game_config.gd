class_name GameConfig
extends RefCounted
## 게임 설정값(먹물 수, 나라·시기 정의, 경로, 로드 모드).
## 값은 res://assets/data/config/game_config.json 에서 읽는다. 코드에 수치를 두지 않는다.

const DEFAULT_PATH := "res://assets/data/config/game_config.json"

## 라운드 시작 먹물 수.
var start_ink: int = 0
## true면 출시 모드: verified && !disputed 카드만 로드한다.
var release_mode: bool = false
## 카드 JSON 경로.
var cards_path: String = ""
## 개발 모드에서 cards_path가 없을 때 쓰는 픽스처 경로. 출시 모드에서는 쓰지 않는다.
var dev_fallback_cards_path: String = ""
## 진행 저장 경로(user://).
var save_path: String = ""
## [{ "id": String, "label": String }]
var nations: Array[Dictionary] = []
## [{ "id": String, "label": String, "definition": String }]
var eras: Array[Dictionary] = []
## 설정을 읽는 중 발견한 문제. 비어 있으면 정상.
var errors: Array[String] = []


## 딕셔너리에서 설정을 만든다. 누락·잘못된 값은 errors에 기록한다.
static func from_dict(d: Dictionary) -> GameConfig:
	var cfg := GameConfig.new()
	var ink: Variant = d.get("start_ink")
	if (typeof(ink) == TYPE_INT or typeof(ink) == TYPE_FLOAT) and int(ink) >= 1:
		cfg.start_ink = int(ink)
	else:
		cfg.errors.append("start_ink는 1 이상의 정수여야 한다")
	var rm: Variant = d.get("release_mode", false)
	cfg.release_mode = typeof(rm) == TYPE_BOOL and rm
	cfg.cards_path = _str(d.get("cards_path"))
	if cfg.cards_path.is_empty():
		cfg.errors.append("cards_path가 없다")
	cfg.dev_fallback_cards_path = _str(d.get("dev_fallback_cards_path"))
	cfg.save_path = _str(d.get("save_path"))
	if cfg.save_path.is_empty():
		cfg.errors.append("save_path가 없다")
	cfg.nations = _read_axis(d.get("nations"), false, "nations", cfg.errors)
	cfg.eras = _read_axis(d.get("eras"), true, "eras", cfg.errors)
	return cfg


## 파일에서 설정을 읽는다. 실패하면 errors가 채워진 설정을 돌려준다.
static func load_file(path: String = DEFAULT_PATH) -> GameConfig:
	if not FileAccess.file_exists(path):
		var missing := GameConfig.new()
		missing.errors.append("설정 파일이 없다: %s" % path)
		return missing
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		var bad := GameConfig.new()
		bad.errors.append("설정 JSON 파싱 실패 %d행: %s" % [json.get_error_line(), json.get_error_message()])
		return bad
	if not (json.data is Dictionary):
		var wrong := GameConfig.new()
		wrong.errors.append("설정 파일의 최상위가 객체가 아니다")
		return wrong
	return from_dict(json.data)


## 오류 없이 읽혔는지.
func is_valid() -> bool:
	return errors.is_empty()


## 실제 로드 모드. 디버그 빌드가 아니면(내보낸 출시 빌드) 설정과 무관하게 출시 모드다.
func effective_release_mode(is_debug_build: bool) -> bool:
	return release_mode or not is_debug_build


## 나라 id 목록(보드 행 순서).
func nation_ids() -> PackedStringArray:
	return _ids(nations)


## 시기 id 목록(보드 열 순서).
func era_ids() -> PackedStringArray:
	return _ids(eras)


## 나라 표시 이름. 없으면 id를 그대로 쓴다.
func nation_label(id: String) -> String:
	return _field(nations, id, "label", id)


## 시기 표시 이름.
func era_label(id: String) -> String:
	return _field(eras, id, "label", id)


## 시기 정의(열 머리글에 항상 표시한다, decision-log D2).
func era_definition(id: String) -> String:
	return _field(eras, id, "definition", "")


static func _read_axis(v: Variant, needs_definition: bool, key: String, errs: Array[String]) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if not (v is Array) or (v as Array).is_empty():
		errs.append("%s 목록이 없다" % key)
		return out
	for item: Variant in v:
		if not (item is Dictionary):
			errs.append("%s 항목이 객체가 아니다" % key)
			continue
		var id := _str(item.get("id"))
		var label := _str(item.get("label"))
		if id.is_empty() or label.is_empty():
			errs.append("%s 항목에 id나 label이 없다" % key)
			continue
		var entry := {"id": id, "label": label}
		if needs_definition:
			var definition := _str(item.get("definition"))
			if definition.is_empty():
				errs.append("%s/%s 정의가 없다" % [key, id])
			entry["definition"] = definition
		out.append(entry)
	return out


static func _ids(list: Array[Dictionary]) -> PackedStringArray:
	var out := PackedStringArray()
	for e: Dictionary in list:
		out.append(e["id"])
	return out


static func _field(list: Array[Dictionary], id: String, key: String, fallback: String) -> String:
	for e: Dictionary in list:
		if e["id"] == id:
			return e.get(key, fallback)
	return fallback


static func _str(v: Variant) -> String:
	return v if v is String else ""
