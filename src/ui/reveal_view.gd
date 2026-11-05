class_name RevealView
extends VBoxContainer
## 공개된 카드(정답 후, 오답 공개, 도감): 일러스트(이미지 또는 유형별 대체 문양), 나라 인장, 제목,
## 유형 배지, 연도 캡션, 해설. 유형·인장은 공개 후에만 보인다(아트 바이블 §3·§7, decision-log D37).
## compact: 본게임 옆 패널용. 그림(160×120) 옆에 글을 두어 높이를 줄인다(웹 결과 카드와 같은 배치, CI 화면 S2).
##
## 사용 예:
##   var rv := RevealView.new(true)
##   rv.show_card(cfg, card, true, card.explanation)

var _art: CardArtView
var _seal_slot: HBoxContainer
var _title: Label
var _badge: Label
var _date: Label
var _explanation: Label


func _init(compact: bool = false) -> void:
	add_theme_constant_override("separation", 4)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 4)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if compact:
		var top := HBoxContainer.new()
		top.add_theme_constant_override("separation", 12)
		add_child(top)
		_art = CardArtView.new(Vector2(160, 120))
		_art.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		top.add_child(_art)
		top.add_child(info)
	else:
		_art = CardArtView.new()
		add_child(_art)
		add_child(info)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	info.add_child(row)
	_seal_slot = HBoxContainer.new()
	row.add_child(_seal_slot)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 18)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_title)
	_badge = Label.new()
	_badge.add_theme_font_size_override("font_size", 12)
	_badge.add_theme_color_override("font_color", HanjiTheme.MUTED)
	_badge.add_theme_stylebox_override("normal", HanjiTheme.box(HanjiTheme.CELL, HanjiTheme.BORDER, 1, 3.0))
	_badge.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_badge)
	_date = HanjiTheme.small_label("", 12)
	info.add_child(_date)
	_explanation = Label.new()
	_explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_explanation.custom_minimum_size = Vector2(240, 0)
	_explanation.add_theme_font_size_override("font_size", 15)
	info.add_child(_explanation)
	visible = false


## 카드를 공개 상태로 보인다. correct가 false면 제목 앞에 "× … (오답 공개)"(색만으로 구분하지 않게).
## explanation: 비우면 해설 줄을 숨긴다.
func show_card(config: GameConfig, card: CardData, correct: bool = true, explanation: String = "") -> void:
	for child in _seal_slot.get_children():
		child.queue_free()
	_seal_slot.add_child(HanjiTheme.seal(card.nation, config.nation_label(card.nation)))
	_art.show_revealed(card)
	_title.text = card.title if correct else "× %s (오답 공개)" % card.title
	_badge.text = HanjiTheme.type_label(card.type)
	_date.text = card.date_label
	_date.visible = not card.date_label.is_empty()
	_explanation.text = explanation
	_explanation.visible = not explanation.is_empty()
	visible = true


## 숨긴다(새 라운드, 아직 고른 카드 없음).
func clear() -> void:
	visible = false
