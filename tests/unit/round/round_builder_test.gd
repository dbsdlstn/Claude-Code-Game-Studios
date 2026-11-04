extends GdUnitTestSuite
## RoundBuilder (decision-log D22): 칸과 무관하게 round_size장, 미수집 우선, 주입한 난수로 결정적.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")
const ROUND_SIZE := 12


func _rng(seed_value: int) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	return rng


## 칸마다 3장(판정 카드 36장).
func _set36() -> CardSet:
	return CardLoader.build(Fx.multi_set(3), Fx.nation_ids(), Fx.era_ids(), false)


func _ids(queue: Array[CardData]) -> Array:
	return queue.map(func(c: CardData) -> String: return c.id)


func test_queue_has_round_size_cards_without_duplicates() -> void:
	var queue := RoundBuilder.build_queue(_set36(), ROUND_SIZE, _rng(1))
	assert_int(queue.size()).is_equal(ROUND_SIZE)
	var unique := {}
	for c: CardData in queue:
		unique[c.id] = true
	assert_int(unique.size()).is_equal(ROUND_SIZE)


func test_same_seed_gives_same_order() -> void:
	var cs := _set36()
	var a := RoundBuilder.build_queue(cs, ROUND_SIZE, _rng(42))
	var b := RoundBuilder.build_queue(cs, ROUND_SIZE, _rng(42))
	assert_array(_ids(a)).is_equal(_ids(b))


func test_uncollected_cards_are_drawn_first() -> void:
	# Arrange: 36장 중 30장을 이미 모았다 → 미수집 6장은 반드시 들어가고 나머지 6장은 수집 카드.
	var cs := _set36()
	var collected := {}
	var fresh: Array = []
	for i in cs.playable.size():
		if i < 30:
			collected[cs.playable[i].id] = true
		else:
			fresh.append(cs.playable[i].id)
	for seed_value in range(5):
		# Act
		var ids := _ids(RoundBuilder.build_queue(cs, ROUND_SIZE, _rng(seed_value), collected))
		# Assert
		assert_int(ids.size()).is_equal(ROUND_SIZE)
		for id: Variant in fresh:
			assert_bool(ids.has(id)).is_true()


func test_only_uncollected_when_enough_remain() -> void:
	var cs := _set36()
	var collected := {}
	for i in 12:
		collected[cs.playable[i].id] = true
	var queue := RoundBuilder.build_queue(cs, ROUND_SIZE, _rng(9), collected)
	for c: CardData in queue:
		assert_bool(collected.has(c.id)).is_false()


func test_draw_ignores_cells_so_a_cell_can_repeat() -> void:
	# 칸마다 1장이 아니다: 여러 시드 중 같은 칸이 두 번 이상 나오는 라운드가 있어야 한다.
	var cs := _set36()
	var found_repeat := false
	for seed_value in range(20):
		var counts := {}
		for c: CardData in RoundBuilder.build_queue(cs, ROUND_SIZE, _rng(seed_value)):
			counts[c.cell_key()] = int(counts.get(c.cell_key(), 0)) + 1
		for v: Variant in counts.values():
			if int(v) >= 2:
				found_repeat = true
	assert_bool(found_repeat).is_true()


func test_fewer_cards_than_round_size_returns_all() -> void:
	var cs := CardLoader.build(Fx.valid_set(), Fx.nation_ids(), Fx.era_ids(), false)
	assert_int(RoundBuilder.build_queue(cs, 20, _rng(3)).size()).is_equal(12)
