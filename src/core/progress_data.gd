class_name ProgressData
extends RefCounted
## 진행 상황: 도감에 모은 카드 id와 라운드 기록. 저장 데이터는 카드 id만 참조한다.
## 파일 입출력은 SaveStore가 맡는다.

const SAVE_VERSION := 1

## { card_id: true }
var collected: Dictionary = {}
var rounds_played: int = 0
var rounds_cleared: int = 0
var rounds_failed: int = 0


## 카드를 도감에 넣는다. 새로 넣었으면 true.
func collect(card_id: String) -> bool:
	if card_id.is_empty() or collected.has(card_id):
		return false
	collected[card_id] = true
	return true


## 도감에 있는지.
func is_collected(card_id: String) -> bool:
	return collected.has(card_id)


## 끝난 라운드를 기록한다. cleared: 클리어면 true, 실패면 false.
func record_round(cleared: bool) -> void:
	rounds_played += 1
	if cleared:
		rounds_cleared += 1
	else:
		rounds_failed += 1


## 저장용 딕셔너리. collected는 정렬된 id 배열이다.
func to_dict() -> Dictionary:
	var ids: Array = collected.keys()
	ids.sort()
	return {
		"version": SAVE_VERSION,
		"collected": ids,
		"rounds_played": rounds_played,
		"rounds_cleared": rounds_cleared,
		"rounds_failed": rounds_failed,
	}


## 저장 딕셔너리에서 만든다. 잘못된 값은 무시하고 기본값을 쓴다.
## 지금 카드 묶음에 없는 id도 지우지 않는다(출시 모드에서 잠시 빠진 카드일 수 있다).
static func from_dict(d: Dictionary) -> ProgressData:
	var p := ProgressData.new()
	var ids: Variant = d.get("collected")
	if ids is Array:
		for v: Variant in ids:
			if v is String:
				p.collect(v)
	p.rounds_played = _count(d.get("rounds_played"))
	p.rounds_cleared = _count(d.get("rounds_cleared"))
	p.rounds_failed = _count(d.get("rounds_failed"))
	return p


static func _count(v: Variant) -> int:
	if typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT:
		return maxi(int(v), 0)
	return 0
