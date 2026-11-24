#!/usr/bin/env python3
"""Refresh active-week targets from the shared cloud workbook.

The dashboard keeps stable staff identities for login/access control. Store-level
overrides preserve the exact source totals when the cloud sheet contains renamed
or blank staff rows that cannot safely be assigned to an existing login.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
TARGET_FILE = ROOT / "weekly-targets.js"
LOBS = ["iPhone", "Mac", "iPad", "Watch", "AirPods"]
WEEK = "W9"
W9_COLS = [123, 126, 129, 132, 135]

# Source sheet -> (dashboard store, source block heading).
BLOCKS = {
    "Subhojit": [
        ("Aptronix MBD", "MBD"), ("Aptronix Pavillion", "PAVILION"),
        ("Aptronix Sunview", "SUNVIEW"),
    ],
    "Lalit   ": [
        ("Aptronix Ambience VK", "AMBI VK"), ("Aptronix Kamla Nagar", "KAMLA"),
        ("Aptronix Logix", "LOGIX"), ("Aptronix Promenade", "PROMENADE"),
    ],
    " Mohit": [
        ("Aptronix Aerocity", "Aerocity"), ("Aptronix Ambience GGN", "Ambiance Ggn"),
        ("Aptronix Galleria", "Galleria"), ("Aptronix SouthEx", "South X"),
        ("Aptronix Vegas", "Vegas"),
    ],
    "Deepak ": [("Aptronix Borivali", "BORIVALI"), ("Aptronix Palladium", "PALLADIUM")],
    " Sahil": [
        ("Aptronix Bodakdev", 4), ("Aptronix Bopal", 9),
        ("Aptronix Gatlodia", 14), ("Aptronix Maninagar", 19),
        ("Aptronix Naroda", 25), ("Aptronix Nikol", 29),
        ("Aptronix Vijay Cross Road", 35),
    ],
    " Vishal": [
        ("Aptronix BLR-PMC", "PMC BLR"), ("Aptronix MG Bangalore", "MG ROAD"),
        ("Aptronix Mysore", "MYSORE"), ("Aptronix VJN Bangalore", "VJN"),
        ("Aptronix Kochi", "KOCHI"),
    ],
    "Karthik": [
        ("Aptronix Ambattur", "AMBATTUR"), ("Aptronix ECR Chennai", "ECR"),
        ("Aptronix KNK Chennai", "KNK"), ("Aptronix Lakshmi Mills", "LAKSHMI MILLS"),
        ("Aptronix Marina Mall", "MARINA MALL"), ("Aptronix PMC Chennai", "PMC CHENNAI"),
        ("Aptronix VR CHENNAI", "VR CHENNAI"),
    ],
    "Srinivas ": [("Aptronix Aspen Vizag", "Aspen"), ("Aptronix Vizianagaram", "VZM")],
    "Yusuf": [
        ("Aptronix Bhimavaram", "BHIMAVARAM"), ("Aptronix Daba Vizag", "DABA GARDEN"),
        ("Aptronix Madhurawada", "MADHURAWADA"), ("Aptronix MLBR Vijayawada", "MLBR VIJ"),
        ("Aptronix Nellore", "NELLORE"),
    ],
    "Stalin ": [
        ("Aptronix Eluru Vijayawada", "ELURU"), ("Aptronix Guntur", "GUNTUR"),
        ("Aptronix Kakinada", "KAKINADA"), ("Aptronix Benz Vijayawada", "BENZ"),
        ("Aptronix NAD", "NAD"),
    ],
    "Naveen ": [
        ("Aptronix AS Rao Nagar", "A S RAO"), ("Aptronix DSL Mall", "DSL"),
        ("Aptronix Hanamkonda", "Hanamkonda"), ("Aptronix Kompally", "Kompally"),
        ("Aptronix Parklane", "Parklane"), ("Aptronix Vanasthalipuram", "Vanasthalipuram"),
        ("Aptronix Warangal", "Warangal"),
    ],
    " Khadeer": [
        ("Aptronix Begumpet", "BEGUMPET"), ("Aptronix Gachibowli", "GACHIBOWLI"),
        ("Aptronix GVK One", "GVK"), ("Aptronix Himayath Nagar", "HIMAYATH"),
        ("Aptronix Khammam", "KHAMMAM"), ("Aptronix Panjagutta", "PANJAGUTTA"),
        ("Aptronix Shaikpet", "SHAIKPET"),
    ],
    "Abhilash": [
        ("Aptronix Inorbit Mall", "INORBIT"), ("Aptronix karimnagar", "KARIMNAGAR"),
        ("Aptronix Kondapur", "KONDAPUR"), ("Aptronix Kukatpally", "KUKATPALLY"),
        ("Aptronix Madinaguda", "MADINAGUDA"),
    ],
    " Gouse": [
        ("Aptronix Sarath Capital City", "SARATH"), ("Aptronix Abids", "ABIDS"),
        ("Aptronix Siddipet", "SIDDIPET"), ("Aptronix Banjara Hills", "BANJARA"),
        ("Aptronix Jubilee Hills", "JUBILEE"),
    ],
}


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def number(value: object) -> int:
    if value in (None, "", "-", "#DIV/0!", "#N/A"):
        return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def load_targets() -> dict:
    raw = TARGET_FILE.read_text(encoding="utf-8")
    prefix = "window.WEEKLY_STAFF_TARGETS="
    if not raw.startswith(prefix):
        raise ValueError("weekly-targets.js has an unexpected wrapper")
    return json.loads(raw[len(prefix):].rstrip().rstrip(";"))


def load_committed_targets() -> dict:
    raw = subprocess.check_output(
        ["git", "show", "HEAD:weekly-targets.js"], cwd=ROOT, text=True
    )
    prefix = "window.WEEKLY_STAFF_TARGETS="
    return json.loads(raw[len(prefix):].rstrip().rstrip(";"))


def staff_target_map(data: dict) -> dict:
    return {
        (arm["arm"], store["store"], staff["name"]): staff.get("targets", {}).get(WEEK, {})
        for arm in data.get("arms", [])
        for store in arm.get("stores", [])
        for staff in store.get("staff", [])
    }


def source_blocks(workbook) -> tuple[dict, dict]:
    totals: dict[str, dict] = {}
    people: dict[tuple[str, str], list[tuple[int, str, dict]]] = {}
    for sheet_name, mappings in BLOCKS.items():
        ws = workbook[sheet_name]
        labels = [(str(ws.cell(row, 1).value or "").strip(), row) for row in range(3, 80)]
        starts = []
        for store, heading in mappings:
            if isinstance(heading, int):
                starts.append((store, heading))
                continue
            candidates = [row for label, row in labels if norm(label) == norm(heading)]
            if not candidates:
                raise ValueError(f"Missing block heading {heading!r} in {sheet_name!r}")
            starts.append((store, min(candidates)))
        starts.sort(key=lambda item: item[1])
        for index, (store, start) in enumerate(starts):
            end = starts[index + 1][1] - 1 if index + 1 < len(starts) else start + 20
            rows = []
            sum_by_lob = {lob: 0 for lob in LOBS}
            for row in range(start, end + 1):
                row_label = str(ws.cell(row, 1).value or "").strip()
                if "total" in row_label.lower() or "toatal" in row_label.lower():
                    break
                label = str(ws.cell(row, 2).value or "").strip()
                if row > start and row_label and not label:
                    break
                values = {lob: number(ws.cell(row, col).value) for lob, col in zip(LOBS, W9_COLS)}
                # Preserve blank-name rows in store totals, but never assign them to a login.
                for lob in LOBS:
                    sum_by_lob[lob] += values[lob]
                if label:
                    rows.append((row, label, values))
            totals[store] = sum_by_lob
            people[(sheet_name, store)] = rows
    return totals, people


def refresh(workbook_path: Path) -> dict:
    data = load_targets()
    committed_targets = staff_target_map(load_committed_targets())
    workbook = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
    store_totals, source_people = source_blocks(workbook)
    changed_staff = 0
    unmatched = []
    matched = 0
    for arm in data.get("arms", []):
        sheet = arm.get("sourceSheet", "")
        if sheet.startswith("Vishal (Kochi"):
            sheet = " Vishal"
        for store in arm.get("stores", []):
            source_rows = source_people.get((sheet, store["store"]), [])
            by_name: dict[str, list[tuple[int, str, dict]]] = {}
            for row in source_rows:
                by_name.setdefault(norm(row[1]), []).append(row)
            for staff in store.get("staff", []):
                candidates = by_name.get(norm(staff["name"]), [])
                if len(candidates) == 1:
                    matched += 1
                    new_values = candidates[0][2]
                    old_values = committed_targets.get((arm["arm"], store["store"], staff["name"]), {})
                    if old_values != new_values:
                        changed_staff += 1
                    staff["targets"][WEEK] = new_values
                else:
                    unmatched.append({
                        "arm": arm["arm"], "store": store["store"], "staff": staff["name"],
                        "reason": "not present in latest source" if not candidates else "duplicate source name",
                    })
    missing_stores = sorted({s["store"] for a in data["arms"] for s in a["stores"]} - set(store_totals))
    if missing_stores:
        raise ValueError(f"No W9 source block for: {missing_stores}")
    data["version"] = "2026-11-24"
    data.setdefault("weeklyStoreTargets", {})[WEEK] = store_totals
    data["targetRefresh"] = {
        "week": WEEK,
        "sourceCheckedOn": "2026-11-24",
        "storeCount": len(store_totals),
        "matchedStaff": matched,
        "changedStaffRows": changed_staff,
        "identityExceptions": unmatched,
        "method": "Latest cloud targets; source store totals override staff sums for non-staff views.",
    }
    TARGET_FILE.write_text(
        "window.WEEKLY_STAFF_TARGETS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    return data["targetRefresh"]


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: refresh_weekly_targets.py /path/to/latest-targets.xlsx")
    print(json.dumps(refresh(Path(sys.argv[1])), indent=2, ensure_ascii=False))
