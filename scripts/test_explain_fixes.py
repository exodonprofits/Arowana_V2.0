"""ATD-108 S5: plain-English explanations and small fixes.

Behaviour is tested in the browser (scripts/browser/explain_fixes_check.mjs).
These checks keep the safety properties and the fixes in place.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class ExplainFixesTests(unittest.TestCase):
    def test_explain_renders_text_only_and_sends_the_user_token(self):
        src = read("js/explain.js")
        self.assertNotIn("innerHTML", src)
        self.assertIn("window.apGetAccessToken", src)
        self.assertIn("/functions/v1/arowana-explain", src)

    def test_explain_loaded_where_its_buttons_are(self):
        for page in ("options-hub.html", "portfolio-command.html"):
            self.assertIn('src="./js/explain.js', read(page), page)

    def test_options_hub_has_no_missing_script(self):
        self.assertNotIn("options-hub-trading-layout.js", read("options-hub.html"))

    def test_roll_tracker_has_no_twelve_data_ticker(self):
        self.assertNotIn("api.twelvedata.com", read("option-roll-tracker.html"))

    def test_wheel_calculator_kept_shares_row_uses_basis(self):
        src = read("wheel-calculator.html")
        self.assertIn("result = credit + (at - basis) * shares;", src)
        self.assertNotIn("result = credit + (at - price) * shares;", src)

    def test_scanner_plan_comes_from_plan_js(self):
        src = read("js/scanners.js")
        self.assertNotIn("getItem('ap_is_pro_v1')", src)
        self.assertIn("AP_PLAN.atLeast('pro')", src)
        self.assertRegex(read("scanner.html"), r'src="\./js/plan\.js')


if __name__ == "__main__":
    unittest.main()
