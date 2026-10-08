const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  hide: () => ipcRenderer.invoke('desktop-pet:hide'),
});
