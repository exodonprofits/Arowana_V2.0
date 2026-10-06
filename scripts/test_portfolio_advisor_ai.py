"""Portfolio Advisor's AI goes through arowana-ai-coach; no page calls an AI provider from the browser."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class PortfolioAdvisorAiTests(unittest.TestCase):
    def test_no_browser_calls_to_ai_providers(self):
        for path in sorted(list(ROOT.glob("*.html")) + list((ROOT / "js").glob("*.js"))):
            src = path.read_text(encoding="utf-8", errors="ignore")
            for host in ("api.anthropic.com", "api.openai.com"):
                self.assertNotRegex(src, r"fetch\(\s*['\"]https://" + re.escape(host), f"{path.name} calls {host}")

    def test_page_uses_the_coach_modes(self):
        src = read("portfolio-advisor.html")
        self.assertIn("/functions/v1/arowana-ai-coach", src)
        self.assertIn("mode:'company'", src)
        self.assertIn("mode:'investor'", src)
        self.assertNotIn("FREE_LIMIT", src)
        self.assertIn("window.analyzeStock=analyzeStock", src)

    def test_function_keeps_wheel_default(self):
        src = read("supabase/functions/arowana-ai-coach/index.ts")
        self.assertIn('MODES.has(body?.mode) ? body.mode as string : "wheel"', src)
        self.assertIn("You are a coach for a trader running the wheel", src)

    def test_legal_pages_name_portfolio_advisor(self):
        self.assertIn("Also used by Portfolio Advisor", read("privacy.html"))
        self.assertIn("Ask Advisor", read("disclosures.html"))


if __name__ == "__main__":
    unittest.main()
