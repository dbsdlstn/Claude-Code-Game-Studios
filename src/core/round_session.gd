class_name RoundSession
extends RefCounted
## 한 라운드의 규칙: 현재 카드, 단서 공개, 배치 판정, 먹물, 클리어/실패.
## 노드와 무관한 순수 로직이다. 화면은 이 객체를 읽고 place_current()를 부른다.
##
## 규칙(design/game-brief.md):
## - 카드는 한 장씩 나온다. 단서는 1단계부터 보이고 "단서 더 보기"로 3단계까지 연다.
## - 정답 칸에 놓으면 정답. 다른 빈 칸에 놓으면 오답: 먹물 -1, 카드는 정답 칸에 공개되고 소모된다.
## - 이미 채워진 칸이나 없는 칸에 놓으면 거부한다(먹물은 줄지 않는다).
## - 먹물이 0이 되면 실패. 모든 카드를 놓았고 먹물이 남았으면 클리어.

enum Status { PLAYING, CLEARED, FAILED }

const REJECT_ROUND_OVER := "round_over"
const REJECT_INVALID_CELL := "invalid_cell"
const REJECT_OCCUPIED := "occupied"

## 현재 상태.
var status: Status = Status.PLAYING
## 먹물.
var ink: InkMeter
## 현재 카드에서 보이는 단서 수(1부터).
var revealed_clues: int = 0
## 정답 수, 오답 수, "단서 더 보기" 누른 수.
var correct_count: int = 0
var wrong_count: int = 0
var hints_used: int = 0
## 카드별 기록 [{ "card_id", "correct", "clues_seen" }] — 플레이 로그 보정용.
var history: Array[Dictionary] = []

var _queue: Array[CardData] = []
var _index: int = 0
var _nation_ids: PackedStringArray
var _era_ids: PackedStringArray
## cell_key -> { "card_id": String, "correct": bool }
var _placed: Dictionary = {}


## queue: 이번 라운드 카드(RoundBuilder.build_queue). start_ink: GameConfig.start_ink.
func _init(queue: Array[CardData], start_ink: int, nation_ids: PackedStringArray, era_ids: PackedStringArray) -> void:
	_queue = queue.duplicate()
	ink = InkMeter.new(start_ink)
	_nation_ids = nation_ids
	_era_ids = era_ids
	_begin_card()


## 지금 놓을 카드. 라운드가 끝났으면 null.
func current_card() -> CardData:
	if status != Status.PLAYING or _index >= _queue.size():
		return null
	return _queue[_index]


## 현재 카드에서 보이는 단서들(level 순서).
func visible_clues() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var card := current_card()
	if card == null:
		return out
	for i in mini(revealed_clues, card.clues.size()):
		out.append(card.clues[i])
	return out


## "단서 더 보기"를 누를 수 있는지.
func can_reveal_more() -> bool:
	var card := current_card()
	return card != null and revealed_clues < card.clues.size()


## 다음 단서를 연다. 열었으면 true.
func reveal_more() -> bool:
	if not can_reveal_more():
		return false
	revealed_clues += 1
	hints_used += 1
	return true


## 현재 카드를 (nation, era) 칸에 놓는다.
## 돌려주는 값: { "accepted": bool, "reason": String, "correct": bool, "card": CardData,
##   "answer_nation": String, "answer_era": String, "ink": int, "status": Status }
func place_current(nation: String, era: String) -> Dictionary:
	var result := {
		"accepted": false, "reason": "", "correct": false, "card": null,
		"answer_nation": "", "answer_era": "", "ink": ink.current, "status": status,
	}
	var card := current_card()
	if card == null:
		result["reason"] = REJECT_ROUND_OVER
		return result
	if not _nation_ids.has(nation) or not _era_ids.has(era):
		result["reason"] = REJECT_INVALID_CELL
		return result
	if _placed.has(CardData.make_cell_key(nation, era)):
		result["reason"] = REJECT_OCCUPIED
		return result

	var correct := card.matches(nation, era)
	# 오답이어도 카드는 정답 칸에 공개되고 소모된다.
	_placed[card.cell_key()] = {"card_id": card.id, "correct": correct}
	history.append({"card_id": card.id, "correct": correct, "clues_seen": revealed_clues})
	if correct:
		correct_count += 1
	else:
		wrong_count += 1
		ink.spend(1)

	_index += 1
	if ink.is_empty():
		status = Status.FAILED
	elif _index >= _queue.size():
		status = Status.CLEARED
	else:
		_begin_card()

	result["accepted"] = true
	result["correct"] = correct
	result["card"] = card
	result["answer_nation"] = card.nation
	result["answer_era"] = card.era
	result["ink"] = ink.current
	result["status"] = status
	return result


## 칸에 놓인 카드 정보. 비어 있으면 빈 딕셔너리.
func cell_occupant(nation: String, era: String) -> Dictionary:
	return _placed.get(CardData.make_cell_key(nation, era), {})


## 이번 라운드 카드 수.
func total_cards() -> int:
	return _queue.size()


## 놓은 카드 수.
func placed_count() -> int:
	return _index


## 라운드가 끝났는지.
func is_over() -> bool:
	return status != Status.PLAYING


func _begin_card() -> void:
	revealed_clues = 0
	if _index >= _queue.size():
		# 낼 카드가 없는 라운드는 바로 끝난 것으로 본다.
		status = Status.CLEARED
		return
	revealed_clues = mini(1, _queue[_index].clues.size())
