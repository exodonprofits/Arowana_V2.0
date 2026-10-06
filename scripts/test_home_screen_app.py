"""Every page carries the home-screen app tags; the manifest and icons ship."""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class HomeScreenAppTests(unittest.TestCase):
    def test_every_page_links_the_manifest_and_ios_tags(self):
        for page in sorted(ROOT.glob("*.html")):
            src = page.read_text(encoding="utf-8")
            for tag in ('<link rel="manifest" href="manifest.json">', 'name="apple-mobile-web-app-capable" content="yes"',
                        '<link rel="apple-touch-icon" href="images/app-icon-180.png">'):
                self.assertIn(tag, src, f"{page.name}: {tag}")
            self.assertEqual(1, src.count('name="theme-color"'), page.name)
            head = src[:src.index("</head>")]
            self.assertIn('rel="manifest"', head, page.name)

    def test_manifest_and_icons(self):
        m = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("standalone", m["display"])
        self.assertEqual("./trading-command.html", m["start_url"])
        self.assertTrue((ROOT / "trading-command.html").exists())
        for icon in m["icons"]:
            self.assertTrue((ROOT / icon["src"]).exists(), icon["src"])
        self.assertTrue((ROOT / "images/app-icon-180.png").exists())

    def test_deploy_ships_the_manifest(self):
        self.assertIn("manifest.json site/", (ROOT / ".github/workflows/deploy-bluehost.yml").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
