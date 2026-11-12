"""Research report / CSV / GeoJSON exports (contract §5.6)."""
from __future__ import annotations

import csv
import io
import json
from typing import Any


def _cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, dict)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


def _metric_rows(runs: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for run in runs or []:
        if not isinstance(run, dict):
            continue
        results = run.get("results") if isinstance(run.get("results"), dict) else {}
        metrics = results.get("metrics") if isinstance(results.get("metrics"), dict) else {}
        baseline = results.get("baseline") if isinstance(results.get("baseline"), dict) else None
        uncertainty = results.get("uncertainty") if isinstance(results.get("uncertainty"), dict) else {}
        for key in sorted(metrics):
            row = {
                "run_id": run.get("id"),
                "model": run.get("model_name") or run.get("model"),
                "status": run.get("status"),
                "metric": key,
                "value": metrics.get(key),
                "baseline": baseline.get(key) if baseline else None,
                "uncertainty_low": uncertainty.get(key, [None, None])[0] if isinstance(uncertainty.get(key), list) else None,
                "uncertainty_high": uncertainty.get(key, [None, None])[1] if isinstance(uncertainty.get(key), list) else None,
            }
            rows.append(row)
    return rows


def build_research_report(project: dict, runs: list[dict]) -> str:
    """Markdown research report with methodology, provenance, results, limitations,
    reproducibility (passport fields). Returns a markdown string."""
    project = project if isinstance(project, dict) else {}
    runs = [r for r in (runs or []) if isinstance(r, dict)]

    name = str(project.get("name") or project.get("title") or "Χωρίς τίτλο")
    lines: list[str] = []
    lines.append(f"# {name}")
    lines.append("")
    if project.get("description"):
        lines.append(str(project["description"]))
        lines.append("")
    if project.get("created_at"):
        lines.append(f"*Δημιουργήθηκε: {project['created_at']}*")
        lines.append("")

    # Methodology
    lines.append("## Μεθοδολογία / Methodology")
    lines.append("")
    if runs:
        models = sorted({str(r.get("model_name") or r.get("model") or "—") for r in runs})
        lines.append(f"- Μοντέλα: {', '.join(models)}")
        lines.append(f"- Σύνολο εκτελέσεων: {len(runs)}")
        seeds = sorted({r.get("seed") for r in runs if r.get("seed") is not None})
        if seeds:
            lines.append(f"- Σπόροι (seed): {', '.join(str(s) for s in seeds)}")
        compared = sum(
            1
            for r in runs
            if isinstance(r.get("results"), dict) and isinstance(r["results"].get("baseline"), dict)
        )
        if compared:
            lines.append(f"- Εκτελέσεις με σύγκριση βάσης (baseline): {compared}")
    else:
        lines.append("- Δεν υπάρχουν εκτελέσεις προς αναφορά.")
    lines.append("")

    # Provenance / data sources
    lines.append("## Προέλευση / Provenance — Πηγές δεδομένων / Data sources")
    lines.append("")
    lines.append("| Πηγή | URL | Ανάκτηση |")
    lines.append("|---|---|---|")
    any_source = False
    for run in runs:
        passport = run.get("passport") if isinstance(run.get("passport"), dict) else {}
        for source in passport.get("data_sources") or []:
            if not isinstance(source, dict):
                continue
            any_source = True
            lines.append(
                f"| {source.get('name', '—')} | {source.get('url') or '—'} | "
                f"{source.get('retrieved_at') or '—'} |"
            )
    if not any_source:
        lines.append("| — | — | — |")
    lines.append("")

    # Assumptions
    lines.append("## Υποθέσεις / Assumptions")
    lines.append("")
    assumptions: list[str] = []
    for run in runs:
        for item in run.get("assumptions") or []:
            if isinstance(item, str) and item not in assumptions:
                assumptions.append(item)
        results = run.get("results") if isinstance(run.get("results"), dict) else {}
        for item in results.get("assumptions") or []:
            if isinstance(item, str) and item not in assumptions:
                assumptions.append(item)
    if assumptions:
        for item in assumptions:
            lines.append(f"- {item}")
    else:
        lines.append("- Δεν καταγράφηκαν πρόσθετες υποθέσεις.")
    lines.append("")

    # Results
    lines.append("## Αποτελέσματα / Results")
    lines.append("")
    if not runs:
        lines.append("_Καμία εκτέλεση._")
        lines.append("")
    for run in runs:
        run_id = str(run.get("id") or "—")
        model = str(run.get("model_name") or run.get("model") or "—")
        status = str(run.get("status") or "—")
        lines.append(f"### Εκτέλεση {run_id} — {model} ({status})")
        lines.append("")
        results = run.get("results") if isinstance(run.get("results"), dict) else {}
        metrics = results.get("metrics") if isinstance(results.get("metrics"), dict) else {}
        baseline = results.get("baseline") if isinstance(results.get("baseline"), dict) else None
        uncertainty = results.get("uncertainty") if isinstance(results.get("uncertainty"), dict) else {}
        if metrics:
            lines.append("| Μετρική / Metric | Τιμή / Value | Βάση / Baseline | Αβεβαιότητα / Uncertainty |")
            lines.append("|---|---:|---:|---|")
            for key in sorted(metrics):
                base = baseline.get(key) if baseline else None
                unc = uncertainty.get(key)
                unc_text = f"[{unc[0]}, {unc[1]}]" if isinstance(unc, list) and len(unc) == 2 else "—"
                base_text = _cell(base) if base is not None else "—"
                lines.append(f"| {key} | {_cell(metrics[key])} | {base_text} | {unc_text} |")
        else:
            if run.get("error"):
                lines.append(f"Σφάλμα: {run['error']}")
            else:
                lines.append("_Χωρίς μετρήσεις._")
        lines.append("")

    # Limitations
    lines.append("## Περιορισμοί / Limitations")
    lines.append("")
    limitations: list[str] = []
    for run in runs:
        for item in run.get("limitations") or []:
            if isinstance(item, str) and item not in limitations:
                limitations.append(item)
        if run.get("error") and str(run["error"]) not in limitations:
            limitations.append(str(run["error"]))
        results = run.get("results") if isinstance(run.get("results"), dict) else {}
        for item in results.get("warnings") or []:
            if isinstance(item, str) and item not in limitations:
                limitations.append(item)
    if not limitations:
        limitations = [
            "Τα μοντέλα βασίζονται σε συνθετικά/προσομοιωμένα δεδομένα και δεν αντικαθιστούν μελέτη εφαρμογής.",
            "Οι εκτιμήσεις κόστους και κυκλοφορίας είναι ενδεικτικές.",
        ]
    for item in limitations:
        lines.append(f"- {item}")
    lines.append("")

    # Reproducibility
    lines.append("## Αναπαραγωγικότητα / Reproducibility")
    lines.append("")
    lines.append("| Πεδίο / Field | Τιμή / Value |")
    lines.append("|---|---|")
    any_passport = False
    for run in runs:
        passport = run.get("passport") if isinstance(run.get("passport"), dict) else {}
        if not passport:
            continue
        any_passport = True
        run_id = str(run.get("id") or "—")
        fields = [
            ("run", run_id),
            ("model_name", passport.get("model_name")),
            ("model_version", passport.get("model_version")),
            ("seed", passport.get("seed")),
            ("inputs_checksum", passport.get("inputs_checksum")),
            ("executed_at", passport.get("executed_at")),
            ("validated_by", passport.get("validated_by")),
        ]
        for field_name, value in fields:
            lines.append(f"| {field_name} | {_cell(value) if value is not None else '—'} |")
    if not any_passport:
        lines.append("| passport | — |")
    lines.append("")

    return "\n".join(lines)


def to_csv(rows: list[dict]) -> str:
    """CSV (utf-8-sig BOM) from dict rows; union of keys in first-seen order."""
    rows = [r for r in (rows or []) if isinstance(r, dict)]
    if not rows:
        return ""
    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(str(key))
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: _cell(row.get(key)) for key in fieldnames})
    return "﻿" + buffer.getvalue()


def to_geojson(features: list[dict]) -> str:
    """GeoJSON FeatureCollection (JSON string) from feature/row dicts."""
    built: list[dict] = []
    for index, feature in enumerate(features or []):
        if not isinstance(feature, dict):
            continue
        if feature.get("type") == "Feature" and isinstance(feature.get("geometry"), dict):
            built.append(feature)
            continue
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            lat, lon = feature.get("lat"), feature.get("lon")
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and not isinstance(lat, bool) and not isinstance(lon, bool):
                geometry = {"type": "Point", "coordinates": [float(lon), float(lat)]}
        if not isinstance(geometry, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            properties = {
                key: value
                for key, value in feature.items()
                if key not in ("geometry", "type", "properties", "lat", "lon") and value is not None
            }
        entry: dict = {"type": "Feature", "geometry": geometry, "properties": properties}
        if feature.get("id") is not None:
            entry["id"] = feature["id"]
        built.append(entry)
    return json.dumps({"type": "FeatureCollection", "features": built}, ensure_ascii=False)
