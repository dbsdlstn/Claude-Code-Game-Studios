class_name InkMeter
extends RefCounted
## 먹물. 오답마다 줄고 0이 되면 라운드 실패다. 시작 값은 GameConfig.start_ink.

## 라운드 시작 값.
var max_ink: int = 0
## 남은 먹물.
var current: int = 0


func _init(start_ink: int) -> void:
	max_ink = maxi(start_ink, 0)
	current = max_ink


## 먹물을 쓴다. 0 아래로 내려가지 않는다. 남은 양을 돌려준다.
func spend(amount: int = 1) -> int:
	current = maxi(current - maxi(amount, 0), 0)
	return current


## 먹물이 바닥났는지.
func is_empty() -> bool:
	return current <= 0
