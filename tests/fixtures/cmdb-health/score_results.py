#!/usr/bin/env python3
"""Score CMDB/CSDM health evidence against the Get Well Playbook check catalog.

Usage:
  python score_results.py results.json [--out findings.md] [--csv findings.csv]
  python score_results.py --template > results.json      # blank file for manual (Route B/C/D) collection

`results.json` may be the raw background-script output: the JSON between
===CMDB_HEALTH_JSON_START=== and ===CMDB_HEALTH_JSON_END=== is extracted automatically.

Result format per check: {"id": "CI-09", "count": 120, "total": 4000, "samples": [...], "note": "..."}
  - count/total null  -> not assessed
  - kind "pct"        -> count/total as percentage
  - kind "count"      -> absolute count (total informational)
  - kind "bool"       -> count 0 = pass, anything else = fail
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATALOG = HERE / "check_catalog.json"
STATUS_ORDER = {"fail": 0, "warn": 1, "pass": 2, "n/a": 3, "not assessed": 4}
ICON = {"fail": "🔴 Fail", "warn": "🟠 Warn", "pass": "🟢 Pass", "n/a": "⚪ N/A", "not assessed": "⚫ Not assessed"}
SCORE = {"pass": 1.0, "warn": 0.5, "fail": 0.0}


def load_catalog():
    with open(CATALOG, encoding="utf-8") as f:
        return json.load(f)


def load_results(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    m = re.search(r"===CMDB_HEALTH_JSON_START===(.*?)===CMDB_HEALTH_JSON_END===", text, re.S)
    if m:
        text = m.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        sys.exit("No JSON object found in " + str(path))
    return json.loads(text[start:end + 1])


def template(cat):
    return {
        "meta": {"instance": "", "build": "", "generated": "", "source": "manual (list views / dashboards / interview)",
                 "ci_total": None, "ci_active": None, "rel_total": None},
        "inventory": [],
        "checks": [{"id": c["id"], "title": c["title"], "table": c["table"], "issue_query": c["issue_query"],
                    "population_query": c["population_query"], "count": None, "total": None,
                    "samples": [], "note": ""} for c in cat["checks"]],
    }


def evaluate(check, res, defaults):
    """Return (status, pct_or_None)."""
    if res is None or res.get("count") is None:
        return "not assessed", None
    count = res["count"]
    total = res.get("total")
    kind = check["kind"]
    if kind == "bool":
        return ("pass" if count == 0 else "fail"), None
    if kind == "count":
        if total == 0:  # explicit empty population (e.g. no TSOs exist) - not a pass
            return "n/a", None
        warn_max = check.get("warn_max", 0)
        if count == 0:
            return "pass", None
        return ("warn" if count <= warn_max else "fail"), None
    # pct
    if not total:
        return "n/a", None
    pct = 100.0 * count / total
    th = check.get("pct_thresholds") or defaults["pct_thresholds"][check["priority"]]
    if pct <= th["pass_max"]:
        return "pass", pct
    if pct <= th["warn_max"]:
        return "warn", pct
    return "fail", pct


def kb_links(check, url):
    return ", ".join(f"[{k}]({url.format(kb=k)})" for k in check["kb"]) or "CSDM best practice"


def fmt_measure(check, res, pct):
    if res is None or res.get("count") is None:
        return "-"
    if check["kind"] == "pct" and res.get("total"):
        return f"{res['count']:,} / {res['total']:,} ({pct:.1f}%)"
    if check["kind"] == "bool":
        return "issue" if res["count"] else "ok"
    total = res.get("total")
    return f"{res['count']:,}" + (f" (of {total:,})" if isinstance(total, int) and total else "")


def score_group(rows, weights):
    num = den = 0.0
    counted = 0
    for r in rows:
        if r["status"] in SCORE:
            w = weights[r["check"]["priority"]]
            num += w * SCORE[r["status"]]
            den += w
            counted += 1
    return (round(100 * num / den) if den else None), counted


def stage_label(score, counted, rows):
    n_na = sum(1 for r in rows if r["status"] == "n/a")
    if counted == 0:
        if rows and n_na == len(rows):
            return "Not started (no records)"
        return "Not assessed"
    if score >= 85:
        label = "Achieved"
    elif score >= 60:
        label = "In progress"
    else:
        label = "At risk"
    if n_na and n_na * 2 >= len(rows):
        label = "Largely not started - " + label.lower() + " on the checks that apply"
    if n_na:
        label += f" ({n_na} of {len(rows)} checks have no records)"
    return label


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results", nargs="?")
    ap.add_argument("--out", default=None, help="markdown output path (default: stdout)")
    ap.add_argument("--csv", default=None, help="optional CSV of all findings")
    ap.add_argument("--template", action="store_true", help="print a blank results file")
    args = ap.parse_args()

    cat = load_catalog()
    if args.template:
        print(json.dumps(template(cat), indent=2))
        return
    if not args.results:
        ap.error("results file required (or --template)")

    data = load_results(args.results)
    meta = data.get("meta", {})
    by_id = {c["id"]: c for c in data.get("checks", [])}
    defaults = cat["defaults"]
    weights = defaults["weights"]
    url = cat["kb_url"]

    rows = []
    for chk in cat["checks"]:
        res = by_id.get(chk["id"])
        status, pct = evaluate(chk, res, defaults)
        rows.append({"check": chk, "res": res, "status": status, "pct": pct})
    unknown = [i for i in by_id if i not in {c["id"] for c in cat["checks"]}]

    overall, n_scored = score_group(rows, weights)
    L = []
    L.append(f"# CMDB & CSDM Health Findings — {meta.get('instance') or 'instance'}")
    L.append("")
    L.append(f"- **Build:** {meta.get('build') or 'n/a'}  ")
    L.append(f"- **Generated:** {meta.get('generated') or 'n/a'}  ")
    if meta.get("ci_total") is not None:
        L.append(f"- **CIs:** {meta.get('ci_total'):,} total, {meta.get('ci_active') or 0:,} non-retired; "
                 f"**relationships:** {meta.get('rel_total') or 0:,}  ")
    if meta.get("adjustments"):
        L.append(f"- **Adjustments:** {meta['adjustments']}  ")
    if meta.get("ci_active") and meta.get("rel_total") is not None:
        L.append(f"- **Relationship density:** {meta['rel_total'] / meta['ci_active']:.2f} relationships per non-retired CI  ")
    if meta.get("max_iterate_warning") or ((meta.get("config") or {}).get("maxIterate", 10**6) < 50000):
        L.append(f"- ⚠️ **Collector ran with maxIterate={(meta.get('config') or {}).get('maxIterate')}** — record-by-record checks may be truncated; re-run with the default (200000) for a real assessment.  ")
    if meta.get("custom_class_count") is not None:
        L.append(f"- **CMDB classes:** {meta.get('cmdb_class_count')} ({meta.get('custom_class_count')} custom)  ")
    apps = meta.get("apps") or {}
    if apps:
        L.append(f"- **Data Foundations dashboard installed:** {'yes' if apps.get('data_foundations_dashboard') else 'no'}; "
                 f"**Service Graph Connectors:** {len(apps.get('service_graph_connectors') or [])}  ")
    L.append("")
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in STATUS_ORDER}
    L.append(f"**Overall health score: {overall if overall is not None else 'n/a'}/100** "
             f"(weighted High=3, Medium=2, Low=1; {n_scored} checks scored). "
             + " · ".join(f"{ICON[s]}: {counts[s]}" for s in STATUS_ORDER))
    L.append("")

    L.append("## Score by theme")
    L.append("")
    L.append("| Theme | Score | Fail | Warn | Pass | N/A / not assessed |")
    L.append("|---|---|---|---|---|---|")
    for theme, desc in cat["themes"].items():
        tr = [r for r in rows if r["check"]["theme"] == theme]
        sc, _ = score_group(tr, weights)
        L.append(f"| {theme} — {desc} | {sc if sc is not None else '-'} | "
                 f"{sum(r['status']=='fail' for r in tr)} | {sum(r['status']=='warn' for r in tr)} | "
                 f"{sum(r['status']=='pass' for r in tr)} | {sum(r['status'] in ('n/a','not assessed') for r in tr)} |")
    L.append("")

    L.append("## CSDM stage readiness")
    L.append("")
    L.append("Foundation combines the Foundation, Hygiene and Integration themes; later stages use their own checks.")
    L.append("")
    L.append("| Stage | Score | Assessment |")
    L.append("|---|---|---|")
    stage_map = {"Foundation": ("Foundation", "Hygiene", "Integration")}
    pop = meta.get("csdm_population") or {}
    anchors = cat.get("stage_anchors", {})
    for st in cat["stages"]:
        themes = stage_map.get(st, (st,))
        sr = [r for r in rows if r["check"]["theme"] in themes]
        sc, n = score_group(sr, weights)
        label = stage_label(sc, n, sr)
        keys = anchors.get(st, [])
        if pop and keys and all(not pop.get(k) for k in keys if k in pop) and any(k in pop for k in keys):
            label = "Not started - no " + " / ".join(k.replace("_", " ") for k in keys) + " records (scores below reflect only peripheral checks)"
        L.append(f"| {st} | {sc if sc is not None else '-'} | {label} |")
    L.append("")
    if pop:
        L.append("## CSDM population")
        L.append("")
        L.append("| Entity | Records |")
        L.append("|---|---|")
        for k, v in pop.items():
            L.append(f"| {k.replace('_', ' ')} | {v if v is not None else 'not collected'} |")
        L.append("")

    L.append("## Findings (worst first)")
    L.append("")
    L.append("| Status | ID | Priority | Check | Measure | Playbook |")
    L.append("|---|---|---|---|---|---|")
    ordered = sorted(rows, key=lambda r: (STATUS_ORDER[r["status"]],
                                          {"High": 0, "Medium": 1, "Low": 2}[r["check"]["priority"]],
                                          -(r["pct"] or 0), r["check"]["id"]))
    for r in ordered:
        c = r["check"]
        L.append(f"| {ICON[r['status']]} | {c['id']} | {c['priority']} | {c['title']} | "
                 f"{fmt_measure(c, r['res'], r['pct'])} | {kb_links(c, url)} |")
    L.append("")

    L.append("## Detail for failing and warning checks")
    L.append("")
    for r in ordered:
        if r["status"] not in ("fail", "warn"):
            continue
        c, res = r["check"], r["res"]
        L.append(f"### {c['id']} · {c['title']} — {ICON[r['status']]}")
        L.append("")
        L.append(f"- **Measure:** {fmt_measure(c, res, r['pct'])} · **Priority:** {c['priority']} · **Theme:** {c['theme']}")
        L.append(f"- **Playbook:** {kb_links(c, url)}")
        L.append(f"- **Where:** `{c['table']}` — `{c['issue_query']}`")
        if res.get("note"):
            L.append(f"- **Collector note:** {res['note']}")
        if res.get("samples"):
            L.append("- **Examples:** " + "; ".join(str(s) for s in res["samples"][:8]))
        L.append(f"- **Recommended action:** {c['action']}")
        L.append("")

    na = [r for r in rows if r["status"] in ("n/a", "not assessed")]
    if na:
        L.append("## Not applicable / not assessed")
        L.append("")
        for r in na:
            why = (r["res"] or {}).get("note") or ("no records in population" if r["status"] == "n/a" else "no data provided")
            L.append(f"- **{r['check']['id']}** {r['check']['title']} — {ICON[r['status']]}: {why}")
        L.append("")

    if data.get("inventory"):
        L.append("## CI inventory (top classes, non-retired)")
        L.append("")
        L.append("| Class | CIs |")
        L.append("|---|---|")
        for row in data["inventory"][:25]:
            L.append(f"| {row['cls']} | {row['n']:,} |")
        L.append("")

    if unknown:
        L.append(f"_Ignored result IDs not in catalog: {', '.join(unknown)}_")
        L.append("")

    md = "\n".join(L)
    if args.out:
        Path(args.out).write_text(md, encoding="utf-8")
        print(f"Wrote {args.out} (overall score {overall})")
    else:
        print(md)

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "status", "priority", "theme", "title", "count", "total", "pct",
                        "kb", "table", "issue_query", "note", "samples", "action"])
            for r in ordered:
                c, res = r["check"], r["res"] or {}
                w.writerow([c["id"], r["status"], c["priority"], c["theme"], c["title"],
                            res.get("count"), res.get("total"),
                            f"{r['pct']:.2f}" if r["pct"] is not None else "",
                            " ".join(c["kb"]), c["table"], c["issue_query"], res.get("note", ""),
                            " | ".join(map(str, res.get("samples") or [])), c["action"]])
        print(f"Wrote {args.csv}")


if __name__ == "__main__":
    main()
