class_name CardView
extends PanelContainer
## 지금 놓을 카드(숨김 상태). 숨김 화면에 유형이 없다는 것은 tests/unit/ui/card_view_hidden_test.gd가
## 실제 노드를 만들어 보이는 글(Label·Button·툴팁)을 모아 확인한다(리뷰 3 P1).
## 이름·유형·나라 표시 없이 "?" 일러스트 영역과 보이는 단서만 보여 준다
## (아트 바이블 §3·§7, decision-log D37: 유형 배지는 시기를 알려 주므로 공개 후에만).
## 끌어서 칸에 놓거나, 눌러서 고른 뒤 칸을 누른다.
## 관계 단서의 기준 카드 버튼을 누르거나 초점을 주면 anchor_ref_focused로 그 기준 카드 칸 강조를 요청한다.

## "단서 더 보기"를 눌렀다.
signal more_clues_requested
## 카드를 눌러 고르거나 고르기를 풀었다. by_keyboard: Enter/Space로 골랐으면 true.
signal selection_changed(is_selected: bool, by_keyboard: bool)
## 관계 단서의 기준 카드 버튼에 초점이 왔다(강조 유지).
signal anchor_ref_focused(anchor_id: String)
## 그 버튼에서 초점이 떠났다(강조 끄기).
signal anchor_ref_unfocused(anchor_id: String)
## 그 버튼을 눌렀다. sticky: 버튼에 초점이 남아 있으면 true(유지), 아니면 false(2.5초).
signal anchor_ref_pressed(anchor_id: String, sticky: bool)

## 드래그 데이터의 종류 표시. BoardCell이 확인한다.
const DRAG_KIND := "hanyang_card"
const KIND_LABELS := {"description": "장면", "relation": "관계", "direct": "직접"}
## 숨김 상태 제목(모든 카드에 같다, 바이블 §7).
const HIDDEN_HEADING := "? 사건 카드"

## 눌러서 골랐는지.
var selected: bool = false

var _card_id: String = ""
## 기준 카드 id → 제목(관계 단서 버튼 글자). set_ref_titles로 받는다.
var _ref_titles: Dictionary = {}
var _art: CardArtView
var _heading: Label
var _clue_box: VBoxContainer
var _more_button: Button
var _help: Label


func _init() -> void:
	custom_minimum_size = Vector2(380, 0)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_DRAG
	focus_mode = Control.FOCUS_ALL
	focus_entered.connect(_apply_style)
	focus_exited.connect(_apply_style)
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", 8)
	add_child(box)

	_art = CardArtView.new()
	box.add_child(_art)

	_heading = Label.new()
	_heading.add_theme_font_size_override("font_size", 20)
	_heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(_heading)

	_clue_box = VBoxContainer.new()
	_clue_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_clue_box.add_theme_constant_override("separation", 6)
	box.add_child(_clue_box)

	_more_button = Button.new()
	_more_button.text = "단서 더 보기"
	_more_button.pressed.connect(func() -> void: more_clues_requested.emit())
	box.add_child(_more_button)

	_help = HanjiTheme.small_label("카드를 끌어 칸에 놓거나, 카드를 누른 뒤 칸을 누르세요. 키보드: 카드에서 Enter, 방향키로 칸 이동, Enter로 놓기.")
	_help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_help)
	_apply_style()


## 관계 단서 버튼에 쓸 기준 카드 제목. { anchor_id: title }
func set_ref_titles(titles: Dictionary) -> void:
	_ref_titles = titles


## 숨김 상태 단서 한 줄. 카드의 유형·나라·시기·제목을 쓰지 않는다(단서 본문만).
static func clue_line(clue: Dictionary) -> String:
	return "%d. [%s] %s" % [int(clue["level"]), KIND_LABELS.get(clue["kind"], ""), clue["text"]]


## 관계 단서 버튼 글자.
static func ref_button_text(title: String) -> String:
	return "  ▶ [%s] 칸 보기" % title


## 관계 단서가 가리키는 기준 카드 중 제목을 아는 것들: [[id, title], ...]
static func _refs_of(clue: Dictionary, ref_titles: Dictionary) -> Array:
	var out: Array = []
	if str(clue["kind"]) != "relation":
		return out
	for ref: String in clue["refs"]:
		if ref_titles.has(ref):
			out.append([ref, str(ref_titles[ref])])
	return out


## 카드와 보이는 단서를 보여 준다(숨김 상태).
func show_card(card: CardData, clues: Array[Dictionary], can_reveal_more: bool) -> void:
	_card_id = card.id
	_art.show_hidden()
	_art.visible = true
	_heading.text = HIDDEN_HEADING
	for child in _clue_box.get_children():
		child.queue_free()
	for clue: Dictionary in clues:
		var l := Label.new()
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(340, 0)
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		l.text = clue_line(clue)
		_clue_box.add_child(l)
		for pair: Array in _refs_of(clue, _ref_titles):
			_clue_box.add_child(_ref_button(pair[0], pair[1]))
	_more_button.visible = true
	_more_button.disabled = not can_reveal_more
	_help.visible = true
	set_selected(false)


## 놓을 카드가 없을 때(라운드 끝).
func show_none(text: String) -> void:
	_card_id = ""
	_art.visible = false
	_heading.text = text
	for child in _clue_box.get_children():
		child.queue_free()
	_more_button.visible = false
	_help.visible = false
	set_selected(false)


## 고름 표시를 바꾼다.
func set_selected(value: bool) -> void:
	selected = value and not _card_id.is_empty()
	_apply_style()


func _get_drag_data(_at_position: Vector2) -> Variant:
	if _card_id.is_empty():
		return null
	var preview := PanelContainer.new()
	# 미리보기는 Main 아래가 아니라 드래그 레이어에 붙으므로 테마를 직접 준다(한글 글꼴).
	preview.theme = HanjiTheme.current()
	preview.add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.CARD, HanjiTheme.ACCENT, 2))
	var l := Label.new()
	l.text = HIDDEN_HEADING
	l.add_theme_color_override("font_color", HanjiTheme.INK)
	preview.add_child(l)
	set_drag_preview(preview)
	return {"kind": DRAG_KIND, "card_id": _card_id}


func _gui_input(event: InputEvent) -> void:
	# 누른 뒤 끌지 않고 뗐을 때만 고르기를 바꾼다(끌어 놓으면 떼는 입력은 칸이 받는다).
	var mb := event as InputEventMouseButton
	var toggle := mb != null and mb.button_index == MOUSE_BUTTON_LEFT and not mb.pressed
	if mb == null and event.is_action_pressed("ui_accept"):
		toggle = true
	if toggle and not _card_id.is_empty():
		if mb != null and has_focus():
			release_focus()  # 마우스로 고를 때는 초점 테두리를 남기지 않는다(리뷰 2 L4)
		set_selected(not selected)
		selection_changed.emit(selected, mb == null)
		accept_event()


func _ref_button(anchor_id: String, title: String) -> Button:
	var b := Button.new()
	b.text = ref_button_text(title)
	b.flat = true
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	# 참조 글자는 청(웹 .ref-link와 같은 값). 초점 테두리는 테마의 짙은 금.
	b.add_theme_color_override("font_color", HanjiTheme.INDIGO)
	b.add_theme_color_override("font_hover_color", HanjiTheme.INDIGO)
	b.add_theme_color_override("font_focus_color", HanjiTheme.INDIGO)
	b.tooltip_text = "보드에서 기준 카드 [%s]가 놓인 칸을 잠깐 강조합니다" % title
	b.pressed.connect(func() -> void: anchor_ref_pressed.emit(anchor_id, b.has_focus()))
	b.focus_entered.connect(func() -> void: anchor_ref_focused.emit(anchor_id))
	b.focus_exited.connect(func() -> void: anchor_ref_unfocused.emit(anchor_id))
	return b


func _apply_style() -> void:
	# 고른 상태(노란 바탕 + 굵은 붉은 테두리)와 키보드 초점(붉은 테두리만)을 구분한다.
	if selected:
		add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.HOVER, HanjiTheme.ACCENT, 3, 12.0))
	elif has_focus():
		# 키보드 초점은 짙은 금(D42). 고른 상태(붉은 선택 테두리 + 노란 바탕)와 구분된다.
		add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.CARD, HanjiTheme.GOLD_DARK, 3, 12.0))
	else:
		add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.CARD, HanjiTheme.BORDER, 2, 12.0))
