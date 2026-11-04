class_name DogamView
extends PanelContainer
## 도감 화면. 모은 카드의 이름과 해설을 보여 준다.
## 기준 카드는 처음부터 보이고, 판정 대상 카드는 정답을 맞혀야 열린다.
## 학설이 갈리는 카드(disputed)는 판정 없이 해설용으로 항상 보인다(개발 모드에서만 로드된다).

## "보드로" 버튼을 눌렀다.
signal closed

var _summary: Label
var _list: VBoxContainer
var _detail: Label
var _config: GameConfig


func _init() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.PAPER, HanjiTheme.BORDER, 1, 12.0))
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	add_child(root)

	var header := HBoxContainer.new()
	root.add_child(header)
	_summary = Label.new()
	_summary.add_theme_font_size_override("font_size", 22)
	_summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_summary)
	var close := Button.new()
	close.text = "보드로"
	close.pressed.connect(func() -> void: closed.emit())
	header.add_child(close)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	root.add_child(body)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(460, 0)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)

	var detail_panel := PanelContainer.new()
	detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(detail_panel)
	_detail = Label.new()
	_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.custom_minimum_size = Vector2(320, 0)
	_detail.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	detail_panel.add_child(_detail)


## 도감 내용을 다시 그린다.
func show_dogam(config: GameConfig, cards: CardSet, progress: ProgressData) -> void:
	_config = config
	for child in _list.get_children():
		child.queue_free()
	var collected_count := 0
	for c: CardData in cards.playable:
		if progress.is_collected(c.id):
			collected_count += 1
	var complete := collected_count > 0 and collected_count == cards.playable.size()
	_summary.text = "%s  %d / %d" % ["도감 완성" if complete else "도감", collected_count, cards.playable.size()]
	_detail.text = "왼쪽에서 모은 카드를 누르면 해설이 열립니다."

	for n in config.nation_ids():
		var nation_title := Label.new()
		nation_title.text = config.nation_label(n)
		nation_title.add_theme_font_size_override("font_size", 20)
		_list.add_child(nation_title)
		for e in config.era_ids():
			_list.add_child(HanjiTheme.small_label("%s — %s" % [config.era_label(e), config.era_definition(e)]))
			for a: CardData in cards.anchors_for_cell(n, e):
				_add_entry("기준 · " + a.title, a, true)
			for c: CardData in cards.playable_for_cell(n, e):
				var known := progress.is_collected(c.id)
				_add_entry(c.title if known else "??? (아직 모으지 못함)", c, known)

	if not cards.disputed.is_empty():
		var title := Label.new()
		title.text = "견해가 나뉘는 기록 (판정 제외)"
		title.add_theme_font_size_override("font_size", 20)
		_list.add_child(title)
		for d: CardData in cards.disputed:
			_add_entry(d.title, d, true)


## 카드 해설 문장을 만든다(화면 밖에서도 쓸 수 있게 static).
static func describe(config: GameConfig, c: CardData) -> String:
	var lines: PackedStringArray = PackedStringArray()
	lines.append(c.title)
	lines.append("%s · %s (%s)" % [config.nation_label(c.nation), config.era_label(c.era), config.era_definition(c.era)])
	if not c.date_label.is_empty():
		lines.append("연도(참고): " + c.date_label)
	lines.append("")
	if not c.explanation.is_empty():
		lines.append(c.explanation)
	if c.disputed:
		lines.append("")
		lines.append("견해가 나뉨: " + c.disputed_note)
	lines.append("")
	var source := "근거: " + c.source_name
	if not c.source_note.is_empty():
		source += " — " + c.source_note
	lines.append(source)
	lines.append("사실 확인: " + ("완료" if c.verified else "확인 전"))
	return "\n".join(lines)


func _add_entry(text: String, card: CardData, enabled: bool) -> void:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.disabled = not enabled
	b.pressed.connect(func() -> void: _detail.text = describe(_config, card))
	_list.add_child(b)
