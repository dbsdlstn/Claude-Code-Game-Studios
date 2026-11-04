class_name CardArt
extends RefCounted
## 카드 일러스트 경로를 고른다(아트 바이블 §7, §7.1, decision-log D37). 노드가 없는 순수 함수.
## - 숨김 상태: 경로를 주지 않는다(화면은 "?"만 그린다). 일러스트 파일은 정답 전까지 노출하지 않는다.
## - 공개 후·도감: `image`가 있고 파일이 있으면 그 파일, 아니면 유형별 대체 문양 SVG.
##
## 사용 예:
##   var path := CardArt.revealed_path(card)
##   texture_rect.texture = load(path) as Texture2D

const PLACEHOLDER_DIR := "res://assets/art/placeholders/"
const DEFAULT_TYPE := "event"
const KNOWN_TYPES := ["event", "artifact", "person", "myth"]


## 유형별 대체 문양 경로. 모르는 유형이면 event 문양.
static func placeholder_path(card_type: String) -> String:
	var t: String = card_type if KNOWN_TYPES.has(card_type) else DEFAULT_TYPE
	return "%splaceholder-%s.svg" % [PLACEHOLDER_DIR, t]


## 공개 후 보여 줄 일러스트 경로. exists: 경로 → bool(테스트에서 주입). 기본은 ResourceLoader.exists.
## image는 카드 JSON의 저장소 상대 경로("assets/art/cards/...")이고 res:// 를 붙여 찾는다.
static func revealed_path(card: CardData, exists: Callable = Callable()) -> String:
	var check := exists
	if not check.is_valid():
		check = func(p: String) -> bool: return ResourceLoader.exists(p)
	if not card.image.is_empty():
		var image_path := card.image if card.image.begins_with("res://") else "res://" + card.image
		if check.call(image_path):
			return image_path
	return placeholder_path(card.type)


## 대체 문양을 쓰는지("그림 준비 중" 캡션 표시용).
static func is_placeholder(path: String) -> bool:
	return path.begins_with(PLACEHOLDER_DIR)
