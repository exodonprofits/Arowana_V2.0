"""ATD-109: what the Bluehost deploy publishes, and site files it relies on.

The workflow itself is exercised by running its steps locally (see the PR);
these checks keep the allowlist, redirects and paths from drifting.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")
WF = ".github/workflows/deploy-bluehost.yml"


class DeployConfigTests(unittest.TestCase):
    def test_upload_is_an_allowlist(self):
        src = read(WF)
        self.assertIn("cp ./*.html robots.txt sitemap.xml site/", src)
        self.assertIn("cp -r css js images site/", src)
        for never in ("documents", "docs", "supabase", "scripts", "tests"):
            self.assertNotRegex(src, r"cp [^\n]*\b%s\b" % never, never)
        self.assertIn("-name '*.docx'", src)
        self.assertIn("Refuse anything secret-looking", src)

    def test_no_business_documents_in_repo(self):
        self.assertFalse((ROOT / "documents").exists())
        self.assertEqual([], [p.name for p in ROOT.glob("*.docx")])

    def test_robots_at_root(self):
        src = read("robots.txt")
        for line in ("Disallow: /account.html", "Disallow: /staging/", "Disallow: /lab/", "Sitemap: https://arowanaprofits.com/sitemap.xml"):
            self.assertIn(line, src)

    def test_redirect_targets_exist(self):
        rules = [l.split() for l in read("_redirects").splitlines() if l.strip() and not l.startswith("#")]
        self.assertTrue(any(r[0] == "/market-intelligence" for r in rules))
        self.assertGreaterEqual(sum(r[0].startswith("/lab/") for r in rules), 29)
        for src, dst, *_ in rules:
            page = dst.lstrip("/").split("?")[0]
            self.assertTrue((ROOT / page).is_file(), f"{src} -> {dst}")

    def test_sitemap_pages_exist(self):
        for loc in re.findall(r"<loc>https://arowanaprofits\.com/([^<]*)</loc>", read("sitemap.xml")):
            if loc:
                self.assertTrue((ROOT / loc).is_file(), loc)

    def test_pages_use_relative_asset_paths(self):
        # Root-absolute paths would load the live site's files under /staging/.
        for page in ROOT.glob("*.html"):
            self.assertIsNone(re.search(r"[\"'](/js|/css|/images)/", page.read_text(encoding="utf-8")), page.name)


if __name__ == "__main__":
    unittest.main()
