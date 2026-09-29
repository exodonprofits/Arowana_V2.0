"""Offline synthetic fixtures; no real credentials or network requests."""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('scanner', Path(__file__).with_name('check-secrets.py'))
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)

def token(role):
    def part(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    return '.'.join([part({'alg': 'HS256'}), part({'role': role}), 'synthetic'])

class SecretCheckTests(unittest.TestCase):
    def test_assignments(self):
        for name in ['API_KEY', 'TWELVE_DATA_API_KEY', 'apiKey', 'fmp_api_key']:
            for separator in [' = ', '":\n']:
                with self.subTest(name=name, separator=separator):
                    self.assertTrue(scanner.scan_text(name + separator + '"' + 'a1' * 16 + '"'))

    def test_query(self):
        self.assertTrue(scanner.scan_text('https://example.invalid/?apikey=' + 'a1' * 16))

    def test_jwt_roles_and_malformed_payload(self):
        self.assertTrue(scanner.scan_text(token('service_role')))
        self.assertEqual([], scanner.scan_text(token('anon')))
        self.assertEqual([], scanner.scan_text('eyJbroken.notjson.signature'))

    def test_existing_patterns(self):
        self.assertTrue(scanner.scan_text('sk-' + 'x' * 30))
        self.assertTrue(scanner.scan_text('sb_secret_' + 'x' * 30))
        self.assertTrue(scanner.scan_text('-----BEGIN ' + 'PRIVATE KEY-----'))

    def test_nonsecrets(self):
        for text in ['API_KEY = ""', 'API_KEY = process.env.PROVIDER_KEY',
                     'API_KEY = "REMOVED"', 'checksum = "' + 'a1' * 16 + '"']:
            self.assertEqual([], scanner.scan_text(text))

    def test_redaction_example_file_and_exit_status(self):
        secret = 'a1' * 16
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.env.example').write_text('\nAPI_KEY="' + secret + '"')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, scanner.main(root))
            self.assertIn('.env.example:2', output.getvalue())
            self.assertNotIn(secret, output.getvalue())

    def test_history_is_outside_scan_scope(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.git').mkdir()
            (root / '.git' / 'old.js').write_text('API_KEY="' + 'a1' * 16 + '"')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, scanner.main(root))

if __name__ == '__main__':
    unittest.main()
