"""Pricing states the AI allowances the edge functions actually enforce."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


def limits(fn):
    m = re.search(r"const LIMITS: Record<string, number> = \{([^}]*)\}", read(f"supabase/functions/{fn}/index.ts"))
    return {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", m.group(1))}


class PricingAllowanceTests(unittest.TestCase):
    def test_copy_matches_server_limits(self):
        coach, explain, research = limits("arowana-ai-coach"), limits("arowana-explain"), limits("arowana-research")
        src = " ".join(read("pricing.html").split())
        self.assertIn(f"{coach['pro']} AI coach messages and {explain['pro']} plain-English explanations a month, and {research['pro']} ticker research lookups a day", src)
        self.assertIn(f"Pro: {coach['pro']} AI coach messages a month", src)
        self.assertIn(f"Founding Members get twice that: {coach['founders']}, {explain['founders']} and {research['founders']}", src)
        self.assertEqual((coach["founders"], explain["founders"], research["founders"]), (2 * coach["pro"], 2 * explain["pro"], 2 * research["pro"]))
        self.assertIn("p_period: today", read("supabase/functions/arowana-research/index.ts"))

    def test_old_claims_gone(self):
        src = read("pricing.html")
        self.assertNotIn("50 AI analyses", src)
        self.assertNotIn("no silent throttling", src)


if __name__ == "__main__":
    unittest.main()
