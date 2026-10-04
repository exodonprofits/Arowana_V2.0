"""Offline invariants for the captured ATD-108 backend; no live calls."""
import hashlib
import json
from pathlib import Path
import unittest
from render_arowana_baseline import render

ROOT=Path(__file__).resolve().parents[1]
D=json.loads((ROOT/'supabase/baselines/ATD108_catalog.json').read_text(encoding='utf-8'))
M=json.loads((ROOT/'supabase/baselines/ATD108_functions.json').read_text(encoding='utf-8'))

class BackendCaptureTests(unittest.TestCase):
    def test_deployed_file_checksums_and_digest_parity(self):
        self.assertEqual(9,len(M['functions']))
        self.assertEqual(12,len(M['files']))
        for f in M['files']:
            b=(ROOT/f['path']).read_bytes().replace(b'\r\n',b'\n')
            self.assertEqual(f['sha256_lf'],hashlib.sha256(b).hexdigest(),f['path'])
        self.assertEqual((ROOT/'js/digest.js').read_bytes(),(ROOT/'supabase/functions/arowana-digest/digest.js').read_bytes())

    def test_handoff_coverage_and_policy_counts(self):
        self.assertEqual(28,len([r for r in D['relations'] if r['relkind']=='r']))
        self.assertEqual(5,len(D['views']))
        self.assertEqual(96,len(D['policies']))
        self.assertTrue(all(r['relrowsecurity'] for r in D['relations'] if r['relkind']=='r'))
        self.assertTrue(all(r['schema'] in ['public','arowana'] for r in D['relations']))
        self.assertTrue(any(c['table']=='ap_risk_settings' and c['name']=='rules' and c['type']=='jsonb' for c in D['columns']))

    def test_usage_rpc_privileges_preserved(self):
        for name in ['ap_claim_usage(uuid,text,text,integer,numeric)','ap_add_usage_cost(uuid,text,text,numeric)']:
            roles={g['grantee'] for g in D['function_grants'] if g['function']==name}
            self.assertEqual({'postgres','service_role'},roles)

    def test_generated_migration_is_current_and_scoped(self):
        sql=next((ROOT/'supabase/migrations').glob('*_atd108_arowana_deployed_baseline.sql')).read_text(encoding='utf-8')
        self.assertEqual(render(D),sql)
        self.assertEqual(28,sql.count('CREATE TABLE '))
        self.assertEqual(96,sql.count('CREATE POLICY '))
        self.assertNotIn('CREATE SCHEMA salon',sql)
        self.assertNotIn('CREATE SCHEMA service',sql)
        self.assertIn('Missing external baseline dependency: salon.employees',sql)
        self.assertIn('Refusing to overwrite existing relation: public.ap_usage',sql)
        self.assertIn('BEGIN;',sql)
        self.assertIn('COMMIT;',sql)

if __name__=='__main__':
    unittest.main()
