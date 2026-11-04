class_name CardSet
extends RefCounted
## 로드된 카드 묶음. 기준 카드, 판정 대상 카드, 해설용(학설이 갈리는) 카드로 나눈다.
## errors가 비어 있지 않으면 카드가 채워지지 않는다(게임을 시작하지 않는다).

## 파일 순서 그대로의 전체 카드.
var all_cards: Array[CardData] = []
## 보드에 미리 놓이는 기준 카드.
var anchors: Array[CardData] = []
## 판정 대상(anchor도 disputed도 아님).
var playable: Array[CardData] = []
## disputed: true. 판정에서 빼고 도감 해설용으로만 쓴다.
var disputed: Array[CardData] = []
## CardValidator 오류 형식의 목록.
var errors: Array[Dictionary] = []
## 오류는 아닌 알림(칸당 목표 3장 미달 등).
var warnings: Array[String] = []
## 출시 모드로 걸러졌는지.
var release_mode: bool = false
var _by_id: Dictionary = {}


## 오류 없이 로드됐는지.
func is_valid() -> bool:
	return errors.is_empty()


## 카드를 추가하고 분류한다.
func add(card: CardData) -> void:
	all_cards.append(card)
	_by_id[card.id] = card
	if card.anchor:
		anchors.append(card)
	elif card.disputed:
		disputed.append(card)
	else:
		playable.append(card)


## id로 카드를 찾는다. 없으면 null.
func get_card(card_id: String) -> CardData:
	return _by_id.get(card_id, null)


## id가 이 묶음에 있는지.
func has_card(card_id: String) -> bool:
	return _by_id.has(card_id)


## (nation, era) 칸의 판정 대상 카드들.
func playable_for_cell(nation: String, era: String) -> Array[CardData]:
	var out: Array[CardData] = []
	for c: CardData in playable:
		if c.matches(nation, era):
			out.append(c)
	return out


## (nation, era) 칸의 기준 카드들.
func anchors_for_cell(nation: String, era: String) -> Array[CardData]:
	var out: Array[CardData] = []
	for c: CardData in anchors:
		if c.matches(nation, era):
			out.append(c)
	return out
