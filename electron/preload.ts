import { contextBridge, ipcRenderer } from 'electron';

const api = {
    // Database operations
    db: {
        query: (args: { model: string, method: string, args?: any }) =>
            ipcRenderer.invoke('db:query', args),
    },

    // Settings
    settings: {
        get: (key: string) => ipcRenderer.invoke('settings:get', key),
        set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    },

    // Sales
    sales: {
        getNextBillNo: () => ipcRenderer.invoke('sales:getNextBillNo'),
    },

    // Printing
    print: {
        receipt: (data: any) => ipcRenderer.invoke('print:receipt', data),
        label: (data: any) => ipcRenderer.invoke('print:label', data),
    },

    // Devices
    devices: {
        list: () => ipcRenderer.invoke('devices:list'),
    },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
