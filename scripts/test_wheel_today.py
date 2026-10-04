"""ATD-108 S6: "Your wheel today".

js/digest.js is a copy of the deployed arowana-digest/digest.js (checked
2026-10-04), served from js/ because the edge-function source is not in
this repository yet. Once it is, the two copies must stay identical, so the
page and the daily email cannot disagree. Behaviour:
scripts/browser/wheel_today_check.mjs and tests/digest.test.js.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FN_COPY = ROOT / "supabase" / "functions" / "arowana-digest" / "digest.js"


class WheelTodayTests(unittest.TestCase):
    def test_wheel_status_loads_the_js_copy(self):
        src = (ROOT / "js" / "wheel-status.js").read_text(encoding="utf-8")
        self.assertIn("new URL('./digest.js", src)

    def test_pages_load_wheel_status(self):
        for page in ("arowana-trader.html", "trading-command.html"):
            self.assertIn('src="./js/wheel-status.js', (ROOT / page).read_text(encoding="utf-8"), page)

    def test_digest_copies_identical_when_function_source_exists(self):
        if not FN_COPY.exists():
            self.skipTest("edge-function source not in the repository yet (ATD-108 Q6)")
        self.assertEqual((ROOT / "js" / "digest.js").read_bytes(), FN_COPY.read_bytes())


if __name__ == "__main__":
    unittest.main()
