def test_wall_renders_with_initial_painting(app):
    assert app.locator(".wall").count() == 1
    assert app.locator(".painting").count() == 1


def test_add_painting(app):
    app.locator("#add-btn").click()
    assert app.locator(".painting").count() == 2


def test_wall_width_input_updates_state(app):
    w = app.locator(".wall-w").first
    w.fill("500")
    w.dispatch_event("input")
    assert app.evaluate("() => state.walls[0].widthCm") == 500


def test_select_and_edit_name(app):
    app.locator(".painting").first.click()
    name = app.locator("#p-name")
    name.fill("テスト絵")
    name.dispatch_event("input")
    label = app.locator(".painting .painting-label").first
    assert label.inner_text() == "テスト絵"


def test_remove_painting(app):
    app.locator(".painting").first.click()
    app.locator("#remove-btn").click()
    assert app.locator(".painting").count() == 0
