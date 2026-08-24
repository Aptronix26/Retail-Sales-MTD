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
| iPhone protection attach % | iPhone protection/licence quantity ÷ iPhone units × 100 |
| Overall protection attach % | Overall protection/licence quantity ÷ total iPhone, Mac, iPad, Watch and AirPods units × 100 |
| Same-date revenue YoY % | (Current MTD revenue − prior-year revenue through the same calendar day) ÷ prior-year same-date revenue × 100 |
| Like-for-like revenue YoY % | Same-date revenue YoY calculated only for stores with a non-zero prior-year same-date base |

Zero denominators return `NA` rather than an artificial zero. Aggregate views should be calculated from summed numerators and denominators, not averages of store percentages.

For the 23 August 2026 snapshot, `Aptronix_PLF_SKC` and `Ecom-TL` are outside the approved 69-store scope. Trade-in transaction `LOGTI/2627/3821` is quarantined because its source quantity is 46,000, and 208 loan quantities assigned to an unmapped `#N/A` branch remain excluded. Store-level YoY displays `Low LY base` when comparable revenue is below ₹1 lakh.
