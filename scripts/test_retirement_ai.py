"""Retirement Planner's managed AI write-up, and index.html plan names.

Behaviour is tested in the browser (scripts/browser/retirement_ai_check.mjs).
These checks keep the frontend and arowana-explain agreeing on the kind,
and the never-configured webhook placeholder out.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class RetirementAiTests(unittest.TestCase):
    def test_frontend_and_backend_agree_on_the_kind(self):
        self.assertIn("AP_EXPLAIN.request('retirement'", read("retirement-planner.html"))
        kinds = re.search(r"const KINDS: Record<string, string> = \{(.*?)\n\};", read("supabase/functions/arowana-explain/index.ts"), re.S).group(1)
        self.assertIn('"retirement":', kinds)

    def test_page_loads_plan_and_explain(self):
        src = read("retirement-planner.html")
        for script in ("js/app-config.js", "js/supabase_min.js", "js/sb.js", "js/plan.js", "js/explain.js"):
            self.assertIn(f'src="./{script}', src, script)
        self.assertIn("AP_PLAN.ready().then(applyLockState, applyLockState)", src)

    def test_placeholder_webhook_and_elite_plan_gone(self):
        src = read("retirement-planner.html")
        self.assertNotIn("retirementNarrative", src)
        self.assertNotIn("Elite", src)

    def test_index_plan_names(self):
        src = read("index.html")
        self.assertNotIn("Pro and Pro", src)
        self.assertIn(">Pro at $29/month</a>", src)
        self.assertIn("monthly: 2900,", read("checkout.html"))


if __name__ == "__main__":
    unittest.main()
