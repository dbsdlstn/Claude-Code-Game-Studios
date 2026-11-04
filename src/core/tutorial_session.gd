class_name TutorialSession
extends RefCounted
## 튜토리얼 규칙: 연습 카드 한 장. 먹물·도감·플레이 기록에 영향을 주지 않는다.
## 오답이면 다시 놓게 하고, 그때부터 단서를 모두(3단계까지) 보여 준다.
##
## 사용 예:
##   var t := TutorialSession.new(data.card)
##   t.reveal_more()
##   if t.place("goguryeo", "peak"): ...  # 정답

## 연습 카드.
var card: CardData
## 보이는 단서 수(1부터).
var revealed_clues: int = 1
## 오답 횟수.
var wrong_tries: int = 0
## 정답으로 놓았는지.
var solved: bool = false


func _init(practice_card: CardData) -> void:
	card = practice_card
	revealed_clues = mini(1, card.clues.size())


## 보이는 단서들.
func visible_clues() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i in mini(revealed_clues, card.clues.size()):
		out.append(card.clues[i])
	return out


## "단서 더 보기"를 누를 수 있는지.
func can_reveal_more() -> bool:
	return not solved and revealed_clues < card.clues.size()


## 다음 단서를 연다.
func reveal_more() -> bool:
	if not can_reveal_more():
		return false
	revealed_clues += 1
	return true


## 놓는다. 정답이면 true. 이미 풀었으면 다시 판정하지 않고 true.
func place(nation: String, era: String) -> bool:
	if solved:
		return true
	if card.matches(nation, era):
		solved = true
		return true
	wrong_tries += 1
	revealed_clues = card.clues.size()
	return false
