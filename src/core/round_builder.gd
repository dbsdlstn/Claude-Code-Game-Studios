class_name RoundBuilder
extends RefCounted
## 라운드에 낼 카드를 고른다(decision-log D22).
## 칸 구성은 보지 않는다: 판정 카드 중 아직 수집하지 않은 카드를 먼저 뽑고,
## round_size에 모자라면 수집한 카드로 채운다. 그래서 한 라운드에 어떤 칸은 0장,
## 어떤 칸은 여러 장일 수 있다(빈 칸으로 정답을 소거하지 못하게).
## 난수는 주입한다(테스트 결정성).
##
## 사용 예:
##   var queue := RoundBuilder.build_queue(card_set, cfg.round_size, rng, progress.collected)


## round_size장(판정 카드가 그보다 적으면 전부)을 골라 섞은 목록을 돌려준다.
## collected: { card_id: true } — 이미 도감에 있는 카드.
static func build_queue(cards: CardSet, round_size: int, rng: RandomNumberGenerator, collected: Dictionary = {}) -> Array[CardData]:
	var fresh: Array[CardData] = []
	var seen: Array[CardData] = []
	for c: CardData in cards.playable:
		if collected.has(c.id):
			seen.append(c)
		else:
			fresh.append(c)
	shuffle_in_place(fresh, rng)
	shuffle_in_place(seen, rng)
	var queue: Array[CardData] = []
	_take(queue, fresh, round_size)
	_take(queue, seen, round_size)
	# 미수집 카드가 앞쪽에 몰리지 않게 한 번 더 섞는다.
	shuffle_in_place(queue, rng)
	return queue


static func _take(queue: Array[CardData], pool: Array[CardData], limit: int) -> void:
	for c: CardData in pool:
		if queue.size() >= limit:
			return
		queue.append(c)


## 주입한 난수로 Fisher-Yates 섞기. Array.shuffle()은 전역 난수를 써서 쓰지 않는다.
static func shuffle_in_place(arr: Array, rng: RandomNumberGenerator) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: Variant = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp
