extends GdUnitTestSuite
## InkMeter: 먹물 규칙.


func test_starts_full() -> void:
	var ink := InkMeter.new(5)
	assert_int(ink.current).is_equal(5)
	assert_bool(ink.is_empty()).is_false()


func test_spend_reduces_by_one() -> void:
	var ink := InkMeter.new(5)
	assert_int(ink.spend()).is_equal(4)


func test_spend_never_goes_below_zero() -> void:
	var ink := InkMeter.new(1)
	ink.spend()
	ink.spend()
	assert_int(ink.current).is_equal(0)
	assert_bool(ink.is_empty()).is_true()


func test_negative_amount_does_not_refill() -> void:
	var ink := InkMeter.new(3)
	ink.spend(-2)
	assert_int(ink.current).is_equal(3)
