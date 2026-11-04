class_name SaveStore
extends RefCounted
## ProgressData를 JSON 파일(user://)로 저장하고 읽는다. 경로는 GameConfig.save_path.
##
## 저장 순서(중간에 끊겨도 마지막으로 완성된 저장 하나는 남는다):
##   1) path.tmp 에 전부 쓰고 닫는다. 실패하면 기존 path는 그대로 둔다.
##   2) 기존 path 를 path.bak 으로 옮긴다.
##   3) path.tmp 를 path 로 옮긴다. 실패하면 path.bak 을 되돌린다.
##   4) path.bak 을 지운다.
## 읽기는 path → path.tmp → path.bak 순서로, 처음 읽히는 온전한 파일을 쓴다.
## 이 코드보다 새 형식(version > ProgressData.SAVE_VERSION)이면 그 파일을
## progress.v<N>.json 으로 복사해 두고 새로 시작한다(모르는 필드를 덮어써 지우지 않게, 리뷰 2 L2).
## (2와 3 사이에 끊기면 path가 없고 tmp가 완성본이다. 1에서 끊기면 path가 그대로 있다.)
##
## 사용 예:
##   var store := SaveStore.new(cfg.save_path)
##   var progress := store.load_progress()
##   if store.save(progress) != OK: print(store.last_error)

## 저장 파일 경로.
var path: String = ""
## 마지막 읽기/쓰기에서 생긴 문제나 복구 안내. 없으면 빈 문자열.
var last_error: String = ""
## true면 save()가 쓰지 않는다. 새 형식 저장을 보관하지 못했을 때 원본을 지키기 위해 켠다(리뷰 3 H1).
var read_only: bool = false
## 파일 복사(from, to) -> Error. 테스트에서 실패를 주입한다. 기본은 DirAccess.copy_absolute.
var copy_file: Callable


func _init(save_path: String, copy: Callable = Callable()) -> void:
	path = save_path
	copy_file = copy
	if not copy_file.is_valid():
		copy_file = func(from: String, to: String) -> Error: return DirAccess.copy_absolute(from, to)


## 임시 파일 경로.
func tmp_path() -> String:
	return path + ".tmp"


## 백업 파일 경로.
func bak_path() -> String:
	return path + ".bak"


## 저장한다. 실패하면 이전 저장 파일을 남기고 오류 코드를 돌려준다.
func save(progress: ProgressData) -> Error:
	if read_only:
		last_error = "새 형식 저장을 보관하지 못해 이번 실행에서는 저장하지 않는다(원본 %s 보존)" % path.get_file()
		return ERR_UNAVAILABLE
	last_error = ""
	var f := FileAccess.open(tmp_path(), FileAccess.WRITE)
	if f == null:
		var open_err := FileAccess.get_open_error()
		last_error = "저장 파일을 열 수 없다(%d): %s" % [open_err, tmp_path()]
		return open_err
	var ok := f.store_string(JSON.stringify(progress.to_dict(), "\t"))
	f.close()
	if not ok:
		_remove(tmp_path())
		last_error = "저장 파일 쓰기 실패: %s" % tmp_path()
		return ERR_FILE_CANT_WRITE

	var had_old := FileAccess.file_exists(path)
	if had_old:
		_remove(bak_path())
		var bak_err := DirAccess.rename_absolute(path, bak_path())
		if bak_err != OK:
			_remove(tmp_path())
			last_error = "이전 저장을 백업하지 못했다(%d). 이전 저장을 유지한다." % bak_err
			return bak_err
	var move_err := DirAccess.rename_absolute(tmp_path(), path)
	if move_err != OK:
		if had_old:
			DirAccess.rename_absolute(bak_path(), path)
		last_error = "저장 파일 교체 실패(%d). 이전 저장을 유지한다." % move_err
		return move_err
	_remove(bak_path())
	return OK


## 읽는다. 파일이 없으면 빈 진행. 모두 깨져 있으면 빈 진행과 last_error를 남긴다.
func load_progress() -> ProgressData:
	last_error = ""
	var found_any := false
	for candidate: String in [path, tmp_path(), bak_path()]:
		if not FileAccess.file_exists(candidate):
			continue
		found_any = true
		var data: Variant = _read_dict(candidate)
		if data is Dictionary:
			var version := ProgressData.version_of(data)
			if version > ProgressData.SAVE_VERSION:
				var keep := future_backup_path(version)
				var copy_err: Error = copy_file.call(candidate, keep)
				if copy_err != OK:
					# 보관에 실패하면 원본을 덮어쓰지 않도록 저장을 끈다.
					read_only = true
					last_error = "저장 형식 v%d을 읽지 못했고 보관도 실패했다(%d). 원본을 지키려고 저장하지 않는다" % [version, copy_err]
					return ProgressData.new()
				last_error = "저장 형식 v%d을 이 버전이 읽지 못해 %s 에 보관하고 새로 시작한다" % [version, keep.get_file()]
				return ProgressData.new()
			if candidate != path:
				last_error = "저장 파일을 %s 에서 복구했다" % candidate.get_file()
			return ProgressData.from_dict(data)
	if found_any:
		last_error = "저장 파일이 깨져 새로 시작한다: %s" % path
	return ProgressData.new()


## 새 형식 저장을 보관하는 경로. 예: user://progress.v3.json
func future_backup_path(version: int) -> String:
	return "%s.v%d.%s" % [path.get_basename(), version, path.get_extension()]


## 저장 파일을 모두 지운다(테스트와 "진행 초기화"용).
func clear() -> void:
	for p: String in [path, tmp_path(), bak_path()]:
		_remove(p)


static func _read_dict(file_path: String) -> Variant:
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(file_path)) != OK:
		return null
	return json.data if json.data is Dictionary else null


static func _remove(file_path: String) -> void:
	if FileAccess.file_exists(file_path):
		DirAccess.remove_absolute(file_path)
