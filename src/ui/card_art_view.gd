class_name CardArtView
extends PanelContainer
## 카드 일러스트 영역(4:3, 기본 220×165, 아트 바이블 §7).
## 숨김 상태는 먹 번짐 대신 진한 한지 바탕에 큰 "?"만 그린다(일러스트 파일은 정답 전까지 쓰지 않는다).
## 공개 후에는 CardArt.revealed_path(): 카드 이미지 또는 유형별 대체 문양 SVG.
##
## 사용 예:
##   var art := CardArtView.new()
##   art.show_hidden()
##   art.show_revealed(card)

var _texture_rect: TextureRect
var _question: Label
var _caption: Label


func _init(art_size: Vector2 = Vector2(220, 165)) -> void:
	custom_minimum_size = art_size
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.ANCHOR, HanjiTheme.BORDER, 1, 4.0))
	_texture_rect = TextureRect.new()
	_texture_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_texture_rect)
	_question = Label.new()
	_question.text = "?"
	_question.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_question.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_question.add_theme_font_size_override("font_size", 64)
	_question.add_theme_color_override("font_color", HanjiTheme.MUTED)
	_question.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_question)
	_caption = HanjiTheme.small_label("그림 준비 중", 12)
	_caption.size_flags_vertical = Control.SIZE_SHRINK_END
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_caption)
	show_hidden()


## 숨김 상태: "?"만.
func show_hidden() -> void:
	_texture_rect.texture = null
	_texture_rect.visible = false
	_question.visible = true
	_caption.visible = false


## 공개 상태: 카드 그림 또는 대체 문양. 파일을 못 읽으면 "?"로 둔다.
func show_revealed(card: CardData) -> void:
	var path := CardArt.revealed_path(card)
	var tex: Texture2D = null
	if ResourceLoader.exists(path):
		tex = load(path) as Texture2D
	if tex == null:
		push_warning("카드 그림을 읽지 못했다: %s" % path)
		show_hidden()
		return
	_texture_rect.texture = tex
	_texture_rect.visible = true
	_question.visible = false
	_caption.visible = CardArt.is_placeholder(path)
