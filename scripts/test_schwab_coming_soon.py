"""Schwab connection: coming soon (Broker Connections and the OAuth return page).

Behaviour is tested in the browser (scripts/browser/schwab_coming_soon_check.mjs).
These checks keep the sample "Connected" state and the dead callback call out.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class SchwabComingSoonTests(unittest.TestCase):
    def test_broker_connections_shows_no_sample_connection(self):
        main = re.search(r"<main.*?</main>", read("broker-connections.html"), re.S).group(0)
        self.assertIn("Coming soon", main)
        self.assertIn('href="trade-journal-pro.html?action=import"', main)
        for sample in ("● Connected", "Last sync", "Schwab IRA", "Sync All Now", "/webhook/arowana/"):
            self.assertNotIn(sample, main, sample)

    def test_callback_page_calls_nothing(self):
        src = read("schwab-callback.html")
        scripts = re.findall(r"<script\b[^>]*>(.*?)</script>", src, re.S)
        self.assertEqual(["if (location.search) history.replaceState(null, '', location.pathname);"], [x.strip() for x in scripts])
        self.assertNotIn("<script src", src)
        for call in ("fetch(", "functions/v1", "supabase"):
            self.assertNotIn(call, src, call)
        self.assertIn('<meta name="referrer" content="no-referrer">', src)
        self.assertIn("history.replaceState(null, '', location.pathname)", src)


if __name__ == "__main__":
    unittest.main()
