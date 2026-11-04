class_name RoundBuilder
extends RefCounted
## 라운드에 낼 카드를 고른다: 칸(나라 × 시기)마다 판정 대상 카드 1장.
## 아직 도감에 없는 카드를 먼저 고르고, 순서를 섞는다. 난수는 주입한다(테스트 결정성).


## 칸마다 1장씩 골라 섞은 목록을 돌려준다. 카드가 없는 칸은 건너뛴다(CardValidator 규칙 8이 막는다).
## collected: { card_id: true } — 이미 도감에 있는 카드.
static func build_queue(cards: CardSet, nation_ids: PackedStringArray, era_ids: PackedStringArray, rng: RandomNumberGenerator, collected: Dictionary = {}) -> Array[CardData]:
	var queue: Array[CardData] = []
	for n in nation_ids:
		for e in era_ids:
			var candidates := cards.playable_for_cell(n, e)
			if candidates.is_empty():
				continue
			var fresh: Array[CardData] = []
			for c: CardData in candidates:
				if not collected.has(c.id):
					fresh.append(c)
			var pool: Array[CardData] = candidates
			if not fresh.is_empty():
				pool = fresh
			queue.append(pool[rng.randi_range(0, pool.size() - 1)])
	shuffle_in_place(queue, rng)
	return queue


## 주입한 난수로 Fisher-Yates 섞기. Array.shuffle()은 전역 난수를 써서 쓰지 않는다.
static func shuffle_in_place(arr: Array, rng: RandomNumberGenerator) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: Variant = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp
