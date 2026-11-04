extends GdUnitTestSuite
## SaveStore: user:// 저장과 불러오기. 테스트마다 자기 파일을 지운다.

const TEST_PATH := "user://test_hanyang_progress.json"

var _store: SaveStore


func before_test() -> void:
	_store = SaveStore.new(TEST_PATH)
	_store.clear()


func after_test() -> void:
	_store.clear()
	if FileAccess.file_exists(_store.future_backup_path(99)):
		DirAccess.remove_absolute(_store.future_backup_path(99))


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


func _write(file_path: String, text: String) -> void:
	var f := FileAccess.open(file_path, FileAccess.WRITE)
	f.store_string(text)
	f.close()


func test_save_leaves_no_temp_or_backup_files() -> void:
	var p := ProgressData.new()
	p.collect("a")
	_store.save(p)
	_store.save(p)
	assert_bool(FileAccess.file_exists(_store.tmp_path())).is_false()
	assert_bool(FileAccess.file_exists(_store.bak_path())).is_false()


func test_interrupted_swap_recovers_from_temp_file() -> void:
	# 기존 파일을 백업으로 옮긴 직후 끊긴 상태: 본 파일 없음, tmp = 새 저장, bak = 이전 저장.
	_write(_store.tmp_path(), JSON.stringify({"version": 2, "collected": ["new"]}))
	_write(_store.bak_path(), JSON.stringify({"version": 2, "collected": ["old"]}))
	var p := _store.load_progress()
	assert_bool(p.is_collected("new")).is_true()
	assert_str(_store.last_error).is_not_empty()


func test_corrupt_main_file_falls_back_to_backup() -> void:
	_write(TEST_PATH, "{ broken")
	_write(_store.bak_path(), JSON.stringify({"version": 2, "collected": ["old"]}))
	var p := _store.load_progress()
	assert_bool(p.is_collected("old")).is_true()


func test_partial_temp_file_does_not_replace_good_save() -> void:
	# 1단계(임시 파일 쓰기) 도중 끊긴 상태: 본 파일은 그대로 있어야 하고 그것을 읽는다.
	_write(TEST_PATH, JSON.stringify({"version": 2, "collected": ["good"]}))
	_write(_store.tmp_path(), "{ half")
	var p := _store.load_progress()
	assert_bool(p.is_collected("good")).is_true()
	assert_str(_store.last_error).is_empty()


func test_unknown_future_version_is_backed_up_and_not_read() -> void:
	# 리뷰 2 L2: 모르는 새 형식은 덮어쓰지 않도록 보관하고 새로 시작한다.
	_write(TEST_PATH, JSON.stringify({"version": 99, "collected": ["x"]}))
	var p := _store.load_progress()
	assert_bool(p.is_collected("x")).is_false()
	assert_bool(FileAccess.file_exists(_store.future_backup_path(99))).is_true()
	assert_str(_store.last_error).is_not_empty()


func test_failed_archive_copy_makes_store_read_only_and_keeps_original() -> void:
	# 리뷰 3 H1: 새 형식을 보관하지 못하면 저장을 끄고 원본을 건드리지 않는다.
	var original := JSON.stringify({"version": 99, "collected": ["x"]})
	_write(TEST_PATH, original)
	var failing := func(_from: String, _to: String) -> Error: return ERR_FILE_CANT_WRITE
	var store := SaveStore.new(TEST_PATH, failing)
	var p := store.load_progress()
	assert_bool(store.read_only).is_true()
	assert_int(store.save(p)).is_equal(ERR_UNAVAILABLE)
	assert_str(FileAccess.get_file_as_string(TEST_PATH)).is_equal(original)
