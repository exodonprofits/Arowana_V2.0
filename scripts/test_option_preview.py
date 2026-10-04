"""Trade Journal Pro option preview: max risk / max profit by strategy.

Behaviour: scripts/browser/option_preview_check.mjs. This keeps the old
"every credit trade is Unlimited*" shortcut from coming back.
"""

import unittest
from pathlib import Path

TJP = (Path(__file__).resolve().parent.parent / "trade-journal-pro.html").read_text(encoding="utf-8")


class OptionPreviewTests(unittest.TestCase):
    def test_preview_uses_the_strategy_aware_calculation(self):
        self.assertIn("function optMaxRiskProfit(o)", TJP)
        self.assertIn("optMaxRiskProfit({ type: optType", TJP)
        self.assertNotIn("isCredit ? 'Unlimited*'", TJP)

    def test_strategy_and_credit_selects_refresh_the_preview(self):
        self.assertIn('id="oStrategy" onchange="calcOptPreview()"', TJP)
        self.assertIn('id="oCreditDebit" onchange="calcOptPreview()"', TJP)


if __name__ == "__main__":
    unittest.main()
