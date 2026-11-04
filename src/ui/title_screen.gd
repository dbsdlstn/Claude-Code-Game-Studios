class_name TitleScreen
extends CenterContainer
## 타이틀 화면: 시작하기 / 이어하기 / 도감 / 하는 방법(웹 빌드 D20과 같은 구성).
##
## 사용 예:
##   var t := TitleScreen.new()
##   t.start_pressed.connect(_start_new_round)
##   t.set_can_continue(progress.has_current_round())

signal start_pressed
signal continue_pressed
signal dogam_pressed
signal help_pressed

var _continue_button: Button
var _start_button: Button
var _summary: Label


func _init() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	box.custom_minimum_size = Vector2(360, 0)
	add_child(box)
	var title := Label.new()
	title.text = "한양 도감"
	title.add_theme_font_size_override("font_size", 48)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var sub := HanjiTheme.small_label("삼국시대 — 이름을 숨긴 카드를 단서로 추리해 도감을 채운다", 15)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(sub)
	_summary = HanjiTheme.small_label("", 15)
	_summary.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_summary)
	_start_button = _button(box, "시작하기", func() -> void: start_pressed.emit())
	_continue_button = _button(box, "이어하기", func() -> void: continue_pressed.emit())
	_button(box, "도감", func() -> void: dogam_pressed.emit())
	_button(box, "하는 방법", func() -> void: help_pressed.emit())


## 이어하기 버튼을 켜고 끈다(진행 중 라운드가 저장돼 있을 때만).
func set_can_continue(can_continue: bool) -> void:
	_continue_button.disabled = not can_continue


## 도감 진행을 한 줄로 보여 준다. 예: "도감 3 / 36"
func set_summary(text: String) -> void:
	_summary.text = text


## 키보드 초점을 첫 버튼에 둔다.
func focus_default() -> void:
	if not _continue_button.disabled:
		_continue_button.grab_focus()
	else:
		_start_button.grab_focus()


func _button(parent: Control, text: String, on_press: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 44)
	b.pressed.connect(on_press)
	parent.add_child(b)
	return b
