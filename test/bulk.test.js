const assert = require('assert');
const { processBulkRows } = require('../src/bulk.js');
const rows = [
  { Mode:'A', Length:100, LengthUnit:'m', Width:4, WidthUnit:'m', Thickness:100, ThicknessUnit:'mm', Density:1600, DensityUnit:'kgm3', 'Waste%':0, ResultUnit:'t' },
  { Mode:'B', Width:4, WidthUnit:'m', Thickness:100, ThicknessUnit:'mm', Density:1600, DensityUnit:'kgm3', 'Waste%':0, GravelAmount:64, GravelUnit:'t', DistanceUnit:'m' },
  { Mode:'A', Length:'', Width:4, Thickness:100, Density:1600 }
];
const out = processBulkRows(rows);
assert.strictEqual(out.summary.totalRows, 3);
assert.strictEqual(out.summary.succeeded, 2);
assert.strictEqual(out.summary.failed, 1);
assert.strictEqual(out.rows[0].result, 64);
assert.strictEqual(out.rows[1].result, 100);
assert.ok(out.rows[2].status.includes('Length'));
console.log('bulk tests passed');
