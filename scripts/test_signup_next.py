"""ATD-109: sign-up follows only same-site pages, and checkout survives login → sign-up.

Behaviour is tested in the browser (scripts/browser/signup_next_check.mjs).
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class SignupNextTests(unittest.TestCase):
    def test_signup_never_uses_raw_next(self):
        src = read("signup.html")
        self.assertIn("function apSafeNext(raw)", src)
        self.assertIn("if (target.origin !== location.origin) return fallback;", src)
        self.assertIsNone(re.search(r"params\.get\('next'\)\s*\|\|", src))
        self.assertIn("const next = apSafeNext(params.get('next'));", src)

    def test_login_carries_next_to_signup(self):
        src = read("login.html")
        self.assertIn('id="signupLink"', src)
        self.assertIn("link.href = 'signup.html?next=' + encodeURIComponent(next);", src)

    def test_banner_names_no_price(self):
        self.assertNotIn("$19/mo", read("signup.html"))


if __name__ == "__main__":
    unittest.main()
