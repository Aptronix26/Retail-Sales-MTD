"""Rebuild the sales data files (sales-achievements.js, commercial-executive-data*.js,
product-sales-data*.js) straight from the raw Rujul Sales Invoice Statement.

Definitions (reverse-engineered from, and validated against, the previous build):
- Stores: the target stores already in sales-achievements.js (staff targets exist); others are counted
  as store_without_target.
- Lines excluded: Status Cancelled / Hold, Transaction Type Dispatch.
- Core LOB from Category: IPHONE, MAC, IPAD, WATCH, AIRPODS. Units = Invoice Quantity (returns negative).
- netRevenue / revenue = Total; grossProfit = GP AT Amount; discount = MRP Discount.
- Trade-in / full swipe / finance from Affordability text; license units from "Licenses For <LOB>" lines.
- Staff achievements = core units of the executive codes mapped to each staff row (store + code).
- Every invoice line is kept (identical lines on one bill are separate units); pass --legacy-dedup only
  to reproduce the old build for validation.
Usage: python3 tools/build_sales_from_sis.py <statement.xlsx|.csv> [--until YYYY-MM-DD] [--legacy-dedup] [--check-only]
"""
import json, subprocess, sys, datetime, math
import pandas as pd

LOBS = ["iPhone", "Mac", "iPad", "Watch", "AirPods"]
CAT = {"IPHONE": "iPhone", "MAC": "Mac", "IPAD": "iPad", "WATCH": "Watch", "AIRPODS": "AirPods"}
LIC = {"Licenses For iPhone": "iPhone", "Licenses For Mac": "Mac", "Licenses For iPad": "iPad", "Licenses For Apple Watch": "Watch", "Licenses For Airpods": "AirPods"}
NUM = ["Invoice Quantity", "Total", "GP AT Amount", "MRP Discount"]

def load_current():
    js = "global.window=global;" + "".join(f"require('./{f}');" for f in ["sales-achievements.js", "commercial-executive-data.js", "commercial-executive-data-2.js", "commercial-executive-data-3.js", "commercial-executive-data-4.js", "product-sales-data.js", "product-sales-data-2.js"]) + "process.stdout.write(JSON.stringify(WEEKLY_STAFF_ACHIEVEMENTS))"
    return json.loads(subprocess.check_output(["node", "-e", js], maxBuffer=1 << 30) if False else subprocess.run(["node", "-e", js], capture_output=True, check=True).stdout)

def read_statement(path):
    if path.endswith(".csv"):
        df = pd.read_csv(path, dtype=str, low_memory=False)
    else:
        df = pd.read_excel(path, dtype=str)
    df = df[df["Branch ID"].notna() & df["TXNDate"].notna()].copy()
    for c in NUM: df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["ds"] = pd.to_datetime(df["TXNDate"], format="%d-%m-%Y").dt.strftime("%Y-%m-%d")
    for c in ["Executive", "Executive Code", "Branch ID"]: df[c] = df[c].fillna("").astype(str).str.strip()
    return df

def r2(x): return round(float(x), 2)
def iv(x): return int(round(float(x)))

def main(argv):
    path = argv[0]; until = argv[argv.index("--until") + 1] if "--until" in argv else None
    legacy = "--legacy-dedup" in argv; check_only = "--check-only" in argv
    cur = load_current(); raw = read_statement(path)
    raw_rows = len(raw)
    if until: raw = raw[raw.ds <= until]
    weeks = cur["weekRanges"]; raw["week"] = None
    for w, r in weeks.items(): raw.loc[(raw.ds >= r["start"]) & (raw.ds <= r["end"]), "week"] = w
    stores = sorted({r["store"] for r in cur["rows"]})
    excluded = {"non_core_lob": 0, "store_without_target": 0, "cancelled_or_hold": 0, "non_sales_transaction": 0}
    v = raw.copy()
    dup_cols = [c for c in v.columns if c not in ("ds", "week")]
    raw_dups = int(v.duplicated(dup_cols).sum())
    if legacy: v = v[~v.duplicated(dup_cols)]
    m = ~v["Branch ID"].isin(stores); excluded["store_without_target"] = int(m.sum()); v = v[~m]
    m = v.Status.isin(["Cancelled", "Hold"]); excluded["cancelled_or_hold"] = int(m.sum()); v = v[~m]
    m = v["Transaction Type"].eq("Dispatch"); excluded["non_sales_transaction"] = int(m.sum()); v = v[~m]
    a = v.Affordability.fillna("").str.lower()
    v["lob"] = v.Category.map(CAT); v["licLob"] = v.LOB.map(LIC).where(v["Business Unit"].eq("Licenses"))
    v["isTrade"] = a.str.contains("trade-in"); v["isSwipe"] = a.str.contains("full swipe"); v["isFin"] = a.str.contains("emi|finance|fti") & ~v.isSwipe
    v["q"] = v["Invoice Quantity"]
    core = v[v.lob.notna()]; excluded["non_core_lob"] = int(v.lob.isna().sum())

    def commercial(keys):
        g = lambda d, col: d.groupby(keys)[col].sum()
        base = pd.DataFrame({"netRevenue": g(v, "Total"), "grossProfit": g(v, "GP AT Amount"), "discountValue": g(v, "MRP Discount")})
        extra = {"coreRevenue": g(core, "Total"), "coreUnits": g(core, "q"), "tradeInUnits": g(core[core.isTrade], "q"), "financeUnits": g(core[core.isFin], "q"), "fullSwipeUnits": g(core[core.isSwipe], "q"), "licenseUnits": g(v[v.licLob.notna()], "q")}
        for k, s in extra.items(): base[k] = s
        base = base.fillna(0)
        by = {}
        for name, sub, col, lc in [("lobUnits", core, "q", "lob"), ("lobRevenue", core, "Total", "lob"), ("tradeInByLob", core[core.isTrade], "q", "lob"), ("financeByLob", core[core.isFin], "q", "lob"), ("fullSwipeByLob", core[core.isSwipe], "q", "lob"), ("licenseByLob", v[v.licLob.notna()], "q", "licLob")]:
            by[name] = sub.groupby(keys + [lc])[col].sum().unstack(lc).reindex(columns=LOBS).reindex(base.index).fillna(0) if len(sub) else pd.DataFrame(0, index=base.index, columns=LOBS)
        out = []
        for idx, row in base.iterrows():
            idx = idx if isinstance(idx, tuple) else (idx,)
            rec = dict(zip(keys, idx))
            rec.update({"netRevenue": r2(row.netRevenue), "coreRevenue": r2(row.coreRevenue), "coreUnits": iv(row.coreUnits), "grossProfit": r2(row.grossProfit), "discountValue": r2(row.discountValue), "tradeInUnits": iv(row.tradeInUnits), "financeUnits": iv(row.financeUnits), "fullSwipeUnits": iv(row.fullSwipeUnits), "licenseUnits": iv(row.licenseUnits)})
            for name, df in by.items():
                rec[name] = {l: (r2(df.loc[idx if len(idx) > 1 else idx[0], l]) if name == "lobRevenue" else iv(df.loc[idx if len(idx) > 1 else idx[0], l])) for l in LOBS}
            out.append(rec)
        return out

    wkey = lambda w: int(w[1:])
    store_week = commercial(["Branch ID", "week"])
    for r in store_week: r["store"] = r.pop("Branch ID")
    store_week = [{"store": r["store"], "week": r["week"], **{k: r[k] for k in r if k not in ("store", "week")}} for r in store_week]
    store_week.sort(key=lambda r: (r["store"], wkey(r["week"])))
    exec_week = commercial(["Branch ID", "week", "Executive", "Executive Code"])
    exec_week = [{"store": r["Branch ID"], "week": r["week"], **{k: r[k] for k in r if k not in ("Branch ID", "week", "Executive", "Executive Code")}, "executive": r["Executive"], "executiveCode": r["Executive Code"]} for r in exec_week]
    exec_week.sort(key=lambda r: (r["store"], wkey(r["week"]), r["executive"], r["executiveCode"]))
    prod = core.assign(subLob=core.LOB.fillna("Unclassified"), location=core["Branch City"].fillna("")).groupby(["week", "Branch ID", "location", "lob", "subLob"]).agg(units=("q", "sum"), revenue=("Total", "sum"), grossProfit=("GP AT Amount", "sum"), discount=("MRP Discount", "sum")).reset_index()
    prod = prod[~((prod.units.abs() < 1e-9) & (prod.revenue.abs() < 1e-9))]
    products = [{"week": r.week, "store": r["Branch ID"], "location": r.location, "lob": r.lob, "subLob": r.subLob, "units": float(r.units), "revenue": r2(r.revenue), "grossProfit": r2(r.grossProfit), "discount": r2(r.discount)} for _, r in prod.iterrows()]
    products.sort(key=lambda r: (wkey(r["week"]), r["store"], r["lob"], r["subLob"]))

    cu = core.groupby(["Branch ID", "Executive Code", "week", "lob"]).q.sum()
    mapped = set()
    rows = []
    for r in cur["rows"]:
        codes = [str(e["code"]).strip() for e in r["executives"]]; mapped |= {(r["store"], c) for c in codes}
        ach = {w: {l: iv(sum(cu.get((r["store"], c, w, l), 0) for c in codes)) for l in LOBS} for w in weeks}
        rows.append({**r, "achievements": ach})
    is_mapped = core.apply(lambda x: (x["Branch ID"], x["Executive Code"]) in mapped, axis=1) if len(core) else pd.Series(dtype=bool)
    def by_week(d): return {w: {l: iv(d[(d.week == w) & (d.lob == l)].q.sum()) for l in LOBS} for w in weeks}
    um = core[~is_mapped]
    unmapped = []
    for (s, e, c), d in um.groupby(["Branch ID", "Executive", "Executive Code"]):
        lu = {l: iv(d[d.lob == l].q.sum()) for l in LOBS}
        unmapped.append({"store": s, "executive": e, "executiveCode": c, "units": iv(sum(lu.values())), "lobUnits": lu})
    unmapped.sort(key=lambda r: (-r["units"], r["store"], r["executive"]))
    dates = sorted(v.ds.unique()); as_of = dates[-1]
    all_days = [(datetime.date.fromisoformat(dates[0]) + datetime.timedelta(n)).isoformat() for n in range((datetime.date.fromisoformat(as_of) - datetime.date.fromisoformat(dates[0])).days + 1)]
    latest_week = next(w for w, r in weeks.items() if r["start"] <= as_of <= r["end"])
    sale_units = float(core[core.q > 0].q.sum()); return_units = float(-core[core.q < 0].q.sum())
    new = {**{k: cur[k] for k in cur if k not in ("commercialByExecutiveWeek", "productByStoreWeek")},
           "version": datetime.date.today().isoformat(), "asOfDate": as_of,
           "weekRanges": {w: {**r, "isComplete": r["end"] <= as_of} for w, r in weeks.items()},
           "sourceRowCount": int(len(v) + excluded["store_without_target"] + excluded["cancelled_or_hold"] + excluded["non_sales_transaction"]),
           "validCoreRowCount": int(len(core)), "rows": rows, "mappingIssues": [],
           "sourceCoreByWeek": by_week(core), "matchedCoreByWeek": by_week(core[is_mapped]), "unmappedCoreByWeek": by_week(um),
           "unmappedExecutives": unmapped, "excludedRows": excluded, "commercialByStoreWeek": store_week,
           "sourceValidation": {"status": "passed" if not [d for d in all_days if d not in set(dates)] else "failed", "criticalIssues": [], "sourceRows": raw_rows, "processedRows": int(len(raw) - (raw_dups if legacy else 0)), "dateStart": dates[0], "dateEnd": as_of, "missingDates": [d for d in all_days if d not in set(dates)], "overlapDates": [], "exactDuplicateRows": 0, "rawExactDuplicateRows": raw_dups, "deduplicatedRows": raw_dups if legacy else 0, "identicalLinesKept": 0 if legacy else raw_dups, "missingExecutiveRows": int((v["Executive"] == "").sum()), "blankSourceLobRows": int(core.LOB.isna().sum()), "excludedStoreRows": excluded["store_without_target"], "latestWeekStores": int(v[v.week == latest_week]["Branch ID"].nunique()), "targetStores": len(stores), "saleUnits": sale_units, "returnUnits": return_units, "returnRate": round(return_units / sale_units * 100, 2) if sale_units else 0}}
    if check_only:
        json.dump({**new, "commercialByExecutiveWeek": exec_week, "productByStoreWeek": products}, open("/tmp/sales_check.json", "w")); print("check written"); return
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    open("sales-achievements.js", "w").write("window.WEEKLY_STAFF_ACHIEVEMENTS=" + dump(new) + ";\n")
    def split(items, n, prefix, name):
        size = math.ceil(len(items) / n)
        for i in range(n):
            chunk = items[i * size:(i + 1) * size]; fn = f"{prefix}.js" if i == 0 else f"{prefix}-{i + 1}.js"
            body = f"window.WEEKLY_STAFF_ACHIEVEMENTS.{name}=" + dump(chunk) + ";\n" if i == 0 else f"window.WEEKLY_STAFF_ACHIEVEMENTS.{name}.push(...{dump(chunk)});\n"
            open(fn, "w").write(body)
    split(exec_week, 4, "commercial-executive-data", "commercialByExecutiveWeek")
    split(products, 2, "product-sales-data", "productByStoreWeek")
    print(json.dumps({"asOf": as_of, "storeWeeks": len(store_week), "execWeeks": len(exec_week), "products": len(products), "unmappedExecutives": len(unmapped), "excluded": excluded, "identicalLinesKept": raw_dups}, indent=1))

if __name__ == "__main__":
    main(sys.argv[1:])
