class_name BoardCell
extends PanelContainer
## 보드의 한 칸(나라 × 시기). 기준 카드가 있으면 이름을 보여 준다.
## 카드를 끌어다 놓으면 card_dropped, 누르거나 Enter/Space를 누르면 cell_clicked를 보낸다.
## 판정은 하지 않는다. 카드는 몇 장이든 받는다(decision-log D22).
##
## 사용 예:
##   var cell := BoardCell.new()
##   cell.setup("silla", "peak", PackedStringArray(["박혁거세 신화"]))
##   cell.card_dropped.connect(_on_target)

## 카드가 이 칸에 놓였다.
signal card_dropped(nation: String, era: String)
## 이 칸을 눌렀다(카드를 고른 뒤 누르는 방식).
signal cell_clicked(nation: String, era: String)

var nation: String = ""
var era: String = ""

var _base_style: StyleBoxFlat
var _focus_style: StyleBoxFlat
var _hover_style: StyleBoxFlat
var _hovering: bool = false
var _anchor_label: Label
var _content_label: Label
var _lines: PackedStringArray = PackedStringArray()


## 칸을 만든다. anchor_titles: 이 칸의 기준 카드 이름들.
func setup(cell_nation: String, cell_era: String, anchor_titles: PackedStringArray) -> void:
	nation = cell_nation
	era = cell_era
	custom_minimum_size = Vector2(176, 96)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	mouse_exited.connect(_restore_style)
	focus_entered.connect(_restore_style)
	focus_exited.connect(_restore_style)
	_hover_style = HanjiTheme.box(HanjiTheme.HOVER, HanjiTheme.ACCENT, 2)

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
	_content_label.add_theme_font_size_override("font_size", 14)
	box.add_child(_content_label)
	show_empty()


## 빈 칸으로 되돌린다(새 라운드).
func show_empty() -> void:
	_lines = PackedStringArray()
	_content_label.text = ""
	var bg: Color = HanjiTheme.ANCHOR if _anchor_label.visible else HanjiTheme.CELL
	_set_base(HanjiTheme.box(bg, HanjiTheme.BORDER, 1))


## 카드를 한 장 더한다. correct가 false면 오답으로 공개된 카드다. 칸 색은 마지막 카드를 따른다.
func show_placed(title: String, correct: bool) -> void:
	_lines.append(title if correct else "%s (오답 공개)" % title)
	_content_label.text = "\n".join(_lines)
	var bg: Color = HanjiTheme.CORRECT if correct else HanjiTheme.WRONG
	_set_base(HanjiTheme.box(bg, HanjiTheme.BORDER, 2))


## 오답으로 고른 칸을 잠깐 붉게 표시한다.
func flash_wrong() -> void:
	modulate = Color(1.0, 0.6, 0.6)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, 0.8)


## 놓인 카드 수.
func placed_count() -> int:
	return _lines.size()


func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	var ok: bool = data is Dictionary and str(data.get("kind", "")) == CardView.DRAG_KIND
	if ok and not _hovering:
		_hovering = true
		add_theme_stylebox_override("panel", _hover_style)
	return ok


func _drop_data(_at_position: Vector2, _data: Variant) -> void:
	_restore_style()
	card_dropped.emit(nation, era)


func _gui_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
		cell_clicked.emit(nation, era)
		accept_event()
	elif event.is_action_pressed("ui_accept"):
		cell_clicked.emit(nation, era)
		accept_event()


func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAG_END:
		_restore_style()


func _set_base(style: StyleBoxFlat) -> void:
	_base_style = style
	# 키보드 초점은 같은 바탕에 붉은 테두리로 보인다(PanelContainer는 focus 스타일을 그리지 않는다).
	_focus_style = style.duplicate() as StyleBoxFlat
	_focus_style.border_color = HanjiTheme.ACCENT
	_focus_style.set_border_width_all(3)
	_restore_style()


func _restore_style() -> void:
	_hovering = false
	if _base_style == null:
		return
	add_theme_stylebox_override("panel", _focus_style if has_focus() else _base_style)
