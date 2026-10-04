"""ATD-108 S2: journal reliability.

Behaviour is tested in the browser (scripts/browser/journal_sync_check.mjs).
These checks keep the safety properties from being lost in a later copy
from the Wheel repo, and keep Wheel-only paths out of V2.0.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SYNC = (ROOT / "js" / "journal-sync.js").read_text(encoding="utf-8")
TJP = (ROOT / "trade-journal-pro.html").read_text(encoding="utf-8")


class JournalSyncTests(unittest.TestCase):
    def test_sync_never_builds_its_own_client(self):
        # A second GoTrueClient races js/sb.js over refresh-token rotation.
        self.assertNotIn("createClient", SYNC)

    def test_remote_delete_sweep_is_capped(self):
        # An empty server list (e.g. RLS hiding rows) must not read as
        # "everything was deleted".
        self.assertIn("MAX_REMOTE_DELETE_SHARE = 0.2", SYNC)
        self.assertIn("MAX_REMOTE_DELETE_SMALL = 5", SYNC)
        self.assertIn("'tj_server_ids_v1'", SYNC)
        self.assertIn("'tj_pending_deletes_v1'", SYNC)

    def test_direct_delete_is_chunked_and_user_scoped(self):
        self.assertIn("const TJ_DELETE_CHUNK = 200;", TJP)
        self.assertRegex(TJP, r"\.delete\(\)\.in\('id', chunk\)\.eq\('user_id', userId\)")
        # No hand-built DELETE URL with every id in the query string.
        self.assertNotIn("id=in.(${idList})", TJP)

    def test_access_token_comes_from_the_shared_helper(self):
        self.assertIn("window.apGetAccessToken", TJP)
        self.assertNotRegex(TJP, r"localStorage\.getItem\(`sb-\$\{ref\}-auth-token`\)")

    def test_wheel_only_paths_not_ported(self):
        self.assertNotIn("lab/", TJP)
        self.assertNotIn("data-lab-only", TJP)
        self.assertIn("'momentum-hunter':  'scanner.html?scan=my_movers'", TJP)

    def test_registry_nav_tab_handling_kept(self):
        # ATD-008: in-page tab links switch in place and report the active tab.
        self.assertIn("window.ArowanaNavPreset = navId;", TJP)
        self.assertTrue(re.search(r"closest\('a\[data-nav-id\]\[href\]'\)", TJP))


if __name__ == "__main__":
    unittest.main()
