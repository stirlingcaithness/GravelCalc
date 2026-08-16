const assert = require('assert');
const c = require('../src/calc.js');
let a = c.calcGravelNeeded({length:100,lengthUnit:'m',width:4,widthUnit:'m',thickness:100,thicknessUnit:'mm',density:1600,densityUnit:'kgm3',wastePct:0,resultUnit:'t'});
assert.strictEqual(a.result,64);
let akm = c.calcGravelNeeded({length:0.1,lengthUnit:'km',width:4,widthUnit:'m',thickness:100,thicknessUnit:'mm',density:1.6,densityUnit:'tm3',wastePct:0,resultUnit:'t'});
assert.strictEqual(akm.result,64);
let b = c.calcDistanceCovered({gravelAmount:64,gravelUnit:'t',width:4,widthUnit:'m',thickness:100,thicknessUnit:'mm',density:1600,densityUnit:'kgm3',wastePct:0,lengthUnit:'km'});
assert.strictEqual(b.lengthOut,0.1);
console.log('calc tests passed');
