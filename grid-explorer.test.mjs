import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('every dashboard grid receives selective controls and zero-achievement treatment',()=>{
  const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const js=fs.readFileSync(new URL('./grid-explorer.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('./grid-explorer.css',import.meta.url),'utf8');
  assert.match(html,/grid-explorer\.css\?v=20261121-ux2/);
  assert.match(html,/grid-explorer\.js\?v=20261121-ux2/);
  assert.match(js,/Search this grid/);
  assert.match(js,/Data point \/ column/);
  assert.match(js,/Zero achievement/);
  assert.match(js,/MutationObserver/);
  assert.match(css,/\.zeroAchievement/);
  assert.match(css,/\.gridExplorerBar/);
  assert.match(css,/repeat\(auto-fit,minmax\(min\(100%,150px\),1fr\)\)/);
  assert.match(css,/max-width:100%/);
});
