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
	# 1024×768 문양을 약 0.2배로 줄여 그리므로 밉맵 필터를 쓴다(리뷰 3 H2, D44).
	# 텍스처에 밉맵이 없으면(가져오기 기본값) 엔진이 선형 필터로 그린다.
	_texture_rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
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


## 공개 상태: 카드 그림 → 못 읽으면 유형별 대체 문양 → 그것도 못 읽으면 빈 바탕과 "그림 준비 중".
## 공개 상태에서는 "?"를 쓰지 않는다(숨김 상태와 헷갈리지 않게, 리뷰 3 H3, 바이블 §7.1).
func show_revealed(card: CardData) -> void:
	var path := CardArt.revealed_path(card)
	var tex := _try_load(path)
	if tex == null and not CardArt.is_placeholder(path):
		push_warning("카드 그림을 읽지 못해 대체 문양을 쓴다: %s" % path)
		path = CardArt.placeholder_path(card.type)
		tex = _try_load(path)
	if tex == null:
		push_warning("대체 문양도 읽지 못했다: %s" % path)
	_texture_rect.texture = tex
	_texture_rect.visible = tex != null
	_question.visible = false
	_caption.visible = tex == null or CardArt.is_placeholder(path)


static func _try_load(path: String) -> Texture2D:
	if not ResourceLoader.exists(path):
		return null
	return load(path) as Texture2D
