"""ATD-109: ap_usage accepts the 'explain' feature that arowana-explain meters."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = ROOT / "supabase/migrations/20261005150000_atd109_ap_usage_explain_feature.sql"


class ExplainUsageMigrationTests(unittest.TestCase):
    def test_constraint_allows_every_metered_feature(self):
        sql = MIG.read_text(encoding="utf-8")
        allowed = set(re.findall(r"'(\w+)'::text", sql))
        used = set()
        for fn in ROOT.glob("supabase/functions/*/index.ts"):
            used |= set(re.findall(r"""p_feature:\s*["'](\w+)["']""", fn.read_text(encoding="utf-8")))
        self.assertEqual({"research", "coach", "explain"}, used)
        self.assertEqual(used, allowed)

    def test_scoped_and_transactional(self):
        body = "\n".join(l for l in MIG.read_text(encoding="utf-8").splitlines() if not l.startswith("--"))
        self.assertEqual(["BEGIN", "ALTER TABLE public.ap_usage DROP CONSTRAINT IF EXISTS ap_usage_feature_check",
                          "ALTER TABLE public.ap_usage ADD CONSTRAINT ap_usage_feature_check CHECK (feature = ANY (ARRAY['research'::text, 'coach'::text, 'explain'::text]))",
                          "COMMIT"], [" ".join(s.split()) for s in body.split(";") if s.strip()])


if __name__ == "__main__":
    unittest.main()
