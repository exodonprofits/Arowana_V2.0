#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
SKIP={'.git','node_modules','dist','build'}
TEXT_EXT={'.html','.js','.json','.md','.txt','.xml','.css','.yml','.yaml','.py','.env'}
patterns={
 'OpenAI private key': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}'),
 'Supabase service role hint': re.compile(r'(?i)(service[_-]?role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["\'][^"\']{20,}["\']'),
 'PEM private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
}
findings=[]
for p in ROOT.rglob('*'):
    if not p.is_file() or any(part in SKIP for part in p.parts): continue
    if p.name == '.env.example': continue
    if p.suffix.lower() not in TEXT_EXT and not p.name.startswith('.env'): continue
    try: txt=p.read_text(encoding='utf-8',errors='ignore')
    except Exception: continue
    for label,rx in patterns.items():
        for m in rx.finditer(txt):
            line=txt.count('\n',0,m.start())+1
            findings.append((p.relative_to(ROOT),line,label))
if findings:
    print('Potential secrets detected:')
    for f in findings: print(f' - {f[0]}:{f[1]} — {f[2]}')
    sys.exit(1)
print('Secret scan passed: no blocked credential patterns detected.')
