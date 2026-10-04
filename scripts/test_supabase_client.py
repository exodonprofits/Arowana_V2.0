"""ATD-108 S1: one Supabase auth client per page.

js/sb.js builds the shared client right after the local SDK and turns any
later session-sharing createClient() call for the project into that same
client. These checks keep every page that loads the SDK on that path.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SDK = re.compile(r'<script src="\./js/supabase_min\.js(?:\?v=[0-9a-z]+)?"></script>\s*(<script[^>]*>)')
SB_TAG = re.compile(r'^<script src="\./js/sb\.js(?:\?v=[0-9a-z]+)?">$')
CDN_SDK = re.compile(r'<script[^>]+src="https?://[^"]*(?:@supabase|supabase-js)[^"]*"')
# Pages that keep their own client on purpose, or are parked by the owner.
EXEMPT = {
    "reset-password.html": "recovery flow needs detectSessionInUrl:false",
    "tradingcommand.html": "owner-parked (ATD-008 D5)",
    "whale-tracker.html": "owner-parked pending the ATD-003 coaching merge",
}


def pages():
    return sorted(p for p in ROOT.glob("*.html"))


class SupabaseClientTests(unittest.TestCase):
    def test_sb_js_follows_every_local_sdk_tag(self):
        for page in pages():
            if page.name in EXEMPT:
                continue
            html = page.read_text(encoding="utf-8", errors="replace")
            for m in SDK.finditer(html):
                self.assertRegex(m.group(1), SB_TAG, "%s: ./js/sb.js must come right after supabase_min.js" % page.name)

    def test_nav_pages_do_not_load_the_sdk_from_a_cdn(self):
        for page in pages():
            html = page.read_text(encoding="utf-8", errors="replace")
            if 'src="./js/nav-loader.js' not in html:
                continue
            self.assertIsNone(CDN_SDK.search(html), "%s loads the Supabase SDK from a CDN" % page.name)

    def test_sb_js_holds_only_the_public_anon_key(self):
        src = (ROOT / "js" / "sb.js").read_text(encoding="utf-8")
        self.assertNotIn("service_role", src.replace("service-role key", ""))
        keys = re.findall(r"'(eyJ[A-Za-z0-9_\-]+\.([A-Za-z0-9_\-]+)\.[A-Za-z0-9_\-]+)'", src)
        self.assertEqual(len(keys), 1)
        import base64, json
        payload = keys[0][1] + "=" * (-len(keys[0][1]) % 4)
        self.assertEqual(json.loads(base64.urlsafe_b64decode(payload))["role"], "anon")

    def test_app_config_uses_the_live_token(self):
        src = (ROOT / "js" / "app-config.js").read_text(encoding="utf-8")
        self.assertIn("function apGetAccessToken", src)
        self.assertIn("_apLiveAccessToken", src)
        self.assertNotIn("user.access_token", src, "headers must not use the cached gs_auth_user_v1 token")


if __name__ == "__main__":
    unittest.main()
