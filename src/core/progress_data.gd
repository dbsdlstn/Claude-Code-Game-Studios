class_name ProgressData
extends RefCounted
## 진행 상황: 도감에 모은 카드 id, 라운드 기록(플레이 기록), 튜토리얼 완료 여부,
## 진행 중 라운드. 저장 데이터는 카드 id만 참조한다. 파일 입출력은 SaveStore가 맡는다.
##
## 사용 예:
##   progress.collect(card.id)
##   progress.record_round_result(session.summary(), new_ids)
##   var st := progress.stats()   # { "rounds", "accuracy", "avg_clue_level" }

## 2: tutorial_done, round_log, current_round 추가. 1도 읽는다.
const SAVE_VERSION := 2

## { card_id: true }
var collected: Dictionary = {}
var rounds_played: int = 0
var rounds_cleared: int = 0
var rounds_failed: int = 0
## 첫 실행 튜토리얼을 마쳤거나 건너뛰었는지.
var tutorial_done: bool = false
## 끝난 라운드 기록(클리어·실패만). 항목:
## { "cleared": bool, "correct": int, "total": int, "clue_levels": [int], "new_ids": [String] }
var round_log: Array[Dictionary] = []
## 진행 중 라운드(RoundSession.to_dict()). 없으면 빈 딕셔너리.
var current_round: Dictionary = {}


## 카드를 도감에 넣는다. 새로 넣었으면 true.
func collect(card_id: String) -> bool:
	if card_id.is_empty() or collected.has(card_id):
		return false
	collected[card_id] = true
	return true


## 도감에 있는지.
func is_collected(card_id: String) -> bool:
	return collected.has(card_id)


## card_ids 중 도감에 있는 수. 사용 예: progress.count_in(ids) → "도감 m / 36".
func count_in(card_ids: PackedStringArray) -> int:
	var n := 0
	for id in card_ids:
		if collected.has(id):
			n += 1
	return n


## 게임 클리어(도감 완성): card_ids가 비어 있지 않고 모두 모았는지(decision-log D16).
func is_complete(card_ids: PackedStringArray) -> bool:
	return not card_ids.is_empty() and count_in(card_ids) == card_ids.size()


## 끝난 라운드를 기록한다. cleared: 클리어면 true, 실패면 false.
func record_round(cleared: bool) -> void:
	rounds_played += 1
	if cleared:
		rounds_cleared += 1
	else:
		rounds_failed += 1


## 끝난 라운드의 요약(RoundSession.summary())을 플레이 기록에 더하고 진행 중 라운드를 비운다.
## new_ids: 이번 라운드에 새로 도감에 들어간 카드 id.
func record_round_result(summary: Dictionary, new_ids: Array = []) -> void:
	var cleared := typeof(summary.get("cleared")) == TYPE_BOOL and summary["cleared"]
	record_round(cleared)
	var levels: Array = []
	var raw_levels: Variant = summary.get("clue_levels")
	if raw_levels is Array:
		for lv: Variant in raw_levels:
			levels.append(clampi(_count(lv), 1, 3))
	var ids: Array = []
	for id: Variant in new_ids:
		if id is String:
			ids.append(id)
	round_log.append({
		"cleared": cleared,
		"correct": _count(summary.get("correct")),
		"total": levels.size(),
		"clue_levels": levels,
		"new_ids": ids,
	})
	current_round = {}


## 플레이 기록 집계. accuracy: 놓은 카드 중 정답 비율(0~1), avg_clue_level: 놓을 때 본 단서 단계 평균.
## 기록이 없으면 accuracy와 avg_clue_level은 -1.0.
func stats() -> Dictionary:
	var placed := 0
	var correct := 0
	var level_sum := 0
	for r: Dictionary in round_log:
		var levels: Array = r["clue_levels"]
		placed += levels.size()
		correct += int(r["correct"])
		for lv: Variant in levels:
			level_sum += int(lv)
	return {
		"rounds": round_log.size(),
		"cleared": rounds_cleared,
		"failed": rounds_failed,
		"accuracy": (float(correct) / placed) if placed > 0 else -1.0,
		"avg_clue_level": (float(level_sum) / placed) if placed > 0 else -1.0,
	}


## 진행 중 라운드가 저장돼 있는지("이어하기" 표시용).
func has_current_round() -> bool:
	return not current_round.is_empty()


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
		"tutorial_done": tutorial_done,
		"round_log": round_log.duplicate(true),
		"current_round": current_round.duplicate(true),
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
	var td: Variant = d.get("tutorial_done")
	p.tutorial_done = typeof(td) == TYPE_BOOL and td
	var log_raw: Variant = d.get("round_log")
	if log_raw is Array:
		for entry: Variant in log_raw:
			if not (entry is Dictionary):
				continue
			var levels: Array = []
			var raw_levels: Variant = entry.get("clue_levels")
			if raw_levels is Array:
				for lv: Variant in raw_levels:
					levels.append(clampi(_count(lv), 1, 3))
			var ids: Array = []
			var raw_ids: Variant = entry.get("new_ids")
			if raw_ids is Array:
				for id: Variant in raw_ids:
					if id is String:
						ids.append(id)
			var cleared: Variant = entry.get("cleared")
			p.round_log.append({
				"cleared": typeof(cleared) == TYPE_BOOL and cleared,
				"correct": mini(_count(entry.get("correct")), levels.size()),
				"total": levels.size(),
				"clue_levels": levels,
				"new_ids": ids,
			})
	var cur: Variant = d.get("current_round")
	if cur is Dictionary:
		p.current_round = cur
	return p


static func _count(v: Variant) -> int:
	if typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT:
		return maxi(int(v), 0)
	return 0
