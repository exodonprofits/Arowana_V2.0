"""ATD-009 group M: scaffolds, prototypes and Salon pages removed from main.

The site publishes the repository root (no build step), so an archive folder
would still be served; the pages were deleted instead. Git history keeps
them: restore one with
    git checkout b5fc057b1309d7d855cbd0f84598811eb213d665 -- "<page>.html"
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROUP_M = [
    'ai_valuation.html',
    'arowana-template.html',
    'base-breakout .html',
    'cover-call-option-recommentor.html',
    'daily-trading-post.html',
    'dashboard.html',
    'options-hub-creator.html',
    'overview.html',
    'pricing-revolutionary.html',
    'settings.html',
    'short-term-template.html',
    'task-template.html',
    'template.html',
    'template_new.html',
    'test_webhook.html',
    'trade-ideas-ai.html',
    'updated-navigation.html',
    'weekly-swing-trade-post.html',
]


class GroupMDeletedTests(unittest.TestCase):
    def test_pages_are_gone(self):
        for name in GROUP_M:
            self.assertFalse((ROOT / name).exists(), name)

    def test_nothing_links_to_them(self):
        pattern = re.compile(r'(?:href|src|action)=["\']\.?/?(%s)["\'?#]' % "|".join(re.escape(n) for n in GROUP_M))
        for path in list(ROOT.glob("*.html")) + list((ROOT / "js").glob("*.js")):
            self.assertIsNone(pattern.search(path.read_text(encoding="utf-8")), path.name)

    def test_tool_audit_list_drops_them(self):
        src = (ROOT / "tool-audit.html").read_text(encoding="utf-8")
        for name in GROUP_M:
            self.assertNotIn('"href": "%s"' % name, src, name)


if __name__ == "__main__":
    unittest.main()
