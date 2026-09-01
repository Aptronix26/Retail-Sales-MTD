(() => {
  const actuals = globalThis.PROD_ACH_2454;
  const targets = globalThis.PROD_TARGETS_2454 || (typeof EMBEDDED_TARGETS === 'undefined' ? null : EMBEDDED_TARGETS);
  const commercial = globalThis.PROD_COMMERCIAL_2454 || {};
  if (!actuals || !targets) return;

  const clean = value => String(value || '').replace(/^Aptronix\s+/i, '');
  const pct = value => `${(value * 100).toFixed(1)}%`;
  const money = value => value >= 1e7 ? `₹${(value / 1e7).toFixed(2)} Cr` : `₹${(value / 1e5).toFixed(1)} L`;
  const productNames = { iphone: 'iPhone', mac: 'Mac', ipad: 'iPad', watch: 'Watch', airpods: 'AirPods' };
  const snapshotDate = Object.values(actuals)[0]?.date || '';
  const day = Number(snapshotDate.slice(-2)) || 30;
  const daysInMonth = new Date(Number(snapshotDate.slice(0, 4)), Number(snapshotDate.slice(5, 7)), 0).getDate() || 31;
  const elapsed = day / daysInMonth;

  const rows = Object.keys(actuals).map(key => {
    const a = actuals[key], t = targets[key], c = commercial[key] || {};
    if (!t || !t.revenue) return null;
    const ratios = Object.keys(productNames).map(k => ({ key: k, ratio: Number(t[k]) ? Number(a[k] || 0) / Number(t[k]) : null })).filter(x => Number.isFinite(x.ratio));
    const best = [...ratios].sort((x, y) => y.ratio - x.ratio)[0];
    const weak = [...ratios].sort((x, y) => x.ratio - y.ratio)[0];
    const devices = ['iphone', 'mac', 'ipad', 'watch', 'airpods'].reduce((s, k) => s + Number(a[k] || 0), 0);
    return {
      name: clean(a.store), actual: Number(a.revenue || 0), target: Number(t.revenue),
      pace: Number(a.revenue || 0) / Number(t.revenue), paceDelta: Number(a.revenue || 0) / Number(t.revenue) - elapsed,
      gap: Number(t.revenue) - Number(a.revenue || 0), best, weak,
      trade: Number(a.iphone) ? Number(c.iphoneTradeQty || 0) / Number(a.iphone) : 0,
      loan: devices ? Number(c.overallLoanQty || 0) / devices : 0
    };
  }).filter(Boolean);

  const hits = rows.filter(r => r.paceDelta >= 0).sort((a, b) => b.paceDelta - a.paceDelta).slice(0, 5);
  const misses = rows.filter(r => r.paceDelta < 0).sort((a, b) => a.paceDelta - b.paceDelta).slice(0, 5);
  const item = (r, i, hit) => {
    const lever = r.loan >= .25 ? `loan attach is healthy at ${pct(r.loan)}` : r.trade >= .20 ? `iPhone trade-in attach is healthy at ${pct(r.trade)}` : `both loan (${pct(r.loan)}) and trade-in (${pct(r.trade)}) offer headroom`;
    const driver = hit ? r.best : r.weak;
    const why = hit
      ? `The store is ${(r.paceDelta * 100).toFixed(1)} points ahead of calendar pace. ${driver ? `${productNames[driver.key]} is the strongest product signal at ${pct(driver.ratio)} of target; ` : ''}${lever}.`
      : `The store is ${Math.abs(r.paceDelta * 100).toFixed(1)} points behind calendar pace and still needs ${money(Math.max(0, r.gap))}. ${driver ? `${productNames[driver.key]} is the weakest product signal at ${pct(driver.ratio)} of target; ` : ''}${lever}.`;
    const action = hit ? 'Protect availability in the leading LOB and replicate the store’s strongest commercial behaviour.' : `Prioritise ${driver ? productNames[driver.key] : 'the weakest LOB'} conversion and use loan/trade-in offers to close the remaining value gap.`;
    return `<div class="hm-item"><div class="hm-rank">${i + 1}</div><div><div class="hm-title">${r.name}</div><div class="hm-signal">${pct(r.pace)} of monthly revenue target</div><div class="hm-reason">${why}</div><div class="hm-action"><b>Action:</b> ${action}</div></div></div>`;
  };
  const section = document.createElement('section');
  section.className = 'hm-section';
  section.innerHTML = `<div class="hm-head"><div><h2>Hits &amp; Misses — Daily MTD</h2><p>Decision-led store signals combining revenue target pace, product achievement and available commercial levers.</p></div><span class="hm-period">Through ${snapshotDate || `day ${day}`}</span></div><div class="hm-grid"><div class="hm-panel hm-hit"><div class="hm-panel-title">Hits — performance to protect</div><div class="hm-list">${hits.map((r, i) => item(r, i, true)).join('')}</div></div><div class="hm-panel hm-miss"><div class="hm-panel-title">Misses — gaps requiring intervention</div><div class="hm-list">${misses.map((r, i) => item(r, i, false)).join('')}</div></div></div><div class="hm-note"><b>Method:</b> Hit/miss status compares store revenue achievement with elapsed calendar pace (${pct(elapsed)}). Ranking uses the size of the pace gap, while the narrative adds the strongest/weakest product target signal and commercial attach context. This is diagnostic evidence, not a claim of causation.</div>`;
  const host = document.querySelector('#dashboard') || document.querySelector('main');
  if (host) host.appendChild(section);
  globalThis.HITS_MISSES_MODEL = { period: snapshotDate, hits, misses };
})();
