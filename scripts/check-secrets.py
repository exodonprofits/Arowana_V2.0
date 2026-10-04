#!/usr/bin/env python3
from pathlib import Path
import base64, json, re, sys
ROOT=Path(__file__).resolve().parents[1]
SKIP={'.git','node_modules','dist','build'}
TEXT_EXT={'.html','.js','.json','.md','.txt','.xml','.css','.yml','.yaml','.py','.env','.ts','.sql','.toml'}
patterns={
 'OpenAI private key': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}'),
 'Supabase service role hint': re.compile(r'(?i)(service[_-]?role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["\'][^"\']{20,}["\']'),
 'PEM private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'Provider hex-key assignment': re.compile(r'''(?i)\b(?:api[_-]?key|[a-z][a-z0-9_]*api[_-]?key)\b["']?\s*[:=]\s*["'][a-f0-9]{32}["']'''),
 'Provider hex-key query': re.compile(r'(?i)[?&](?:apikey|api_key|token)=[a-f0-9]{32}(?![a-f0-9])'),
 'Supabase secret key': re.compile(r'\bsb_secret_[A-Za-z0-9_-]{20,}'),
}

def scan_text(txt):
    findings = []
    for label, rx in patterns.items():
        for match in rx.finditer(txt):
            findings.append((txt.count('\n', 0, match.start()) + 1, label))
    for match in re.finditer(r'\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+', txt):
        try:
            payload = match.group(1)
            claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        except (ValueError, UnicodeError):
            continue
        # Classification only; decoding neither validates nor uses a token.
        if isinstance(claims, dict) and claims.get('role') == 'service_role':
            findings.append((txt.count('\n', 0, match.start()) + 1, 'Supabase service-role JWT'))
    return findings

def main(root=ROOT):
    failed = False
    for p in sorted(root.rglob('*')):
        if not p.is_file() or any(part in SKIP for part in p.relative_to(root).parts): continue
        if p.suffix.lower() not in TEXT_EXT and not p.name.startswith('.env'): continue
        try:
            txt = p.read_text(encoding='utf-8', errors='replace')
        except OSError:
            print(f'Unable to scan: {p.relative_to(root)}')
            failed = True
            continue
        for line, label in scan_text(txt):
            print(f'Potential secret: {p.relative_to(root)}:{line} — {label}')
            failed = True
    if not failed:
        print('Secret scan passed: no blocked credential patterns detected.')
    return int(failed)

if __name__ == '__main__':
    sys.exit(main())
