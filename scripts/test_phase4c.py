"""ATD-009 phase 4c: the four browser-only journals and watchlists.

Behaviour is tested in the browser (scripts/browser/phase4c_check.mjs).
These checks keep the import pages read-only on their old saves, keep
journal writes on journal-sync, and keep Watchlist importing the old lists.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class Phase4cTests(unittest.TestCase):
    def test_import_module_writes_only_through_journal_sync(self):
        src = read("js/legacy-journal-import.js")
        self.assertIn("js.upsertOption(t)", src)
        self.assertIn("js.upsertStock(t)", src)
        self.assertIn("await js.flushNow()", src)
        for call in (".insert(", ".upsert(", ".update(", ".delete(", "removeItem"):
            self.assertNotIn(call, src, call)
        self.assertNotIn("innerHTML", src)

    def test_journal_pages_use_the_module_and_their_old_keys(self):
        for page, key, kind in (("trade-journal.html", "ap_trade_journal_v1", "stock"),
                                ("options-journal.html", "oj_trades_v1", "option")):
            src = read(page)
            self.assertIn('src="./js/journal-sync.js', src, page)
            self.assertIn('src="./js/legacy-journal-import.js', src, page)
            self.assertIn(f"sourceKey: '{key}'", src, page)
            self.assertIn(f"kind: '{kind}'", src, page)
            self.assertNotIn("innerHTML", src, page)
            self.assertNotIn("localStorage.setItem", src, page)

    def test_watchlist_pages_redirect_and_watchlist_imports_them(self):
        for page in ("my-watchlist.html", "iv-watchlist-module.html"):
            self.assertIn("var target = 'watchlist.html';", read(page), page)
        src = read("watchlist.html")
        self.assertIn("key: 'arowana_watchlist_v1'", src)
        self.assertIn("key: 'ap_iv_watchlist_tickers'", src)
        self.assertIn("const migratedIdeas = migrateOldSymbolListsIfNeeded();", src)

    def test_no_links_to_the_option_journal_page(self):
        for page in ("long-term-dashboard.html", "credit-spread-planner.html"):
            self.assertNotIn('href="options-journal.html"', read(page), page)


if __name__ == "__main__":
    unittest.main()
