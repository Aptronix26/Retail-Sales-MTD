"""Build store-daily-revenue.js straight from the Rujul Sales Invoice Statement (raw .xlsx or .csv).

Rules (retail store revenue, as used on the Traffic Intelligence page):
- Retail stores only: Ecom-TL and PLFIPL Warehouse (and any branch listed in NON_RETAIL) are excluded.
- Revenue = bill line "Total" (incl. GST), sales minus returns, on the bill date.
- Excluded lines: Status Cancelled or Hold (returns awaiting approval), Transaction Type "Dispatch"
  (stock movement, not a sale).
- "Tax Invoice - Online" bills are kept OUT of store revenue and reported separately as onlineRevenue.
- Every invoice line is kept, including identical lines on the same invoice (two units billed as
  two lines are two sales).
Usage: python3 tools/build_store_revenue_from_sis.py <Sales_Invoice_Statement.xlsx|.csv> [weekRanges.json]
"""
import csv, json, sys, datetime, collections

NON_RETAIL = {"Ecom-TL", "PLFIPL Warehouse"}
ONLINE = "Tax Invoice - Online"

def rows(path):
    if path.lower().endswith(".csv"):
        with open(path, newline="") as f:
            r = csv.reader(f); head = next(r)
            for row in r: yield dict(zip(head, row))
        return
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]; ws.reset_dimensions()
    it = ws.iter_rows(values_only=True); head = [str(h) for h in next(it)]
    for row in it: yield dict(zip(head, row))

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

def main(path, weeks_path=None):
    weeks = json.load(open(weeks_path)) if weeks_path else None
    store = collections.defaultdict(float); online = collections.defaultdict(float)
    audit = collections.Counter(); dates = set(); branches = set()
    for r in rows(path):
        b = (r.get("Branch ID") or "").strip(); d = r.get("TXNDate")
        if not b or not d: audit["footer_or_blank"] += 1; continue
        if isinstance(d, datetime.datetime): d = d.strftime("%d-%m-%Y")
        day = datetime.datetime.strptime(str(d), "%d-%m-%Y").strftime("%Y-%m-%d")
        if b in NON_RETAIL: audit["non_retail_lines"] += 1; continue
        status = (r.get("Status") or "").strip(); ttype = (r.get("Transaction Type") or "").strip()
        if status in ("Cancelled", "Hold"): audit[f"status_{status.lower()}"] += 1; continue
        if ttype == "Dispatch": audit["dispatch"] += 1; continue
        total = num(r.get("Total")); key = (day, b); dates.add(day); branches.add(b)
        if (r.get("Voucher Type") or "").strip() == ONLINE: online[key] += total; audit["online_lines"] += 1
        else: store[key] += total; audit["store_lines"] += 1
    q_start = datetime.date.fromisoformat(min(dates))  # quarter starts on a Sunday (Apple fiscal weeks)
    def week_of(d):
        hit = next((w for w, x in (weeks or {}).items() if x["start"] <= d <= x["end"]), None)
        return hit or f"W{(datetime.date.fromisoformat(d) - q_start).days // 7 + 1}"
    keys = sorted(set(store) | set(online))
    out_rows = [{"date": d, "week": week_of(d), "store": b, "netRevenue": round(store.get((d, b), 0.0), 2), "onlineRevenue": round(online.get((d, b), 0.0), 2)} for d, b in keys]
    start, end = min(dates), max(dates)
    all_days = [(datetime.date.fromisoformat(start) + datetime.timedelta(n)).isoformat() for n in range((datetime.date.fromisoformat(end) - datetime.date.fromisoformat(start)).days + 1)]
    missing_days = [d for d in all_days if d not in dates]
    out = {"version": end, "source": f"Sales Invoice Statement (raw): {path.split('/')[-1]}", "basis": "raw",
           "coverageStart": start, "coverageEnd": end, "stores": len(branches), "missingDates": missing_days,
           "rules": __doc__.split("Rules")[1].split("Usage")[0].strip(), "audit": dict(audit),
           "totals": {"storeRevenue": round(sum(store.values()), 2), "onlineRevenue": round(sum(online.values()), 2)},
           "rows": out_rows}
    with open("store-daily-revenue.js", "w") as f: f.write("window.STORE_DAILY_REVENUE=" + json.dumps(out, separators=(",", ":")) + ";\n")
    print(json.dumps({k: out[k] for k in ("coverageStart", "coverageEnd", "stores", "missingDates", "audit", "totals")}, indent=1))

if __name__ == "__main__":
    main(*sys.argv[1:])
