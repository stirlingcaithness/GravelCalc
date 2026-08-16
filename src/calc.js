/*
 * calc.js - Core gravel calculation logic for GravelCalc.
 * All calculations are done in metric base units (metres, kilograms) internally.
 */

function distanceToMetres(value, unit) {
  switch ((unit || 'm').toLowerCase()) {
    case 'm': return value;
    case 'km': return value * 1000;
    default: throw new Error('Unknown distance unit: ' + unit);
  }
}

function metresToDistance(value, unit) {
  switch ((unit || 'm').toLowerCase()) {
    case 'm': return value;
    case 'km': return value / 1000;
    default: throw new Error('Unknown distance unit: ' + unit);
  }
}

function thicknessToMetres(value, unit) {
  switch ((unit || 'mm').toLowerCase()) {
    case 'mm': return value / 1000;
    case 'cm': return value / 100;
    case 'm': return value;
    default: throw new Error('Unknown thickness unit: ' + unit);
  }
}

function weightToKg(value, unit) {
  const u = normaliseWeightUnit(unit);
  switch (u) {
    case 'kg': return value;
    case 't': return value * 1000;
    default: throw new Error('Unknown weight unit: ' + unit);
  }
}

function kgToUnit(value, unit) {
  const u = normaliseWeightUnit(unit);
  switch (u) {
    case 'kg': return value;
    case 't': return value / 1000;
    default: throw new Error('Unknown weight unit: ' + unit);
  }
}

function densityToKgM3(value, unit) {
  const u = normaliseDensityUnit(unit);
  switch (u) {
    case 'kgm3': return value;
    case 'tm3': return value * 1000;
    default: throw new Error('Unknown density unit: ' + unit);
  }
}

function normaliseWeightUnit(unit) {
  const u = String(unit || 't').trim().toLowerCase();
  if (['t', 'tonne', 'tonnes', 'metric tonne', 'metric tonnes'].includes(u)) return 't';
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  return u;
}

function normaliseDensityUnit(unit) {
  const u = String(unit || 'kgm3').trim().toLowerCase().replace(/\s/g, '');
  if (['kgm3', 'kg/m3', 'kg/m³', 'kgper cubic metre', 'kgpercubicmetre'].includes(u)) return 'kgm3';
  if (['tm3', 't/m3', 't/m³', 'tonnes/m3', 'tonnes/m³', 'tonne/m3', 'tonne/m³'].includes(u)) return 'tm3';
  return u;
}

function validateNumbers(fields) {
  const errors = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === '' || value === null || value === undefined) {
      errors.push(`${name} is required.`);
    } else if (isNaN(Number(value))) {
      errors.push(`${name} must be a number.`);
    } else if (Number(value) < 0) {
      errors.push(`${name} cannot be negative.`);
    } else if (name !== 'Waste %' && Number(value) === 0) {
      errors.push(`${name} must be greater than zero.`);
    }
  }
  return errors;
}

function calcGravelNeeded({ length, lengthUnit = 'm', width, widthUnit = 'm', thickness, thicknessUnit = 'mm', density, densityUnit = 'kgm3', wastePct = 0, resultUnit = 't' }) {
  const L = distanceToMetres(Number(length), lengthUnit);
  const W = distanceToMetres(Number(width), widthUnit);
  const T = thicknessToMetres(Number(thickness), thicknessUnit);
  const D = densityToKgM3(Number(density), densityUnit);
  const waste = Number(wastePct) || 0;

  const baseVolume = L * W * T;
  const baseWeightKg = baseVolume * D;
  const totalWeightKg = baseWeightKg * (1 + waste / 100);
  const totalVolume = baseVolume * (1 + waste / 100);
  const result = kgToUnit(totalWeightKg, resultUnit);

  return {
    volumeM3: round(totalVolume, 3),
    weightKg: round(totalWeightKg, 2),
    result: round(result, 2),
    resultUnit: normaliseWeightUnit(resultUnit),
    breakdown: [
      `Volume = ${round(L, 2)} m x ${round(W, 2)} m x ${round(T, 3)} m = ${round(baseVolume, 3)} m3`,
      `Weight = ${round(baseVolume, 3)} m3 x ${round(D, 2)} kg/m3 = ${round(baseWeightKg, 2)} kg`,
      waste > 0 ? `Waste/compaction +${waste}% -> ${round(totalWeightKg, 2)} kg` : 'No waste allowance applied',
      `Result = ${round(result, 2)} ${normaliseWeightUnit(resultUnit) === 't' ? 'tonnes' : 'kg'}`
    ]
  };
}

function calcDistanceCovered({ gravelAmount, gravelUnit = 't', width, widthUnit = 'm', thickness, thicknessUnit = 'mm', density, densityUnit = 'kgm3', wastePct = 0, lengthUnit = 'm' }) {
  const availableKg = weightToKg(Number(gravelAmount), gravelUnit);
  const W = distanceToMetres(Number(width), widthUnit);
  const T = thicknessToMetres(Number(thickness), thicknessUnit);
  const D = densityToKgM3(Number(density), densityUnit);
  const waste = Number(wastePct) || 0;
  const outUnit = String(lengthUnit || 'm').toLowerCase();

  const effectiveKg = availableKg / (1 + waste / 100);
  const volume = effectiveKg / D;
  const lengthM = volume / (W * T);
  const lengthOut = metresToDistance(lengthM, outUnit);

  return {
    volumeM3: round(volume, 3),
    lengthM: round(lengthM, 2),
    lengthOut: round(lengthOut, outUnit === 'km' ? 4 : 2),
    lengthUnit: outUnit,
    breakdown: [
      `Available gravel = ${round(availableKg, 2)} kg`,
      waste > 0 ? `Waste/compaction -${waste}% -> ${round(effectiveKg, 2)} kg usable` : 'No waste allowance applied',
      `Volume = ${round(effectiveKg, 2)} kg / ${round(D, 2)} kg/m3 = ${round(volume, 3)} m3`,
      `Length = ${round(volume, 3)} m3 / (${round(W, 2)} m x ${round(T, 3)} m) = ${round(lengthM, 2)} m`
    ]
  };
}

function round(n, dp) {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

const GravelCalc = { distanceToMetres, metresToDistance, thicknessToMetres, weightToKg, kgToUnit, densityToKgM3, normaliseWeightUnit, normaliseDensityUnit, validateNumbers, calcGravelNeeded, calcDistanceCovered, round };
if (typeof module !== 'undefined' && module.exports) module.exports = GravelCalc;
if (typeof window !== 'undefined') window.GravelCalc = GravelCalc;
