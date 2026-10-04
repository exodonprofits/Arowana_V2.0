"""ATD-108 S4: Options Hub "Check a trade".

Behaviour is tested in the browser (scripts/browser/trade_check_check.mjs)
and js/trade-check.js under node (tests/trade-check.test.js). These checks
keep the wiring, and keep V2.0's own tabs, through a later copy from Wheel.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUB = (ROOT / "options-hub.html").read_text(encoding="utf-8")
REGISTRY = (ROOT / "js" / "arowana-nav-registry.js").read_text(encoding="utf-8")
RISK = (ROOT / "js" / "risk.js").read_text(encoding="utf-8")


class TradeCheckTests(unittest.TestCase):
    def test_check_tab_and_scripts(self):
        self.assertIn('data-tab="check"', HUB)
        self.assertIn('id="checkTab"', HUB)
        self.assertIn('src="./js/trade-check.js', HUB)
        self.assertIn('src="./js/risk.js', HUB)

    def test_both_scanner_cards_offer_the_check(self):
        self.assertIn('data-tc-check data-type="call"', HUB)
        self.assertIn('data-tc-check data-type="put"', HUB)

    def test_v2_tabs_and_nav_handling_kept(self):
        # Wheel removed the Recommender and Strategy Matrix; V2.0 keeps them.
        self.assertIn("'analyzer', 'strategies'];", HUB)
        self.assertIn("window.ArowanaNavPreset = navId;", HUB)
        self.assertIn("check: 'wheel-check'", HUB)
        self.assertIn('"id": "wheel-check"', REGISTRY)

    def test_check_is_pro_like_the_other_wheel_tabs(self):
        self.assertIn("checkTab: 'pro'", HUB)

    def test_risk_uses_only_the_shared_client(self):
        self.assertNotIn("supabase.createClient", RISK)


if __name__ == "__main__":
    unittest.main()
