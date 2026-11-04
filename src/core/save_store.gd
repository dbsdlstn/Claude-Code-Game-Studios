class_name SaveStore
extends RefCounted
## ProgressData를 JSON 파일(user://)로 저장하고 읽는다. 경로는 GameConfig.save_path.

## 저장 파일 경로.
var path: String = ""
## 마지막 읽기/쓰기에서 생긴 문제. 없으면 빈 문자열.
var last_error: String = ""


func _init(save_path: String) -> void:
	path = save_path


## 저장한다. 임시 파일에 쓴 뒤 바꿔 넣어 쓰다 끊겨도 기존 저장이 깨지지 않게 한다.
func save(progress: ProgressData) -> Error:
	last_error = ""
	var tmp_path := path + ".tmp"
	var f := FileAccess.open(tmp_path, FileAccess.WRITE)
	if f == null:
		var err := FileAccess.get_open_error()
		last_error = "저장 파일을 열 수 없다(%d): %s" % [err, tmp_path]
		return err
	var ok := f.store_string(JSON.stringify(progress.to_dict(), "\t"))
	f.close()
	if not ok:
		last_error = "저장 파일 쓰기 실패: %s" % tmp_path
		return ERR_FILE_CANT_WRITE
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	var rename_err := DirAccess.rename_absolute(tmp_path, path)
	if rename_err != OK:
		last_error = "저장 파일 교체 실패(%d): %s" % [rename_err, path]
	return rename_err


## 읽는다. 파일이 없으면 빈 진행을 돌려준다. 깨져 있으면 빈 진행과 last_error를 남긴다.
func load_progress() -> ProgressData:
	last_error = ""
	if not FileAccess.file_exists(path):
		return ProgressData.new()
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		last_error = "저장 파일이 깨졌다 %d행: %s" % [json.get_error_line(), json.get_error_message()]
		return ProgressData.new()
	if not (json.data is Dictionary):
		last_error = "저장 파일 형식이 아니다"
		return ProgressData.new()
	return ProgressData.from_dict(json.data)


## 저장 파일을 지운다(테스트와 "진행 초기화"용).
func clear() -> void:
	for p: String in [path, path + ".tmp"]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)
