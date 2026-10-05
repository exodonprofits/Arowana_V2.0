"""ATD-109: onboarding re-run keeps saved settings; Free/Pro copy matches js/plan.js.

Behaviour is tested in the browser (scripts/browser/onboarding_check.mjs).
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class OnboardingAndPlanCopyTests(unittest.TestCase):
    def test_onboarding_saves_limits_through_ap_risk(self):
        src = read("onboarding.html")
        self.assertIn('src="./js/risk.js', src)
        self.assertIn("await AP_RISK.save(", src)
        self.assertNotIn("max_puts_per_ticker: 2, warn_earnings: true", src)

    def test_onboarding_rerun_and_import_link(self):
        src = read("onboarding.html")
        self.assertIn("el('next1').disabled = picked.length === 0 && already.length === 0;", src)
        self.assertLess(src.index("var already = [];"), src.index("renderPicked();"))
        self.assertIn('href="trade-journal-pro.html?action=import"', src)
        self.assertNotIn("?import=1", src)

    def test_free_plan_copy_matches_plan_js(self):
        free = re.search(r"free:\s*\{([^}]*)\}", read("js/plan.js")).group(1)
        for feature in ("csv", "income", "export"):
            self.assertRegex(free, r"\b%s:\s*false" % feature)
        support = read("support.html")
        self.assertIn("Pro adds broker CSV import and data export", support)
        pricing = read("pricing.html")
        self.assertIn('<li class="off"><span class="cross">&#10007;</span> Premium income tracker</li>', pricing)
        for row in ("Broker CSV import", "Data export"):
            self.assertRegex(pricing, r'comp-feature">%s</div>\s*<div class="comp-cell comp-cross">' % row, row)


if __name__ == "__main__":
    unittest.main()
