class_name RoundSession
extends RefCounted
## 한 라운드의 규칙: 현재 카드, 단서 공개, 배치 판정, 먹물, 클리어/실패, 저장용 직렬화.
## 노드와 무관한 순수 로직이다. 화면은 이 객체를 읽고 place_current()를 부른다.
##
## 규칙(design/game-brief.md, decision-log D16·D22):
## - 카드는 한 장씩 나온다. 단서는 1단계부터 보이고 "단서 더 보기"로 3단계까지 연다.
## - 카드는 어느 칸에나 놓을 수 있다. 이미 카드가 있는 칸도 받는다(채워진 칸 거부 없음).
## - 정답 칸이면 정답. 아니면 오답: 먹물 -1, 카드는 정답 칸에 공개되고 소모된다.
## - 없는 칸(설정에 없는 나라·시기)은 거부한다(먹물은 줄지 않는다).
## - 먹물이 0이 되면 실패(마지막 카드여도 실패가 우선). 모든 카드를 놓고 먹물이 남으면 클리어.
##
## 사용 예:
##   var s := RoundSession.new(queue, cfg.start_ink, cfg.nation_ids(), cfg.era_ids())
##   s.reveal_more()
##   var r := s.place_current("silla", "peak")

enum Status { PLAYING, CLEARED, FAILED }

const REJECT_ROUND_OVER := "round_over"
const REJECT_INVALID_CELL := "invalid_cell"
const SAVE_VERSION := 1

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
## 카드별 기록 [{ "card_id", "correct", "clues_seen" }] — 결과 화면과 플레이 기록용.
var history: Array[Dictionary] = []
## 이번 라운드에 새로 도감에 들어간 카드 id. 수집 판단은 ProgressData가 하고,
## 화면이 note_new_collected()로 알려 준다. 이어하기에도 남도록 to_dict()에 들어간다(리뷰 2 N3).
var new_ids: Array[String] = []

var _queue: Array[CardData] = []
var _index: int = 0
var _nation_ids: PackedStringArray
var _era_ids: PackedStringArray
## cell_key -> [{ "card_id": String, "correct": bool }] (놓인 순서)
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

	var correct := card.matches(nation, era)
	# 오답이어도 카드는 정답 칸에 공개되고 소모된다. 한 칸에 여러 장이 쌓일 수 있다.
	var key := card.cell_key()
	if not _placed.has(key):
		_placed[key] = []
	(_placed[key] as Array).append({"card_id": card.id, "correct": correct})
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


## 칸에 놓인 카드들(놓인 순서). 비어 있으면 빈 배열.
func cell_cards(nation: String, era: String) -> Array:
	return _placed.get(CardData.make_cell_key(nation, era), [])


## 이번 라운드 카드 수.
func total_cards() -> int:
	return _queue.size()


## 놓은 카드 수.
func placed_count() -> int:
	return _index


## 라운드가 끝났는지.
func is_over() -> bool:
	return status != Status.PLAYING


## 이번 라운드에 새로 모은 카드를 기록한다(같은 id는 한 번만).
func note_new_collected(card_id: String) -> void:
	if not card_id.is_empty() and not new_ids.has(card_id):
		new_ids.append(card_id)


## 결과 화면·플레이 기록용 요약.
## { "cleared", "correct", "wrong", "total", "placed", "ink_left", "hints",
##   "clue_levels": [놓을 때 본 단서 단계...], "correct_ids": [...], "wrong_ids": [...], "new_ids": [...] }
func summary() -> Dictionary:
	var levels: Array = []
	var correct_ids: Array = []
	var wrong_ids: Array = []
	for h: Dictionary in history:
		levels.append(int(h["clues_seen"]))
		if h["correct"]:
			correct_ids.append(h["card_id"])
		else:
			wrong_ids.append(h["card_id"])
	return {
		"cleared": status == Status.CLEARED,
		"correct": correct_count,
		"wrong": wrong_count,
		"total": _queue.size(),
		"placed": _index,
		"ink_left": ink.current,
		"hints": hints_used,
		"clue_levels": levels,
		"correct_ids": correct_ids,
		"wrong_ids": wrong_ids,
		"new_ids": Array(new_ids),
	}


## 진행 중 라운드를 저장용 딕셔너리로 만든다(카드는 id로만 참조).
func to_dict() -> Dictionary:
	var ids: Array = []
	for c: CardData in _queue:
		ids.append(c.id)
	return {
		"version": SAVE_VERSION,
		"card_ids": ids,
		"index": _index,
		"ink": ink.current,
		"max_ink": ink.max_ink,
		"revealed": revealed_clues,
		"correct": correct_count,
		"wrong": wrong_count,
		"hints": hints_used,
		"placed": _placed.duplicate(true),
		"history": history.duplicate(true),
		"new_ids": Array(new_ids),
	}


## 저장된 진행 중 라운드를 되살린다. 카드가 지금 판정 카드 묶음에 없거나, 값의 범위가 틀리거나,
## 값끼리 맞지 않으면(정답+오답 ≠ 놓은 수, 기록 수 ≠ 놓은 수, 먹물 ≠ 시작 − 오답,
## 보드의 카드가 앞서 놓은 카드와 다름) null
## (그 라운드는 버리고 새로 시작한다. 도감 기록은 ProgressData에 따로 있어 잃지 않는다).
static func from_dict(d: Dictionary, cards: CardSet, nation_ids: PackedStringArray, era_ids: PackedStringArray) -> RoundSession:
	if _num(d.get("version"), -1) != SAVE_VERSION:
		return null
	var raw_ids: Variant = d.get("card_ids")
	if not (raw_ids is Array) or (raw_ids as Array).is_empty():
		return null
	var queue: Array[CardData] = []
	for id: Variant in raw_ids:
		if not (id is String):
			return null
		var card := cards.get_card(id)
		if card == null or not card.is_judgeable():
			return null
		queue.append(card)
	var max_ink := _num(d.get("max_ink"), 0)
	var left := _num(d.get("ink"), -1)
	var index := _num(d.get("index"), -1)
	if max_ink < 1 or left < 1 or left > max_ink or index < 0 or index >= queue.size():
		return null
	var s := RoundSession.new(queue, max_ink, nation_ids, era_ids)
	s.ink.current = left
	s._index = index
	s._begin_card()
	s.revealed_clues = clampi(_num(d.get("revealed"), 1), 1, maxi(queue[index].clues.size(), 1))
	s.correct_count = maxi(_num(d.get("correct"), 0), 0)
	s.wrong_count = maxi(_num(d.get("wrong"), 0), 0)
	s.hints_used = maxi(_num(d.get("hints"), 0), 0)
	var placed: Variant = d.get("placed")
	if placed is Dictionary:
		for key: Variant in placed:
			var entries: Variant = placed[key]
			if not (key is String) or not (entries is Array):
				continue
			var clean: Array = []
			for e: Variant in entries:
				if e is Dictionary and e.get("card_id") is String and typeof(e.get("correct")) == TYPE_BOOL:
					clean.append({"card_id": e["card_id"], "correct": e["correct"]})
			s._placed[key] = clean
	var hist: Variant = d.get("history")
	if hist is Array:
		for h: Variant in hist:
			if h is Dictionary and h.get("card_id") is String and typeof(h.get("correct")) == TYPE_BOOL:
				s.history.append({"card_id": h["card_id"], "correct": h["correct"], "clues_seen": _num(h.get("clues_seen"), 1)})
	var saved_new: Variant = d.get("new_ids")
	if saved_new is Array:
		for id: Variant in saved_new:
			if id is String:
				s.note_new_collected(id)
	if not s._is_consistent():
		return null
	return s


## 되살린 값끼리 맞는지(리뷰 2 L9).
func _is_consistent() -> bool:
	if correct_count + wrong_count != _index or history.size() != _index:
		return false
	if ink.current != ink.max_ink - wrong_count:
		return false
	var wrong_in_history := 0
	var placed_ids: Dictionary = {}
	for i in history.size():
		if history[i]["card_id"] != _queue[i].id:
			return false
		if not history[i]["correct"]:
			wrong_in_history += 1
		placed_ids[_queue[i].id] = _queue[i].cell_key()
	if wrong_in_history != wrong_count:
		return false
	var on_board := 0
	for key: Variant in _placed:
		for e: Dictionary in _placed[key]:
			# 보드의 카드는 앞서 놓은 카드여야 하고, 그 카드의 정답 칸에 있어야 한다.
			if not placed_ids.has(e["card_id"]) or placed_ids[e["card_id"]] != key:
				return false
			on_board += 1
	return on_board == _index


func _begin_card() -> void:
	revealed_clues = 0
	if _index >= _queue.size():
		# 낼 카드가 없는 라운드는 바로 끝난 것으로 본다.
		status = Status.CLEARED
		return
	revealed_clues = mini(1, _queue[_index].clues.size())


static func _num(v: Variant, fallback: int) -> int:
	if typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT:
		return int(v)
	return fallback
