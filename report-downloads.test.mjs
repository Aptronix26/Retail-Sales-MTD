import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const exportsSource=fs.readFileSync(new URL('./report-downloads.js',import.meta.url),'utf8');
const productSource=fs.readFileSync(new URL('./product-intelligence.js',import.meta.url),'utf8');

assert.match(index,/report-downloads\.css\?v=20261116-export1/,'export CSS must be cache-busted in index');
assert.match(index,/report-downloads\.js\?v=20261116-export1/,'export JS must be cache-busted in index');
assert.match(index,/product-intelligence\.js\?v=20261117-lob1/,'separate LOB totals must be cache-busted in index');
assert.match(exportsSource,/function downloadCurrentPage\(\)/,'page-wise download function must exist');
assert.match(exportsSource,/function downloadGrid\(table\)/,'grid-wise download function must exist');
assert.match(exportsSource,/XLSX\.utils\.aoa_to_sheet/,'exports must create real Excel worksheets');
assert.match(exportsSource,/XLSX\.writeFile/,'exports must download an xlsx file');
assert.match(exportsSource,/const page=activePage\(\)/,'page export must be scoped to the active page');
assert.match(exportsSource,/Exports only the current login scope/,'the UI must explain login scoping');
assert.ok((productSource.match(/productTotalRow/g)||[]).length>=3,'all three product tables must include separate LOB total rows');
assert.doesNotMatch(productSource,/Total · full filtered result/,'detail totals must not combine LOB units');
assert.match(productSource,/const detailTotals=totalLobs\.map/,'detail totals must be calculated independently for each LOB');
assert.match(productSource,/const storeTotals=totalLobs\.map/,'store totals must be calculated independently for each LOB');

console.log('report download and Product Intelligence total-row checks passed');
