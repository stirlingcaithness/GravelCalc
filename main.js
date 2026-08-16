const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { XLSX = null; }
const { HEADERS, processBulkRows } = require('./src/bulk.js');

let mainWindow;
function historyPath() { return path.join(app.getPath('userData'), 'gravelcalc-history.json'); }
function readHistory() { try { return JSON.parse(fs.readFileSync(historyPath(), 'utf-8')); } catch { return []; } }
function writeHistory(list) { fs.writeFileSync(historyPath(), JSON.stringify(list, null, 2), 'utf-8'); }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 840, minWidth: 820, minHeight: 640, title: 'GravelCalc',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('history:get', () => readHistory());
ipcMain.handle('history:add', (_e, record) => { const list = readHistory(); list.unshift({ ...record, id: Date.now() + Math.floor(Math.random()*1000) }); writeHistory(list); return list; });
ipcMain.handle('history:delete', (_e, id) => { const list = readHistory().filter(r => r.id !== id); writeHistory(list); return list; });
ipcMain.handle('history:clear', () => { writeHistory([]); return []; });

const HISTORY_COLUMNS = [
  { header: 'Date/Time', key: 'datetime', width: 22 }, { header: 'Mode', key: 'mode', width: 26 },
  { header: 'Length/Gravel', key: 'length', width: 18 }, { header: 'Width', key: 'width', width: 14 },
  { header: 'Thickness', key: 'thickness', width: 14 }, { header: 'Density', key: 'density', width: 16 },
  { header: 'Waste %', key: 'waste', width: 10 }, { header: 'Result', key: 'result', width: 14 }, { header: 'Unit', key: 'unit', width: 10 }
];
function historyRow(r) { return { datetime: r.datetime, mode: r.mode, length: r.inputs.length || r.inputs.gravelAmount || '', width: r.inputs.width || '', thickness: r.inputs.thickness != null ? `${r.inputs.thickness} ${r.inputs.thicknessUnit}` : '', density: r.inputs.density || '', waste: r.inputs.wastePct || 0, result: r.result, unit: r.resultUnit }; }

async function writeStyledWorkbook(filePath, sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'GravelCalc';
  const ws = wb.addWorksheet(sheetName); ws.columns = columns; rows.forEach(r => ws.addRow(r));
  const header = ws.getRow(1); header.font = { bold: true, color: { argb: 'FFFFFFFF' } }; header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }; header.alignment = { vertical: 'middle', horizontal: 'center' }; header.height = 20;
  ws.eachRow((row, i) => { row.eachCell(cell => { cell.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } }; }); if (i > 1 && i % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FB' } }; }); });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(filePath);
}

ipcMain.handle('export:xlsx', async () => {
  const list = readHistory(); if (!list.length) return { ok: false, message: 'No history to export.' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Export history to Excel', defaultPath: 'GravelCalc-history.xlsx', filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }] });
  if (canceled || !filePath) return { ok: false, message: 'Export cancelled.' };
  await writeStyledWorkbook(filePath, 'History', HISTORY_COLUMNS, list.map(historyRow));
  return { ok: true, message: `Exported ${list.length} row(s) to ${filePath}` };
});

// ------------------------ Bulk Calculator IPC -------------------------------
function rowsFromWorksheet(ws) {
  const headerVals = [];
  ws.getRow(1).eachCell((cell, col) => { headerVals[col] = String(cell.value || '').trim(); });
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row || row.cellCount === 0) continue;
    const obj = { __rowNumber: r };
    let hasValue = false;
    headerVals.forEach((h, col) => { if (!h) return; const v = row.getCell(col).value; const val = v && typeof v === 'object' && v.text ? v.text : v; if (val !== null && val !== undefined && val !== '') hasValue = true; obj[h] = val; });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

ipcMain.handle('bulk:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: 'Upload bulk Excel file', filters: [{ name: 'Excel files', extensions: ['xlsx', 'xls'] }], properties: ['openFile'] });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, message: 'Import cancelled.' };
  const filePath = filePaths[0]; const ext = path.extname(filePath).toLowerCase();
  let rawRows = [];
  if (ext === '.xlsx') { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath); rawRows = rowsFromWorksheet(wb.worksheets[0]); }
  else if (ext === '.xls') {
    if (!XLSX) return { ok: false, message: 'Legacy .xls import needs the xlsx package. Run npm install first.' };
    const wb = XLSX.readFile(filePath); const sheet = wb.Sheets[wb.SheetNames[0]]; rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((r, i) => ({ __rowNumber: i + 2, ...r }));
  } else return { ok: false, message: 'Please choose an .xlsx or .xls file.' };
  const processed = processBulkRows(rawRows);
  return { ok: true, filePath, ...processed };
});

ipcMain.handle('bulk:template', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Save bulk calculator template', defaultPath: 'GravelCalc-Bulk-Template.xlsx', filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }] });
  if (canceled || !filePath) return { ok: false, message: 'Template save cancelled.' };
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Bulk Input');
  ws.addRow(HEADERS);
  ws.addRow(['A', 100, 'm', 4, 'm', 100, 'mm', 1600, 'kgm3', 10, '', '', 't', '']);
  ws.addRow(['B', '', '', 4, 'm', 100, 'mm', 1600, 'kgm3', 0, 64, 't', '', 'm']);
  ws.columns.forEach((c, i) => { c.width = Math.max(12, HEADERS[i] ? HEADERS[i].length + 4 : 12); });
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }]; await wb.xlsx.writeFile(filePath);
  return { ok: true, message: `Template saved to ${filePath}` };
});

const BULK_COLUMNS = [
  { header: 'Row', key: 'rowNumber', width: 8 }, { header: 'Mode', key: 'mode', width: 8 }, { header: 'Length/Gravel', key: 'lengthOrGravel', width: 18 },
  { header: 'Width', key: 'width', width: 12 }, { header: 'Thickness', key: 'thickness', width: 14 }, { header: 'Density', key: 'density', width: 16 },
  { header: 'Waste %', key: 'wastePct', width: 10 }, { header: 'Volume m3', key: 'volumeM3', width: 12 }, { header: 'Result', key: 'result', width: 14 },
  { header: 'Unit', key: 'resultUnit', width: 10 }, { header: 'Status', key: 'status', width: 40 }
];
function bulkExportRow(r) { return { rowNumber: r.rowNumber, mode: r.mode, lengthOrGravel: r.mode === 'A' ? (r.length || '') : (r.gravelAmount || ''), width: `${r.width || ''} ${r.widthUnit || ''}`.trim(), thickness: `${r.thickness || ''} ${r.thicknessUnit || ''}`.trim(), density: `${r.density || ''} ${r.densityUnit || ''}`.trim(), wastePct: r.wastePct, volumeM3: r.volumeM3, result: r.result, resultUnit: r.resultUnit, status: r.status }; }

ipcMain.handle('bulk:exportXlsx', async (_e, rows) => {
  if (!rows || !rows.length) return { ok: false, message: 'No bulk results to export.' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Export bulk results to Excel', defaultPath: 'GravelCalc-Bulk-Results.xlsx', filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }] });
  if (canceled || !filePath) return { ok: false, message: 'Export cancelled.' };
  await writeStyledWorkbook(filePath, 'Bulk Results', BULK_COLUMNS, rows.map(bulkExportRow));
  return { ok: true, message: `Exported ${rows.length} row(s) to ${filePath}` };
});

ipcMain.handle('bulk:exportCsv', async (_e, rows) => {
  if (!rows || !rows.length) return { ok: false, message: 'No bulk results to export.' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Export bulk results to CSV', defaultPath: 'GravelCalc-Bulk-Results.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (canceled || !filePath) return { ok: false, message: 'Export cancelled.' };
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [BULK_COLUMNS.map(c => c.header).join(',')]; rows.map(bulkExportRow).forEach(r => lines.push(BULK_COLUMNS.map(c => esc(r[c.key])).join(',')));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8'); return { ok: true, message: `Exported ${rows.length} row(s) to ${filePath}` };
});
