"""One site font: every page loads Plus Jakarta Sans and no page sets
another sans-serif family (Inter, Inter Tight, Manrope, DM Sans, Segoe UI)
as its first choice. Monospace number fonts are left to each page."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OTHER = {"inter", "inter tight", "manrope", "dm sans", "segoe ui"}
DECL = re.compile(r"(?<![\w-])(font-family|--font|--font-sans|--sans)\s*:\s*([^;{}<>]*)")
SHORTHAND = re.compile(r"(?<![\w-])font\s*:\s*[^;{}<>]*?\d[\w.%/]*\s+([^;{}<>]*)")


def first_family(value):
    return value.split(",")[0].replace("!important", "").strip().strip("\"'").lower()


def live_pages():
    for page in sorted(ROOT.glob("*.html")):
        src = page.read_text(encoding="utf-8")
        if 'http-equiv="refresh"' in src and len(src.splitlines()) < 70:
            continue  # redirect stubs render nothing
        yield page, src


class BrandFontTests(unittest.TestCase):
    def test_every_page_loads_the_site_font(self):
        for page, src in live_pages():
            head = src[: src.index("</head>")]
            self.assertIn("fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800", head, page.name)
            self.assertNotRegex(head, r"family=(Inter|Inter\+Tight|Manrope|DM\+Sans)[:&]", page.name)

    def test_no_other_sans_font_comes_first(self):
        for page, src in live_pages():
            for m in DECL.finditer(src):
                self.assertNotIn(first_family(m.group(2)), OTHER, f"{page.name}: {m.group(0)[:80]}")
            for m in SHORTHAND.finditer(src):
                self.assertNotIn(first_family(m.group(1)), OTHER, f"{page.name}: {m.group(0)[:80]}")

    def test_nav_rail_uses_the_site_font(self):
        js = (ROOT / "js" / "arowana-nav.js").read_text(encoding="utf-8")
        self.assertIn('font-family:"Plus Jakarta Sans"', js)


if __name__ == "__main__":
    unittest.main()
