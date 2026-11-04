extends RefCounted
## 단위 테스트용 카드·설정 딕셔너리 공장. 파일을 읽지 않는다.
## 쓰는 법: const Fx = preload("res://tests/fixtures/card_fixtures.gd")

const NATIONS := ["goguryeo", "baekje", "silla", "gaya"]
const ERAS := ["founding", "peak", "ending"]
const ANCHOR_ID := "anchor-goguryeo-peak"


static func nation_ids() -> PackedStringArray:
	return PackedStringArray(NATIONS)


static func era_ids() -> PackedStringArray:
	return PackedStringArray(ERAS)


## 설정 딕셔너리(game_config.json 형식).
static func config_dict(start_ink: int = 5) -> Dictionary:
	return {
		"start_ink": start_ink,
		"release_mode": false,
		"cards_path": "res://assets/data/cards/samguk.json",
		"dev_fallback_cards_path": "res://tests/fixtures/cards_fixture.json",
		"save_path": "user://test_progress.json",
		"nations": [
			{"id": "goguryeo", "label": "고구려"}, {"id": "baekje", "label": "백제"},
			{"id": "silla", "label": "신라"}, {"id": "gaya", "label": "가야"},
		],
		"eras": [
			{"id": "founding", "label": "건국기", "definition": "건국 전승과 초창기"},
			{"id": "peak", "label": "전성기", "definition": "영토와 세력이 커지고 번영"},
			{"id": "ending", "label": "결말기", "definition": "전쟁의 마무리·멸망·통일 완성"},
		],
	}


## 기준 카드 하나.
static func anchor(id: String = ANCHOR_ID, nation: String = "goguryeo", era: String = "peak") -> Dictionary:
	return {
		"id": id, "type": "artifact", "title": "기준 " + id, "anchor": true,
		"answer": {"nation": nation, "era": era}, "clues": [],
		"explanation": "", "source": {"name": "테스트", "url": null, "note": ""},
		"verified": true, "verified_by": null, "disputed": false, "disputed_note": null,
		"difficulty": 1, "image": null, "image_source": null, "image_license": null, "tags": [],
	}


## 일반 카드 하나. relation 단서는 ref_id(기본: 기준 카드)를 가리킨다.
static func card(id: String, nation: String, era: String, ref_id: String = ANCHOR_ID) -> Dictionary:
	return {
		"id": id, "type": "event", "title": "제목 " + id, "anchor": false,
		"answer": {"nation": nation, "era": era},
		"clues": [
			{"level": 1, "kind": "description", "text": "장면 설명 " + nation + era, "refs": []},
			{"level": 2, "kind": "relation", "text": "[기준]과의 관계", "refs": [ref_id]},
			{"level": 3, "kind": "direct", "text": "직접 힌트", "refs": []},
		],
		"explanation": "해설. 사건 성격으로 이 시기다.",
		"source": {"name": "테스트", "url": null, "note": ""},
		"verified": true, "verified_by": "test", "disputed": false, "disputed_note": null,
		"difficulty": 1, "image": null, "image_source": null, "image_license": null, "tags": [],
	}


## 칸 id로 카드 id를 만든다. 예: "goguryeo-peak".
static func cell_card_id(nation: String, era: String) -> String:
	return "%s-%s" % [nation, era]


## 검증을 통과하는 최소 묶음: 기준 카드 1장 + 12칸 각 1장.
static func valid_set() -> Array:
	var cards: Array = [anchor()]
	for n: String in NATIONS:
		for e: String in ERAS:
			cards.append(card(cell_card_id(n, e), n, e))
	return cards


## valid_set()에서 id가 같은 카드를 찾는다(테스트에서 값을 바꾸기 위해).
static func find(cards: Array, id: String) -> Dictionary:
	for c: Dictionary in cards:
		if c["id"] == id:
			return c
	return {}
