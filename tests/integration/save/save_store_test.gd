extends GdUnitTestSuite
## SaveStore: user:// 저장과 불러오기. 테스트마다 자기 파일을 지운다.

const TEST_PATH := "user://test_hanyang_progress.json"

var _store: SaveStore


func before_test() -> void:
	_store = SaveStore.new(TEST_PATH)
	_store.clear()


func after_test() -> void:
	_store.clear()


func test_missing_file_loads_empty_progress() -> void:
	var p := _store.load_progress()
	assert_int(p.collected.size()).is_equal(0)
	assert_str(_store.last_error).is_empty()


func test_save_then_load_round_trips() -> void:
	# Arrange
	var p := ProgressData.new()
	p.collect("fx-silla-peak-01")
	p.record_round(true)
	# Act
	var err := _store.save(p)
	var loaded := _store.load_progress()
	# Assert
	assert_int(err).is_equal(OK)
	assert_bool(loaded.is_collected("fx-silla-peak-01")).is_true()
	assert_int(loaded.rounds_cleared).is_equal(1)


func test_save_overwrites_previous_save() -> void:
	var first := ProgressData.new()
	first.collect("a")
	_store.save(first)
	var second := ProgressData.new()
	second.collect("b")
	_store.save(second)
	var loaded := _store.load_progress()
	assert_bool(loaded.is_collected("a")).is_false()
	assert_bool(loaded.is_collected("b")).is_true()
	assert_bool(FileAccess.file_exists(TEST_PATH + ".tmp")).is_false()


func test_corrupt_file_loads_empty_progress_with_error() -> void:
	var f := FileAccess.open(TEST_PATH, FileAccess.WRITE)
	f.store_string("{ not json")
	f.close()
	var p := _store.load_progress()
	assert_int(p.collected.size()).is_equal(0)
	assert_str(_store.last_error).is_not_empty()
