"""ATD-009 phase 4: long-term-portfolio retired; saved holdings import into
the Trade Journal on the user's click.

Behaviour is tested in the browser (scripts/browser/ltp_import_check.mjs).
These checks keep the page from changing the old rows and keep journal
writes on the shared journal-sync path.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")
PAGE = "long-term-portfolio.html"


class LongTermPortfolioImportTests(unittest.TestCase):
    def test_portfolio_rows_are_only_read(self):
        src = read(PAGE)
        self.assertIn("sb.from('portfolio')", src)
        self.assertEqual(1, src.count("from('portfolio')"))
        for call in (".insert(", ".upsert(", ".update(", ".delete("):
            self.assertNotIn(call, src, call)

    def test_journal_writes_go_through_journal_sync(self):
        src = read(PAGE)
        self.assertIn('src="./js/journal-sync.js', src)
        self.assertIn("js.upsertStock(t)", src)
        self.assertIn("await js.flushNow()", src)
        self.assertNotIn("from('tj_stocks').upsert", src)

    def test_already_open_symbols_start_unticked(self):
        self.assertIn("box.checked = usable && !r._open && !r._done;", read(PAGE))

    def test_renders_without_innerhtml(self):
        self.assertNotIn("innerHTML", read(PAGE))

    def test_links_point_at_portfolio_command(self):
        self.assertNotIn('href="long-term-portfolio.html"', read("long-term-dashboard.html"))
        self.assertNotIn('"href": "long-term-portfolio.html"', read("tool-audit.html"))


if __name__ == "__main__":
    unittest.main()
