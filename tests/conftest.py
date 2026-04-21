from pathlib import Path
import pytest

INDEX_HTML = Path(__file__).resolve().parent.parent / "index.html"
INDEX_URL = INDEX_HTML.as_uri()


@pytest.fixture
def app(page):
    page.goto(INDEX_URL)
    page.wait_for_selector(".wall")
    return page
