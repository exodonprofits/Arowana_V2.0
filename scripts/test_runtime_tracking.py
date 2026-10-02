import unittest
from check_runtime_tracking import blocked_paths


class RuntimeTrackingTests(unittest.TestCase):
    def test_generated_files_blocked_regardless_of_content(self):
        paths = ['supabase/.temp/cli-latest',
                 'supabase/.temp/start-secrets/example/env/docker.env',
                 'supabase/.branches/_current_branch']
        self.assertEqual(sorted(paths), blocked_paths(paths))

    def test_source_and_migrations_allowed(self):
        self.assertEqual([], blocked_paths([
            'supabase/config.toml', 'supabase/.gitignore',
            'supabase/migrations/example.sql', 'supabase/README.md',
        ]))


if __name__ == '__main__':
    unittest.main()
