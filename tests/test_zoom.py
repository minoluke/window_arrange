def test_initial_zoom_is_100(app):
    assert app.evaluate("() => state.zoom") == 1
    assert app.locator("#zoom-level").inner_text() == "100%"


def test_zoom_in_button_increases_scale(app):
    before_scale = app.evaluate("() => state.scale")
    app.locator("#zoom-in").click()
    after_scale = app.evaluate("() => state.scale")
    assert after_scale > before_scale
    assert app.evaluate("() => state.zoom") > 1


def test_zoom_out_button_decreases_scale(app):
    before_scale = app.evaluate("() => state.scale")
    app.locator("#zoom-out").click()
    after_scale = app.evaluate("() => state.scale")
    assert after_scale < before_scale


def test_zoom_reset_returns_to_fit(app):
    app.locator("#zoom-in").click()
    app.locator("#zoom-in").click()
    app.locator("#zoom-reset").click()
    assert app.evaluate("() => state.zoom") == 1
    assert app.locator("#zoom-level").inner_text() == "100%"


def test_zoom_is_clamped_at_limits(app):
    # 連打して上限を超えてもクランプされる
    for _ in range(30):
        app.locator("#zoom-in").click()
    z = app.evaluate("() => state.zoom")
    assert z <= 8 + 0.001

    app.locator("#zoom-reset").click()
    for _ in range(30):
        app.locator("#zoom-out").click()
    z = app.evaluate("() => state.zoom")
    assert z >= 0.2 - 0.001


def test_zoom_level_display_updates(app):
    app.locator("#zoom-in").click()
    text = app.locator("#zoom-level").inner_text()
    # "100%" 以外の値になっている
    assert text != "100%"
    assert text.endswith("%")


def test_wall_container_grows_when_zoomed_in(app):
    before = app.locator("#wall-container").bounding_box()
    for _ in range(3):
        app.locator("#zoom-in").click()
    after = app.locator("#wall-container").bounding_box()
    assert after["width"] > before["width"]


def test_painting_still_draggable_after_zoom(app):
    app.locator("#zoom-in").click()
    app.locator("#zoom-in").click()

    # 絵の中心あたりをつかんでドラッグ
    painting = app.locator(".painting").first
    box = painting.bounding_box()
    start_x = box["x"] + box["width"] / 2
    start_y = box["y"] + box["height"] / 2

    before_pos = app.evaluate("() => ({x: state.paintings[0].xCm, y: state.paintings[0].yCm})")

    app.mouse.move(start_x, start_y)
    app.mouse.down()
    app.mouse.move(start_x + 30, start_y + 30, steps=5)
    app.mouse.up()

    after_pos = app.evaluate("() => ({x: state.paintings[0].xCm, y: state.paintings[0].yCm})")
    assert after_pos["x"] != before_pos["x"] or after_pos["y"] != before_pos["y"]
