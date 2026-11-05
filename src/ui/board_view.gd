class_name BoardView
extends GridContainer
## 나라 × 시기 보드. 열 머리글에 시기 정의를 항상 보여 준다(decision-log D2).
## 본게임과 튜토리얼이 함께 쓴다. 판정은 하지 않고 cell_targeted만 보낸다.
##
## 사용 예:
##   var board := BoardView.new()
##   board.setup(cfg, card_set.anchors)
##   board.cell_targeted.connect(_on_target)

## 칸에 카드를 놓으려 했다(드롭 또는 고른 카드로 칸 누르기).
## by_drop: 드롭이면 true. by_keyboard: 키보드로 칸을 눌렀으면 true.
signal cell_targeted(nation: String, era: String, by_drop: bool, by_keyboard: bool)

## 클릭만 했을 때 강조를 지우는 시간(웹 refs.js와 같은 2.5초).
const REF_CLICK_SECONDS := 2.5

## cell_key -> BoardCell
var _cells: Dictionary = {}
## 기준 카드 id -> cell_key (관계 단서 강조용)
var _anchor_cells: Dictionary = {}
var _ref_tween: Tween


## 보드를 만든다. anchors: 보드에 보일 기준 카드.
func setup(config: GameConfig, anchors: Array[CardData]) -> void:
	columns = config.era_ids().size() + 1
	add_theme_constant_override("h_separation", 6)
	add_theme_constant_override("v_separation", 6)
	add_child(Control.new())  # 왼쪽 위 빈 칸
	for e in config.era_ids():
		var header := VBoxContainer.new()
		header.custom_minimum_size = Vector2(176, 0)
		var name_label := Label.new()
		name_label.text = config.era_label(e)
		name_label.add_theme_font_size_override("font_size", 18)
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		header.add_child(name_label)
		var def_label := HanjiTheme.small_label(config.era_definition(e))
		# 단어 단위로만 줄을 바꾼다("전/쟁기"처럼 낱말 중간에서 끊기지 않게, CI 화면 S2).
		def_label.autowrap_mode = TextServer.AUTOWRAP_WORD
		def_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		def_label.custom_minimum_size = Vector2(176, 0)
		header.add_child(def_label)
		add_child(header)
	for n in config.nation_ids():
		# 행 머리글: 왼쪽 5px 나라색 띠 + 인장 + 먹색 이름(바이블 §3·§4.2, 웹 .nation-head와 같은 구성).
		# 나라색은 띠와 인장 바탕(장식)에만 쓰고 글자는 먹색이다(신라 금색 글자는 대비 부족, D42).
		# 선택지라 정답 누출이 아니다(D37).
		var head := PanelContainer.new()
		var head_style := HanjiTheme.box(HanjiTheme.ANCHOR, HanjiTheme.ANCHOR, 0, 6.0)
		head_style.border_width_left = 5
		head_style.border_color = HanjiTheme.nation_color(n)
		head.add_theme_stylebox_override("panel", head_style)
		head.custom_minimum_size = Vector2(72, 0)
		var row := VBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 6)
		head.add_child(row)
		var seal := HanjiTheme.seal(n, config.nation_label(n))
		seal.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		row.add_child(seal)
		var row_label := Label.new()
		row_label.text = config.nation_label(n)
		row_label.add_theme_font_size_override("font_size", 16)
		row_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		row.add_child(row_label)
		add_child(head)
		for e in config.era_ids():
			var titles := PackedStringArray()
			for a: CardData in anchors:
				if a.matches(n, e):
					titles.append(a.title)
			var bc := BoardCell.new()
			bc.setup(n, e, titles)
			bc.card_dropped.connect(func(cn: String, ce: String) -> void: cell_targeted.emit(cn, ce, true, false))
			bc.cell_clicked.connect(func(cn: String, ce: String, kb: bool) -> void: cell_targeted.emit(cn, ce, false, kb))
			_cells[CardData.make_cell_key(n, e)] = bc
			add_child(bc)
	_anchor_cells = anchor_cell_keys(anchors)


## 기준 카드 id → 칸 키. 사용 예: anchor_cell_keys(card_set.anchors)["goguryeo-peak-anchor"] → "goguryeo/peak"
static func anchor_cell_keys(anchors: Array[CardData]) -> Dictionary:
	var out: Dictionary = {}
	for a: CardData in anchors:
		out[a.id] = a.cell_key()
	return out


## 기준 카드가 놓인 칸을 강조한다(웹 refs.js와 같은 동작). 한 번에 한 칸만.
## sticky: true면 clear_ref()까지 유지(참조 버튼에 초점이 있는 동안), false면 2.5초 뒤 지운다(클릭만).
## 모르는 id면 강조를 지우기만 한다.
func show_ref(anchor_id: String, sticky: bool) -> void:
	clear_ref()
	if not _anchor_cells.has(anchor_id):
		return
	var c: BoardCell = _cells.get(_anchor_cells[anchor_id])
	if c == null:
		return
	c.set_ref_highlight(true)
	if not sticky and is_inside_tree():
		_ref_tween = create_tween()
		_ref_tween.tween_interval(REF_CLICK_SECONDS)
		_ref_tween.tween_callback(clear_ref)


## CardView의 관계 단서 버튼을 이 보드의 강조에 잇는다(본게임과 튜토리얼이 같이 쓴다).
func wire_card(view: CardView) -> void:
	view.anchor_ref_focused.connect(func(id: String) -> void: show_ref(id, true))
	view.anchor_ref_unfocused.connect(func(_id: String) -> void: clear_ref())
	view.anchor_ref_pressed.connect(func(id: String, sticky: bool) -> void: show_ref(id, sticky))


## 관계 단서 강조를 모두 지운다.
func clear_ref() -> void:
	if _ref_tween != null and _ref_tween.is_valid():
		_ref_tween.kill()
	_ref_tween = null
	for bc: BoardCell in _cells.values():
		if bc.is_ref_highlighted():
			bc.set_ref_highlight(false)


## 모든 칸을 비운다.
func reset() -> void:
	clear_ref()
	for cell: BoardCell in _cells.values():
		cell.show_empty()


## 키보드 초점을 첫 칸으로 옮긴다.
func focus_first_cell(config: GameConfig) -> void:
	var c := cell(config.nation_ids()[0], config.era_ids()[0])
	if c != null:
		c.grab_focus()


## 칸을 찾는다. 없으면 null.
func cell(nation: String, era: String) -> BoardCell:
	return _cells.get(CardData.make_cell_key(nation, era))


## 칸에 카드 이름을 더한다.
func show_placed(nation: String, era: String, title: String, correct: bool) -> void:
	var c := cell(nation, era)
	if c != null:
		c.show_placed(title, correct)


## 고른 칸을 잠깐 붉게.
func flash_wrong(nation: String, era: String) -> void:
	var c := cell(nation, era)
	if c != null:
		c.flash_wrong()
