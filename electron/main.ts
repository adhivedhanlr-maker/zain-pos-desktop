import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../public/icon.png'),
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        prisma.$disconnect();
        app.quit();
    }
});

// IPC Handlers for database operations
ipcMain.handle('db:query', async (_event, { model, method, args }) => {
    try {
        const result = await (prisma as any)[model][method](args);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Database error:', error);
        return { success: false, error: error.message };
    }
});

// Settings
ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
        const setting = await prisma.setting.findUnique({ where: { key } });
        return { success: true, data: setting?.value };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    try {
        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        return { success: true, data: setting };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// Get next bill number
ipcMain.handle('sales:getNextBillNo', async () => {
    try {
        const lastSale = await prisma.sale.findFirst({
            orderBy: { billNo: 'desc' },
            select: { billNo: true },
        });
        return { success: true, data: (lastSale?.billNo || 0) + 1 };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// Print handlers
ipcMain.handle('print:receipt', async (_event, data) => {
    const printWindow = new BrowserWindow({
        show: false,
        width: 302, // 80mm approx
        webPreferences: { nodeIntegration: true }
    });

    // Data is now an object containing { html, printerName } or just html string
    const htmlContent = typeof data === 'string' ? data : data.html;
    // const printerName = data.printerName; // TODO: Implement specific printer selection

    // TODO: Select specific printer if printerName provided
    // For now leveraging synchronous window.print() in the page or silent print

    // We inject a script to print and close
    const htmlWithScript = htmlContent + `
        <script>
            window.onload = () => {
                window.print();
                setTimeout(() => { window.close(); }, 500); // Wait for print dialog/spool
            };
        </script>
    `;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlWithScript)}`);
    return { success: true };
});

ipcMain.handle('print:label', async (_event, data) => {
    const printWindow = new BrowserWindow({ show: false });

    // Data is { html } usually
    const htmlContent = data.html || data;

    const htmlWithScript = htmlContent + `
        <script>
             window.onload = () => {
                window.print();
                setTimeout(() => { window.close(); }, 500);
            };
        </script>
    `;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlWithScript)}`);
    return { success: true };
});

// USB device detection
ipcMain.handle('devices:list', async () => {
    try {
        // Will be implemented with usb-detection
        return { success: true, data: [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
