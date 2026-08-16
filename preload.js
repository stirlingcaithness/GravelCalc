const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: record => ipcRenderer.invoke('history:add', record),
  deleteHistory: id => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  exportXlsx: () => ipcRenderer.invoke('export:xlsx'),
  importBulk: () => ipcRenderer.invoke('bulk:import'),
  downloadBulkTemplate: () => ipcRenderer.invoke('bulk:template'),
  exportBulkXlsx: rows => ipcRenderer.invoke('bulk:exportXlsx', rows),
  exportBulkCsv: rows => ipcRenderer.invoke('bulk:exportCsv', rows)
});
