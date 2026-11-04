class_name BoardCell
extends PanelContainer
## 보드의 한 칸(나라 × 시기). 기준 카드가 있으면 이름을 보여 준다.
## 카드를 끌어다 놓으면 card_dropped, 누르면 cell_clicked를 보낸다. 판정은 하지 않는다.

## 카드가 이 칸에 놓였다.
signal card_dropped(nation: String, era: String)
## 이 칸을 눌렀다(카드를 고른 뒤 누르는 방식).
signal cell_clicked(nation: String, era: String)

var nation: String = ""
var era: String = ""

var _filled: bool = false
var _base_style: StyleBoxFlat
var _anchor_label: Label
var _content_label: Label


## 칸을 만든다. anchor_titles: 이 칸의 기준 카드 이름들.
func setup(cell_nation: String, cell_era: String, anchor_titles: PackedStringArray) -> void:
	nation = cell_nation
	era = cell_era
	custom_minimum_size = Vector2(176, 96)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_exited.connect(_restore_style)

	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(box)

	_anchor_label = Label.new()
	_anchor_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anchor_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_anchor_label.add_theme_font_size_override("font_size", 13)
	_anchor_label.text = "기준: " + ", ".join(anchor_titles)
	_anchor_label.visible = not anchor_titles.is_empty()
	box.add_child(_anchor_label)

	_content_label = Label.new()
	_content_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_content_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	box.add_child(_content_label)
	show_empty()


## 빈 칸으로 되돌린다(새 라운드).
func show_empty() -> void:
	_filled = false
	_content_label.text = ""
	var bg: Color = HanjiTheme.ANCHOR if _anchor_label.visible else HanjiTheme.CELL
	_set_base(HanjiTheme.box(bg, HanjiTheme.BORDER, 1))


## 카드가 놓인 칸. correct가 false면 오답으로 공개된 카드다.
func show_placed(title: String, correct: bool) -> void:
	_filled = true
	if correct:
		_content_label.text = title
		_set_base(HanjiTheme.box(HanjiTheme.CORRECT, HanjiTheme.BORDER, 2))
	else:
		_content_label.text = "%s\n(오답 공개)" % title
		_set_base(HanjiTheme.box(HanjiTheme.WRONG, HanjiTheme.BORDER, 2))


## 오답으로 고른 칸을 잠깐 붉게 표시한다.
func flash_wrong() -> void:
	modulate = Color(1.0, 0.6, 0.6)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, 0.8)


## 카드가 놓였는지.
func is_filled() -> bool:
	return _filled


func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	var ok: bool = not _filled and data is Dictionary and str(data.get("kind", "")) == CardView.DRAG_KIND
	if ok:
		add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.HOVER, HanjiTheme.ACCENT, 2))
	return ok


func _drop_data(_at_position: Vector2, _data: Variant) -> void:
	_restore_style()
	card_dropped.emit(nation, era)


func _gui_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
		cell_clicked.emit(nation, era)
		accept_event()


func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAG_END:
		_restore_style()


func _set_base(style: StyleBoxFlat) -> void:
	_base_style = style
	_restore_style()


func _restore_style() -> void:
	if _base_style != null:
		add_theme_stylebox_override("panel", _base_style)
