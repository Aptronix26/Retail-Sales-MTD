# Metric dictionary

| Metric | Standard definition |
|---|---|
| Achievement % | Actual ÷ Target × 100 |
| Remaining gap | Maximum of zero and Target − Actual |
| Required daily run rate | Remaining gap ÷ Remaining reporting days |
| Projected exit | Actual ÷ Elapsed reporting days × Total reporting days |
| Projected exit % | Projected exit ÷ Target × 100 |
| Growth % | (Current − Comparable) ÷ Comparable × 100 |
| Percentage-point change | (Current rate − Comparable rate) × 100 |
| iPhone loan attach % | iPhone loan quantity ÷ iPhone units × 100 |
| Overall loan attach % | Overall loan quantity ÷ total iPhone, Mac, iPad, Watch and AirPods units × 100 |
| iPhone trade-in attach % | Validated iPhone trade-in quantity ÷ iPhone units × 100 |
| Mac trade-in attach % | Validated Mac trade-in quantity ÷ Mac units × 100 |
| iPhone license attach % | iPhone protection/licence quantity ÷ iPhone units × 100 |
| Overall license attach % | Overall protection/licence quantity ÷ total iPhone, Mac, iPad, Watch and AirPods units × 100 |
| Same-date revenue YoY % | (Current revenue through 4 Oct 2026 − prior-year revenue through 4 Oct 2025) ÷ prior-year revenue through 4 Oct 2025 × 100 |
| Like-for-like available-period YoY % | Available-period revenue YoY calculated only for stores with a non-zero supplied prior-year base |
| Top 5 / Bottom 5 attach ranking | Store attach rates recalculated from each store's numerator and eligible unit denominator, sorted descending or ascending respectively; zero rates remain valid when the denominator is positive |

Zero denominators return `NA` rather than an artificial zero. Aggregate views should be calculated from summed numerators and denominators, not averages of store percentages.

For the 4 October 2026 snapshot, `Aptronix_PLF_SKC` and `Ecom-TL` are outside the approved 69-store scope. No impossible trade-in quantities were found; no eligible core-device loan quantity has an unmapped branch. The supplied prior-year comparison covers the same dates, 1–4 October 2025. Store-level growth displays `Low LY base` when comparable revenue is below ₹1 lakh.

