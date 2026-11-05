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
## 이 칸을 눌렀다(카드를 고른 뒤 누르는 방식). by_keyboard: Enter/Space(ui_accept)로 눌렀으면 true.
signal cell_clicked(nation: String, era: String, by_keyboard: bool)

## 칸에 보일 카드 이름 줄 수. 넘으면 최근 줄만 보이고 "외 n장"으로 줄인다(리뷰 2 L6, 보드 넘침 방지).
const MAX_VISIBLE_LINES := 2

var nation: String = ""
var era: String = ""

var _base_style: StyleBoxFlat
var _focus_style: StyleBoxFlat
var _hover_style: StyleBoxFlat
var _highlight_style: StyleBoxFlat
## 관계 단서 강조 중인지. 다른 입력(마우스 나감, 초점, 드래그 끝)이 와도 강조를 유지한다(리뷰 3 H5).
var _ref_on: bool = false
var _hovering: bool = false
var _anchor_label: Label
## 놓인 카드 줄을 줄마다 Label로 그린다(정답 줄과 오답 줄의 글자색이 따로, CI 화면 S2).
var _lines_box: VBoxContainer
## _lines와 같은 순서의 정답 여부.
var _line_correct: Array[bool] = []
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
	# 관계 단서의 기준 카드 칸 강조: 청색 3px + 옅은 청 바탕(웹 .cell.ref-target과 같은 값).
	_highlight_style = HanjiTheme.box(HanjiTheme.REF_TARGET_BG, HanjiTheme.INDIGO, 3)

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

	_lines_box = VBoxContainer.new()
	_lines_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lines_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_lines_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_lines_box.add_theme_constant_override("separation", 2)
	box.add_child(_lines_box)
	show_empty()


## 빈 칸으로 되돌린다(새 라운드).
func show_empty() -> void:
	_lines = PackedStringArray()
	_line_correct.clear()
	_render_lines()
	tooltip_text = ""
	var bg: Color = HanjiTheme.ANCHOR if _anchor_label.visible else HanjiTheme.CELL
	_set_base(HanjiTheme.box(bg, HanjiTheme.BORDER, 1))


## 카드를 한 장 더한다. correct가 false면 오답으로 공개된 카드다. 칸 색은 마지막 카드를 따른다.
func show_placed(title: String, correct: bool) -> void:
	# 색만으로 구분하지 않게 ○/× 표시와 글자를 함께 쓴다(바이블 §4.3).
	_lines.append(line_text(title, correct))
	_line_correct.append(correct)
	_render_lines()
	tooltip_text = "\n".join(_lines)
	var bg: Color = HanjiTheme.CORRECT if correct else HanjiTheme.WRONG
	_set_base(HanjiTheme.box(bg, HanjiTheme.BORDER, 2))


## 칸에 쌓이는 한 줄. 정답 "○ 제목", 오답 "× 제목 (오답)".
static func line_text(title: String, correct: bool) -> String:
	return "○ %s" % title if correct else "× %s (오답)" % title


## 줄 Label을 다시 만든다. 보이는 글은 visible_text()와 같다(맨 위 "외 n장" + 최근 MAX_VISIBLE_LINES줄).
func _render_lines() -> void:
	for child in _lines_box.get_children():
		_lines_box.remove_child(child)
		child.queue_free()
	var hidden := maxi(_lines.size() - MAX_VISIBLE_LINES, 0)
	if hidden > 0:
		_lines_box.add_child(_line_label("외 %d장" % hidden, HanjiTheme.MUTED))
	for i in range(hidden, _lines.size()):
		var color: Color = HanjiTheme.CORRECT_TEXT if _line_correct[i] else HanjiTheme.WRONG_TEXT
		_lines_box.add_child(_line_label(_lines[i], color))


func _line_label(text: String, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", 14)
	l.add_theme_color_override("font_color", color)
	return l


## 칸에 보일 글: 최근 max_lines줄, 그보다 많으면 맨 위에 "외 n장".
## 사용 예: BoardCell.visible_text(PackedStringArray(["가", "나", "다"]), 2) → "외 1장\n나\n다"
static func visible_text(lines: PackedStringArray, max_lines: int) -> String:
	if lines.size() <= max_lines:
		return "\n".join(lines)
	var shown := lines.slice(lines.size() - max_lines)
	return "외 %d장\n%s" % [lines.size() - max_lines, "\n".join(shown)]


## 관계 단서 강조를 켜고 끈다(청 3px + 옅은 청 바탕, 웹 .cell.ref-target과 같은 값).
## 시간 관리는 BoardView가 한다(초점 동안 유지, 클릭만 하면 2.5초).
func set_ref_highlight(on: bool) -> void:
	_ref_on = on
	_restore_style()


## 관계 단서 강조 중인지.
func is_ref_highlighted() -> bool:
	return _ref_on


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
		# 마우스로 누른 칸에는 키보드 초점 테두리를 남기지 않는다(리뷰 2 L4).
		if has_focus():
			release_focus()
		cell_clicked.emit(nation, era, false)
		accept_event()
	elif event.is_action_pressed("ui_accept"):
		cell_clicked.emit(nation, era, true)
		accept_event()


func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAG_END:
		_restore_style()


func _set_base(style: StyleBoxFlat) -> void:
	_base_style = style
	# 키보드 초점: 짙은 금 3px + 옅은 금 바탕(D42, 웹 .cell:focus-visible과 같은 값).
	# PanelContainer는 focus 스타일을 그리지 않으므로 직접 바꾼다.
	_focus_style = style.duplicate() as StyleBoxFlat
	_focus_style.bg_color = HanjiTheme.FOCUS_BG
	_focus_style.border_color = HanjiTheme.GOLD_DARK
	_focus_style.set_border_width_all(3)
	_restore_style()


func _restore_style() -> void:
	_hovering = false
	if _base_style == null:
		return
	if _ref_on:
		add_theme_stylebox_override("panel", _highlight_style)
	else:
		add_theme_stylebox_override("panel", _focus_style if has_focus() else _base_style)
