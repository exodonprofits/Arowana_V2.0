"""Reject generated Supabase runtime files in the Git index, without reading values."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def blocked_paths(paths):
    return sorted(p for p in paths if p.startswith((
        'supabase/.temp/', 'supabase/.branches/',
    )))


def main():
    result = subprocess.run(
        ['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=True,
    )
    blocked = blocked_paths(result.stdout.decode('utf-8').split('\0'))
    for path in blocked:
        print(f'Blocked generated runtime file in Git index: {path}')
    if not blocked:
        print('Runtime tracking check passed.')
    return int(bool(blocked))


if __name__ == '__main__':
    sys.exit(main())
