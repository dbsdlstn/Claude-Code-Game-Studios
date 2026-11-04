extends GdUnitTestSuite
## BoardCell.visible_text: 한 칸에 카드가 많이 쌓여도 보드가 넘치지 않게 줄인다(리뷰 2 L6).
## 정적 함수만 부르므로 노드를 만들지 않는다(고아 노드 없음).


func test_two_lines_are_shown_as_is() -> void:
	assert_str(BoardCell.visible_text(PackedStringArray(["가", "나"]), 2)).is_equal("가\n나")


func test_more_lines_collapse_to_count_and_latest() -> void:
	var text := BoardCell.visible_text(PackedStringArray(["가", "나", "다"]), 2)
	assert_str(text).is_equal("외 1장\n나\n다")


func test_empty_is_empty() -> void:
	assert_str(BoardCell.visible_text(PackedStringArray(), 2)).is_empty()
