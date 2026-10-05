"""ATD-009: option-roll-tracker retired to the Trade Journal.

Behaviour is tested in the browser (scripts/browser/roll_tracker_check.mjs).
These checks keep the page read-only and the old links pointed at the journal.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")
PAGE = "option-roll-tracker.html"


class RollTrackerRetiredTests(unittest.TestCase):
    def test_page_only_reads_saved_chains(self):
        src = read(PAGE)
        self.assertIn("from('option_roll_chains').select(", src)
        for call in (".upsert(", ".insert(", ".update(", ".delete(", "localStorage.removeItem", "localStorage.setItem"):
            self.assertNotIn(call, src, call)

    def test_page_renders_without_innerhtml(self):
        self.assertNotIn("innerHTML", read(PAGE))

    def test_redirect_target_is_the_journal_options_tab(self):
        src = read(PAGE)
        self.assertIn("var TARGET = 'trade-journal-pro.html?tab=option';", src)
        self.assertIn("'option'", re.search(r"const TJ_TABS = \[[^\]]*\]", read("trade-journal-pro.html")).group(0))

    def test_no_page_links_to_the_old_tracker(self):
        for page in ("long-term-dashboard.html", "master-journal.html"):
            self.assertNotIn('href="option-roll-tracker.html"', read(page), page)


if __name__ == "__main__":
    unittest.main()
