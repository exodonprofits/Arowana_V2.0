"""ATD-109: legal pages name what V2.0 actually does (processors, AI features, billing).

Drafted from the Wheel Desk's newer text; the owner approves the wording.
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class LegalPagesTests(unittest.TestCase):
    def test_privacy_names_every_processor(self):
        src = read("privacy.html")
        for name in ("Supabase", "Stripe", "n8n Cloud", "Finnhub", "OpenAI", "Anthropic", "Resend"):
            self.assertIn(name, src, name)
        self.assertIn("Retirement Planner", src)
        self.assertNotIn("one of the three AI features", src)

    def test_disclosures_list_the_ai_features(self):
        src = read("disclosures.html")
        for feature in ("AI Coach", "Explain in plain English", "Argue both sides", "Retirement Planner write-up", "AI Morning Brief", "AI scorecard"):
            self.assertIn(feature, src, feature)

    def test_terms_billing_and_closure(self):
        src = read("terms.html")
        self.assertIn("Founding Member annually", src)
        self.assertNotIn("close your account at any time from the Account page", src)
        self.assertIn("support@arowanaprofits.com", src)


if __name__ == "__main__":
    unittest.main()
