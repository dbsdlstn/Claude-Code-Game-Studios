extends GdUnitTestSuite
## RoundBuilder: 칸마다 1장, 미수집 우선, 주입한 난수로 결정적.

const Fx = preload("res://tests/fixtures/card_fixtures.gd")


func _rng(seed_value: int) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	return rng


func _set_with_extra() -> CardSet:
	var cards := Fx.valid_set()
	cards.append(Fx.card("silla-peak-02", "silla", "peak"))
	return CardLoader.build(cards, Fx.nation_ids(), Fx.era_ids(), false)


func _cells(queue: Array[CardData]) -> Dictionary:
	var cells := {}
	for c: CardData in queue:
		cells[c.cell_key()] = int(cells.get(c.cell_key(), 0)) + 1
	return cells


func test_queue_has_one_card_per_cell() -> void:
	var queue := RoundBuilder.build_queue(_set_with_extra(), Fx.nation_ids(), Fx.era_ids(), _rng(1))
	assert_int(queue.size()).is_equal(12)
	var cells := _cells(queue)
	assert_int(cells.size()).is_equal(12)
	for v: Variant in cells.values():
		assert_int(int(v)).is_equal(1)


func test_same_seed_gives_same_order() -> void:
	var cs := _set_with_extra()
	var a := RoundBuilder.build_queue(cs, Fx.nation_ids(), Fx.era_ids(), _rng(42))
	var b := RoundBuilder.build_queue(cs, Fx.nation_ids(), Fx.era_ids(), _rng(42))
	var ids_a: Array = a.map(func(c: CardData) -> String: return c.id)
	var ids_b: Array = b.map(func(c: CardData) -> String: return c.id)
	assert_array(ids_a).is_equal(ids_b)


func test_uncollected_card_is_preferred() -> void:
	var cs := _set_with_extra()
	var collected := {"silla-peak": true}
	for seed_value in range(10):
		var queue := RoundBuilder.build_queue(cs, Fx.nation_ids(), Fx.era_ids(), _rng(seed_value), collected)
		var ids: Array = queue.map(func(c: CardData) -> String: return c.id)
		assert_bool(ids.has("silla-peak-02")).is_true()
		assert_bool(ids.has("silla-peak")).is_false()


func test_all_collected_still_fills_cell() -> void:
	var cs := _set_with_extra()
	var collected := {"silla-peak": true, "silla-peak-02": true}
	var queue := RoundBuilder.build_queue(cs, Fx.nation_ids(), Fx.era_ids(), _rng(3), collected)
	assert_bool(_cells(queue).has("silla/peak")).is_true()
