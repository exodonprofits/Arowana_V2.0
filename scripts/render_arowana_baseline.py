"""Render a scoped, unapplied baseline from read-only PostgreSQL catalog evidence."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'supabase/baselines/ATD108_catalog.json'

def ident(s):
    return '"' + s.replace('"', '""') + '"'

def relation(s):
    parts = s.split('.')
    if len(parts) == 1:
        parts.insert(0, 'public')
    return '.'.join(map(ident, parts))

def literal(s):
    return "'" + s.replace("'", "''") + "'"

def signature(f):
    name, args = f['name'].split('(', 1)
    return relation(name) + '(' + args

def render(d):
    out = [
        '-- ATD-108 Q6: deployed definitions captured 2026-10-04; NOT a production upgrade.',
        '-- No rows, secrets, cron jobs, or Salon/Rental schema definitions are included.',
        '-- Requires the external dependencies documented in supabase/baselines/README.md.',
        '-- Existing security behavior is evidence, not an endorsement. Do not apply to production.',
        'BEGIN;', 'SET LOCAL search_path = public, extensions, pg_catalog;',
        'SET LOCAL check_function_bodies = false;',
    ]
    scoped = {r['schema']+'.'+r['name'] for r in d['relations']}
    deps = {c['reference'] for c in d['constraints'] if c['reference']}
    deps.update(v['dependency'] for v in d['view_dependencies'])
    deps.update(v['dependency'] for v in d['policy_dependencies'])
    # PL/pgSQL bodies do not register relation dependencies in pg_depend.
    deps.update(['public.ap_provider_calls','public.ap_admins','public.journal_trade_candidates',
                 'public.agent_memberships','public.entity_memberships'])
    deps = sorted({x if '.' in x else 'public.'+x for x in deps} - scoped)
    out += ['DO $preflight$ BEGIN']
    for name in deps:
        out += [f'  IF to_regclass({literal(name)}) IS NULL THEN',
                f'    RAISE EXCEPTION {literal("Missing external baseline dependency: "+name)};', '  END IF;']
    for name in sorted(scoped):
        out += [f'  IF to_regclass({literal(name)}) IS NOT NULL THEN',
                f'    RAISE EXCEPTION {literal("Refusing to overwrite existing relation: "+name)};', '  END IF;']
    out += ["  IF to_regprocedure('uuid_generate_v4()') IS NULL THEN",
            "    RAISE EXCEPTION 'uuid-ossp / uuid_generate_v4() prerequisite missing';", '  END IF;',
            'END $preflight$;', 'CREATE SCHEMA IF NOT EXISTS arowana;']
    # Shared enum can already exist with external finance dependencies. Check its labels.
    for e in d['enums'] or []:
        name = e['schema']+'.'+e['name']
        labels = ', '.join(literal(x) for x in e['labels'])
        out += ['DO $enum$ BEGIN', f'  IF to_regtype({literal(name)}) IS NULL THEN',
                f'    CREATE TYPE {relation(name)} AS ENUM ({labels});',
                f'  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=to_regtype({literal(name)})) IS DISTINCT FROM ARRAY[{labels}]::text[] THEN',
                f'    RAISE EXCEPTION {literal("Enum differs from captured baseline: "+name)};',
                '  END IF;', 'END $enum$;']
    assert not d['sequences'], 'Sequence rendering requires explicit implementation'
    for r in d['relations']:
        if r['relkind'] != 'r': continue
        name = relation(r['schema']+'.'+r['name'])
        cols = []
        for c in d['columns']:
            if (c['schema'],c['table']) != (r['schema'],r['name']): continue
            assert not c['identity'] and not c['generated'], 'Unsupported generated/identity column'
            col = ident(c['name'])+' '+c['type']
            if c['collation']: col += ' COLLATE '+c['collation']
            if c['default'] is not None: col += ' DEFAULT '+c['default']
            if c['not_null']: col += ' NOT NULL'
            cols.append(col)
        out += [f'CREATE TABLE {name} (\n  '+',\n  '.join(cols)+'\n);',
                f'ALTER TABLE {name} OWNER TO {ident(r["owner"])};']
        if r['relrowsecurity']: out += [f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY;']
        if r['relforcerowsecurity']: out += [f'ALTER TABLE {name} FORCE ROW LEVEL SECURITY;']
    for c in sorted(d['constraints'], key=lambda c:c['type']=='f'):
        out += [f'ALTER TABLE {relation(c["table"])} ADD CONSTRAINT {ident(c["name"])} {c["definition"]};']
    for ix in d['indexes']:
        if not ix['constraint_backed']: out += [ix['definition']+';']
    for f in d['functions']:
        out += [f['definition'].rstrip().rstrip(';')+';',
                f'ALTER FUNCTION {signature(f)} OWNER TO {ident(f["owner"])};']
    for t in d['triggers']:
        out += [t['definition']+';']
        state = {'D':'DISABLE', 'R':'ENABLE REPLICA', 'A':'ENABLE ALWAYS', 'O':'ENABLE'}[t['enabled']]
        out += [f'ALTER TABLE {relation(t["table"])} {state} TRIGGER {ident(t["name"])};']
    for p in d['policies']:
        roles = ', '.join('PUBLIC' if x=='public' else ident(x) for x in p['roles'])
        sql = f'CREATE POLICY {ident(p["policyname"])} ON {relation(p["schemaname"]+"."+p["tablename"])} AS {p["permissive"]} FOR {p["cmd"]} TO {roles}'
        if p['qual'] is not None: sql += ' USING ('+p['qual']+')'
        if p['with_check'] is not None: sql += ' WITH CHECK ('+p['with_check']+')'
        out += [sql+';']
    for v in d['views']:
        opts = ' WITH ('+', '.join(v['options'])+')' if v['options'] else ''
        out += [f'CREATE VIEW {relation(v["name"])}{opts} AS\n'+v['definition'].rstrip().rstrip(';')+';']
        r = next(r for r in d['relations'] if r['name']==v['name'].split('.')[-1])
        out += [f'ALTER VIEW {relation(v["name"])} OWNER TO {ident(r["owner"])};']
    # Remove role defaults, then reproduce observed grants including column-only grants.
    for r in d['relations']:
        out += [f'REVOKE ALL ON TABLE {relation(r["schema"]+"."+r["name"])} FROM PUBLIC, anon, authenticated, service_role;']
    for g in d['grants']:
        if g['grantee']=='postgres': continue
        grantable = ' WITH GRANT OPTION' if g['is_grantable']=='YES' else ''
        out += [f'GRANT {g["privilege_type"]} ON TABLE {relation(g["table_schema"]+"."+g["table_name"])} TO {ident(g["grantee"])}{grantable};']
    for c in d['column_acl'] or []:
        for acl in c['acl']:
            role, privs = acl.split('=',1); privs = privs.split('/')[0]
            assert '*' not in privs, 'Column grant-option handling required'
            for code in privs:
                privilege = {'r':'SELECT','a':'INSERT','w':'UPDATE','x':'REFERENCES'}[code]
                out += [f'GRANT {privilege} ({ident(c["column"])}) ON TABLE {relation(c["table"])} TO {ident(role)};']
    for f in d['functions']:
        out += [f'REVOKE ALL ON FUNCTION {signature(f)} FROM PUBLIC, anon, authenticated, service_role;']
    by_name = {f['name']:f for f in d['functions']}
    for g in d['function_grants']:
        if g['grantee']=='postgres': continue
        role = 'PUBLIC' if g['grantee']=='PUBLIC' else ident(g['grantee'])
        grantable = ' WITH GRANT OPTION' if g['grantable'] else ''
        out += [f'GRANT {g["privilege"]} ON FUNCTION {signature(by_name[g["function"]])} TO {role}{grantable};']
    for c in d['comments'] or []:
        target = relation(c['table']); kind = 'TABLE'
        if c['column']:
            kind = 'COLUMN';target += '.'+ident(c['column'])
        out += [f'COMMENT ON {kind} {target} IS {literal(c["comment"])};']
    out += ['COMMIT;', '']
    return '\n\n'.join(out).replace('\r\n', '\n').rstrip() + '\n'

if __name__=='__main__':
    data=json.loads(CATALOG.read_text(encoding='utf-8'))
    files=list((ROOT/'supabase/migrations').glob('*_atd108_arowana_deployed_baseline.sql'))
    assert len(files)==1
    files[0].write_text(render(data),encoding='utf-8',newline='\n')
    print('Rendered scoped migration; nothing applied.')
