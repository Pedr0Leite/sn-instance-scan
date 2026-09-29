#!/usr/bin/env python3
"""Builds tests/fixtures/cmdb-health/golden.json from the REAL Python scorer.

Ground truth for tests/cmdb-health-scorer.parity.mjs. It runs the upstream
score_results.py end to end on each fixture and parses the markdown it prints,
rather than re-implementing any scoring here - re-implementing would just be a
second port checked against the first.

The fixture set (catalog, scorer, three result files) is a snapshot of
noviq-cmdb-health taken when the feature was ported. When upstream changes,
re-copy those files and re-run:
    python3 scripts/gen-cmdb-golden.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / 'tests' / 'fixtures' / 'cmdb-health'
FIXTURES = ['demo_instance_results.json', 'sample_results.json', 'ven0295.txt']
ICON = {'🔴 Fail': 'fail', '🟠 Warn': 'warn', '🟢 Pass': 'pass', '⚪ N/A': 'n_a', '⚫ Not assessed': 'not_assessed'}


def score_or_none(v):
    v = v.strip()
    return None if v in ('-', 'n/a') else int(v)


def section(md, heading):
    m = re.search(r'^## ' + re.escape(heading) + r'\n(.*?)(?=^## |\Z)', md, re.S | re.M)
    return m.group(1) if m else ''


def table_rows(block):
    rows = []
    for line in block.splitlines():
        if not line.startswith('|') or line.startswith('|---'):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        rows.append(cells)
    return rows[1:]  # drop the header row


def parse(md):
    head = re.search(r'\*\*Overall health score: (\S+)/100\*\* \(weighted [^;]*; (\d+) checks scored\)\. (.*)', md)
    if not head:
        sys.exit('could not find the overall score line')
    counts = {}
    for part in head.group(3).split(' · '):
        label, n = part.rsplit(': ', 1)
        counts[ICON[label]] = int(n)

    themes = [{'theme': r[0].split(' — ')[0], 'score': score_or_none(r[1])}
              for r in table_rows(section(md, 'Score by theme'))]
    stages = [{'stage': r[0], 'score': score_or_none(r[1]), 'label': r[2]}
              for r in table_rows(section(md, 'CSDM stage readiness'))]
    # Findings table: status | id | priority | title | measure | playbook.
    # Its row order IS the worst-first ordering, so it is kept as a list.
    findings = [{'id': r[1], 'status': ICON[r[0]], 'measure': r[4]}
                for r in table_rows(section(md, 'Findings (worst first)'))]
    unknown = re.search(r'_Ignored result IDs not in catalog: (.*)_', md)
    return {
        'overall': score_or_none(head.group(1)),
        'scored': int(head.group(2)),
        'counts': counts,
        'themes': themes,
        'stages': stages,
        'findings': findings,
        'unknown': [s.strip() for s in unknown.group(1).split(',')] if unknown else [],
    }


def main():
    golden = {}
    for name in FIXTURES:
        md = subprocess.run([sys.executable, str(FIX / 'score_results.py'), str(FIX / name)],
                            capture_output=True, text=True, check=True, encoding='utf-8').stdout
        golden[name] = parse(md)
        # print(md) adds exactly one trailing newline; keep the markdown itself.
        golden[name]['markdown'] = md[:-1] if md.endswith('\n') else md
        g = golden[name]
        print(f"{name}: {g['overall']}/100, {g['scored']} scored, {g['counts']}, {len(g['findings'])} findings")
    (FIX / 'golden.json').write_text(json.dumps(golden, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('wrote', FIX / 'golden.json')


if __name__ == '__main__':
    main()
