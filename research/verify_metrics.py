#!/usr/bin/env python3
"""Independent re-computation of the SymptomWatch evaluation metrics.

Reads evaluation/results/latest.json (written by `npm run evaluate`), recounts
TP/FP/FN/TN from the per-unit expected/predicted flags and from the raw
prediction list, recomputes precision, recall, F1, and false-positive rate,
and fails loudly if anything disagrees with the TypeScript evaluator.

Standard library only. Synthetic data only.
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

RESULTS = Path(__file__).resolve().parent.parent / "evaluation" / "results" / "latest.json"
METRIC_KEYS = ("tp", "fp", "fn", "tn", "units", "precision", "recall", "f1", "falsePositiveRate")


def ratio(numerator: int, denominator: int) -> float | None:
    return None if denominator == 0 else numerator / denominator


def metrics(tp: int, fp: int, fn: int, tn: int) -> dict:
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    if precision is None or recall is None:
        f1 = None
    elif precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * precision * recall / (precision + recall)
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "units": tp + fp + fn + tn,
            "precision": precision, "recall": recall, "f1": f1, "falsePositiveRate": ratio(fp, fp + tn)}


def count(units: list[dict]) -> dict:
    tally = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    for unit in units:
        key = ("t" if unit["expected"] == unit["predicted"] else "f") + ("p" if unit["predicted"] else "n")
        tally[key] += 1
    return metrics(**tally)


def same(a, b) -> bool:
    if a is None or b is None:
        return a is b
    return math.isclose(a, b, rel_tol=0, abs_tol=1e-12)


def main() -> int:
    if not RESULTS.exists():
        print(f"Missing {RESULTS}. Run `npm run evaluate` first.", file=sys.stderr)
        return 2
    data = json.loads(RESULTS.read_text())
    units = data["units"]
    problems: list[str] = []

    # 1. Every prediction must appear as a predicted unit (listed or unlisted), and vice versa.
    predicted_units = {(u["ruleId"], u["subjectId"]) for u in units if u["predicted"] and not u["listed"]}
    listed_predicted = sum(1 for u in units if u["predicted"] and u["listed"])
    if listed_predicted + len(predicted_units) > len(data["predictions"]):
        problems.append("More predicted units than predictions (alias double-counting?)")
    for unit in units:
        if unit["outcome"] != {(True, True): "TP", (False, True): "FP", (True, False): "FN", (False, False): "TN"}[(unit["expected"], unit["predicted"])]:
            problems.append(f"Inconsistent outcome for {unit['ruleId']} {unit['subjectId']}")

    # 2. Recompute overall and per-rule metrics.
    checks = {"overall": (count(units), data["overall"])}
    by_rule: dict[str, list[dict]] = defaultdict(list)
    for unit in units:
        by_rule[unit["ruleId"]].append(unit)
    for rule_id, reported in data["perRule"].items():
        checks[rule_id] = (count(by_rule.get(rule_id, [])), reported)

    # 3. Recompute patient-level metrics from labels and raw predictions.
    patients_expected: dict[str, bool] = defaultdict(bool)
    for unit in units:
        if unit["listed"]:
            patients_expected[unit["patientKey"]] |= unit["expected"]
    predicted_patients = {p["patientId"] for p in data["predictions"]}
    all_patients = set(patients_expected) | predicted_patients
    missing = data["dataset"]["patients"] - len(all_patients)
    tally = {"tp": 0, "fp": 0, "fn": 0, "tn": max(0, missing)}  # patients with no units and no findings
    for patient in all_patients:
        expected, predicted = patients_expected[patient], patient in predicted_patients
        key = ("t" if expected == predicted else "f") + ("p" if predicted else "n")
        tally[key] += 1
    checks["patientLevel"] = (metrics(**tally), data["patientLevel"])

    for scope, (mine, theirs) in checks.items():
        for key in METRIC_KEYS:
            if not same(mine[key], theirs[key]):
                problems.append(f"{scope}.{key}: python={mine[key]} typescript={theirs[key]}")

    fmt = lambda v: "n/a" if v is None else f"{v * 100:.1f}%"
    o = checks["overall"][0]
    print(f"Recomputed from {RESULTS.relative_to(RESULTS.parent.parent.parent)} (as of {data['asOf'][:10]}, rules v{data['rulesVersion']}):")
    print(f"  overall  TP={o['tp']} FP={o['fp']} FN={o['fn']} TN={o['tn']}  precision={fmt(o['precision'])} recall={fmt(o['recall'])} F1={fmt(o['f1'])} FPR={fmt(o['falsePositiveRate'])}")
    for rule_id in data["perRule"]:
        m = checks[rule_id][0]
        print(f"  {rule_id:<31} P={fmt(m['precision']):>6} R={fmt(m['recall']):>6} F1={fmt(m['f1']):>6} FPR={fmt(m['falsePositiveRate']):>6}")
    if problems:
        print("\nMISMATCHES:", *problems, sep="\n  ", file=sys.stderr)
        return 1
    print("All metrics match the TypeScript evaluator.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
