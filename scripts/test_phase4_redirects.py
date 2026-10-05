"""ATD-009 phase 4a: duplicate journal/watchlist/portfolio pages redirect.

Behaviour is tested in the browser (scripts/browser/phase4_redirects_check.mjs).
These checks keep the stubs pointed at their targets and the links updated.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")
STUBS = {
    "master-journal.html": "trade-journal-pro.html",
    "portfolio-tracker.html": "portfolio-command.html",
    "short-term-watchlist.html": "watchlist.html",
    "long-term-watchlist.html": "watchlist.html",
}


class Phase4RedirectTests(unittest.TestCase):
    def test_stubs_redirect_to_their_target(self):
        for page, target in STUBS.items():
            src = read(page)
            self.assertIn(f"var target = '{target}';", src, page)
            self.assertIn(f'content="0; url={target}"', src, page)
            self.assertNotIn("supabase", src.lower(), page)

    def test_watchlist_still_reads_the_old_saves(self):
        src = read("watchlist.html")
        self.assertIn("const LS_KEY = 'stw_watchlist_v1';", src)
        self.assertIn("const LONGTERM_OLD_LS_KEY = 'arowanaLongTermWatchlist';", src)
        self.assertIn("const TBL = 'watchlist_items';", src)

    def test_no_page_links_to_a_retired_page(self):
        pattern = re.compile(r'href="(%s)"' % "|".join(re.escape(p) for p in STUBS))
        for path in ROOT.glob("*.html"):
            if path.name in STUBS:
                continue
            self.assertIsNone(pattern.search(path.read_text(encoding="utf-8")), path.name)

    def test_tool_audit_list_drops_the_long_term_watchlist(self):
        self.assertNotIn('"href": "long-term-watchlist.html"', read("tool-audit.html"))


if __name__ == "__main__":
    unittest.main()
