class_name BoardView
extends GridContainer
## 나라 × 시기 보드. 열 머리글에 시기 정의를 항상 보여 준다(decision-log D2).
## 본게임과 튜토리얼이 함께 쓴다. 판정은 하지 않고 cell_targeted만 보낸다.
##
## 사용 예:
##   var board := BoardView.new()
##   board.setup(cfg, card_set.anchors)
##   board.cell_targeted.connect(_on_target)

## 칸에 카드를 놓으려 했다(드롭 또는 고른 카드로 칸 누르기). by_drop: 드롭이면 true.
signal cell_targeted(nation: String, era: String, by_drop: bool)

## cell_key -> BoardCell
var _cells: Dictionary = {}


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
		def_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		def_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		def_label.custom_minimum_size = Vector2(176, 0)
		header.add_child(def_label)
		add_child(header)
	for n in config.nation_ids():
		var row_label := Label.new()
		row_label.text = config.nation_label(n)
		row_label.add_theme_font_size_override("font_size", 18)
		row_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row_label.custom_minimum_size = Vector2(64, 0)
		add_child(row_label)
		for e in config.era_ids():
			var titles := PackedStringArray()
			for a: CardData in anchors:
				if a.matches(n, e):
					titles.append(a.title)
			var bc := BoardCell.new()
			bc.setup(n, e, titles)
			bc.card_dropped.connect(func(cn: String, ce: String) -> void: cell_targeted.emit(cn, ce, true))
			bc.cell_clicked.connect(func(cn: String, ce: String) -> void: cell_targeted.emit(cn, ce, false))
			_cells[CardData.make_cell_key(n, e)] = bc
			add_child(bc)


## 모든 칸을 비운다.
func reset() -> void:
	for cell: BoardCell in _cells.values():
		cell.show_empty()


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
