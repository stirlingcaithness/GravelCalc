/* bulk.js - Bulk row normalisation and processing. Reuses calc.js maths. */
const calc = (typeof require !== 'undefined') ? require('./calc.js') : window.GravelCalc;

const HEADERS = ['Mode','Length','LengthUnit','Width','WidthUnit','Thickness','ThicknessUnit','Density','DensityUnit','Waste%','GravelAmount','GravelUnit','ResultUnit','DistanceUnit'];

function canonHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[%\s_\-]/g, '');
}

function normaliseMode(v) {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'A' || s.includes('NEED') || s.includes('GRAVEL')) return 'A';
  if (s === 'B' || s.includes('DISTANCE') || s.includes('COVER')) return 'B';
  return s;
}

function value(row, names, fallback = '') {
  const keys = Object.keys(row);
  for (const n of names) {
    const target = canonHeader(n);
    const match = keys.find(k => canonHeader(k) === target);
    if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match];
  }
  return fallback;
}

function unit(value, fallback) {
  const s = String(value || fallback || '').trim();
  return s || fallback;
}

function processBulkRows(rawRows) {
  const results = [];
  for (const [idx, raw] of rawRows.entries()) {
    const rowNumber = raw.__rowNumber || idx + 2;
    const mode = normaliseMode(value(raw, ['Mode']));
    const width = value(raw, ['Width']);
    const thickness = value(raw, ['Thickness']);
    const density = value(raw, ['Density']);
    const wastePct = value(raw, ['Waste%', 'Waste'], 0);
    const widthUnit = unit(value(raw, ['WidthUnit']), 'm').toLowerCase();
    const thicknessUnit = unit(value(raw, ['ThicknessUnit']), 'mm').toLowerCase();
    const densityUnit = calc.normaliseDensityUnit(value(raw, ['DensityUnit'], 'kgm3'));

    const base = { rowNumber, mode, input: raw, width, widthUnit, thickness, thicknessUnit, density, densityUnit, wastePct };

    try {
      if (mode === 'A') {
        const length = value(raw, ['Length']);
        const lengthUnit = unit(value(raw, ['LengthUnit']), 'm').toLowerCase();
        const resultUnit = calc.normaliseWeightUnit(value(raw, ['ResultUnit'], 't'));
        const errors = calc.validateNumbers({ 'Length': length, 'Width': width, 'Thickness': thickness, 'Density': density, 'Waste %': wastePct });
        validateUnits(errors, { lengthUnit, widthUnit, thicknessUnit, densityUnit, resultUnit });
        if (errors.length) throw new Error(errors.join(' '));
        const out = calc.calcGravelNeeded({ length, lengthUnit, width, widthUnit, thickness, thicknessUnit, density, densityUnit, wastePct, resultUnit });
        const unitLabel = resultUnit === 't' ? 'tonnes' : 'kg';
        results.push({ ...base, ok: true, status: 'OK', length: `${length} ${lengthUnit}`, result: out.result, resultUnit: unitLabel, volumeM3: out.volumeM3,
          historyRecord: { mode: 'A — Gravel needed', datetime: new Date().toLocaleString(), inputs: { length: `${length} ${lengthUnit}`, width: `${width} ${widthUnit}`, thickness, thicknessUnit, density: `${density} ${densityUnit === 'tm3' ? 't/m3' : 'kg/m3'}`, wastePct }, result: out.result, resultUnit: unitLabel } });
      } else if (mode === 'B') {
        const gravelAmount = value(raw, ['GravelAmount']);
        const gravelUnit = calc.normaliseWeightUnit(value(raw, ['GravelUnit'], 't'));
        const distanceUnit = unit(value(raw, ['DistanceUnit']), 'm').toLowerCase();
        const errors = calc.validateNumbers({ 'Gravel available': gravelAmount, 'Width': width, 'Thickness': thickness, 'Density': density, 'Waste %': wastePct });
        validateUnits(errors, { widthUnit, thicknessUnit, densityUnit, gravelUnit, distanceUnit });
        if (errors.length) throw new Error(errors.join(' '));
        const out = calc.calcDistanceCovered({ gravelAmount, gravelUnit, width, widthUnit, thickness, thicknessUnit, density, densityUnit, wastePct, lengthUnit: distanceUnit });
        results.push({ ...base, ok: true, status: 'OK', gravelAmount: `${gravelAmount} ${gravelUnit}`, result: out.lengthOut, resultUnit: out.lengthUnit, volumeM3: out.volumeM3,
          historyRecord: { mode: 'B — Distance covered', datetime: new Date().toLocaleString(), inputs: { length: '', gravelAmount: `${gravelAmount} ${gravelUnit}`, width: `${width} ${widthUnit}`, thickness, thicknessUnit, density: `${density} ${densityUnit === 'tm3' ? 't/m3' : 'kg/m3'}`, wastePct }, result: out.lengthOut, resultUnit: out.lengthUnit } });
      } else {
        throw new Error('Mode must be A or B.');
      }
    } catch (err) {
      results.push({ ...base, ok: false, status: err.message, result: '', resultUnit: '', volumeM3: '', historyRecord: null });
    }
  }
  return { rows: results, summary: summarise(results) };
}

function validateUnits(errors, u) {
  if (u.lengthUnit && !['m','km'].includes(u.lengthUnit)) errors.push('LengthUnit must be m or km.');
  if (u.widthUnit && !['m','km'].includes(u.widthUnit)) errors.push('WidthUnit must be m or km.');
  if (u.thicknessUnit && !['mm','cm','m'].includes(u.thicknessUnit)) errors.push('ThicknessUnit must be mm, cm or m.');
  if (u.densityUnit && !['kgm3','tm3'].includes(u.densityUnit)) errors.push('DensityUnit must be kgm3 or tm3.');
  if (u.resultUnit && !['kg','t'].includes(u.resultUnit)) errors.push('ResultUnit must be kg or t.');
  if (u.gravelUnit && !['kg','t'].includes(u.gravelUnit)) errors.push('GravelUnit must be kg or t.');
  if (u.distanceUnit && !['m','km'].includes(u.distanceUnit)) errors.push('DistanceUnit must be m or km.');
}

function summarise(rows) {
  const totalRows = rows.length;
  const succeeded = rows.filter(r => r.ok).length;
  const failed = totalRows - succeeded;
  const totalModeATonnes = rows.filter(r => r.ok && r.mode === 'A').reduce((sum, r) => {
    const tonnes = r.resultUnit === 'kg' ? Number(r.result) / 1000 : (r.resultUnit === 'tonnes' ? Number(r.result) : Number(r.result));
    return sum + (isNaN(tonnes) ? 0 : tonnes);
  }, 0);
  return { totalRows, succeeded, failed, totalModeATonnes: calc.round(totalModeATonnes, 2) };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { HEADERS, processBulkRows, summarise };
if (typeof window !== 'undefined') window.GravelBulk = { HEADERS, processBulkRows, summarise };
