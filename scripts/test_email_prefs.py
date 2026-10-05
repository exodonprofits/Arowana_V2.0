"""ATD-109: the Account email preferences the digest's "Email settings" link opens.

Behaviour is tested in the browser (scripts/browser/email_prefs_check.mjs).
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")


class EmailPrefsTests(unittest.TestCase):
    def test_digest_settings_link_has_a_target(self):
        self.assertIn('/account.html#email', read("supabase/functions/arowana-digest/index.ts"))
        self.assertEqual(1, len(re.findall(r'id="email"', read("account.html"))))

    def test_three_opt_in_toggles_saved_to_ap_email_prefs(self):
        src = read("account.html")
        for key in ("morning", "expiry_week", "monthly"):
            self.assertIn(f'data-email-pref="{key}"', src)
        self.assertIn("from('ap_email_prefs').upsert(row, { onConflict: 'user_id' })", src)

    def test_preview_is_sandboxed(self):
        self.assertIn('<iframe id="emailPreviewFrame" title="Email preview" sandbox=""', read("account.html"))


if __name__ == "__main__":
    unittest.main()
