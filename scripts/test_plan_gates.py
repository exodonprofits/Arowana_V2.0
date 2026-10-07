"""Plan gates: no page decides Pro from localStorage ap_is_pro_v1.

Nothing ever set that key, so it treated paying users as Free and let anyone
unlock Pro from the browser console. js/plan.js (server-backed) decides.
Behaviour: scripts/browser/plan_gates_check.mjs.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GETTER = re.compile(r"""getItem\(\s*['"]ap_is_pro_v1['"]\s*\)""")
PAGES = ["arowana-trader.html", "portfolio-advisor.html", "analysis-central.html",
         "options-analyzer.html", "whale-tracker.html"]


class PlanGateTests(unittest.TestCase):
    def test_no_code_reads_ap_is_pro_v1(self):
        files = list(ROOT.glob("*.html")) + list((ROOT / "js").glob("*.js"))
        hits = [f.name for f in files if GETTER.search(f.read_text(encoding="utf-8", errors="replace"))]
        self.assertEqual(hits, [])

    def test_gated_pages_load_plan_js(self):
        for page in PAGES:
            self.assertRegex((ROOT / page).read_text(encoding="utf-8"), r'src="\./js/plan\.js', page)

    def test_long_term_dashboard_has_no_gated_content(self):
        # ATD-109: the Long-Term desk is a hub of links; it reads no plan
        # and calls no webhook.
        html = (ROOT / "long-term-dashboard.html").read_text(encoding="utf-8")
        self.assertNotIn("webhook", html.lower())
        self.assertNotIn("ap_is_pro_v1", html)


if __name__ == "__main__":
    unittest.main()
