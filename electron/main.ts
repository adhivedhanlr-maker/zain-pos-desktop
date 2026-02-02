import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '../prisma/generated/client';

let prisma: PrismaClient;

function getDatabasePath() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        return path.join(process.cwd(), 'prisma', 'pos.db');
    }

    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'pos.db');

    // Legacy migration: check if DB exists in app root (old way) and move to AppData
    const legacyPath = path.join(process.resourcesPath || __dirname, '..', 'prisma', 'pos.db');
    const legacyPathAlt = path.join(process.cwd(), 'prisma', 'pos.db');

    if (!fs.existsSync(dbPath)) {
        if (fs.existsSync(legacyPath)) {
            try {
                fs.copyFileSync(legacyPath, dbPath);
                console.log('Migrated database from legacy path:', legacyPath);
            } catch (err) {
                console.error('Failed to migrate database:', err);
            }
        } else if (fs.existsSync(legacyPathAlt)) {
            try {
                fs.copyFileSync(legacyPathAlt, dbPath);
                console.log('Migrated database from local path:', legacyPathAlt);
            } catch (err) {
                console.error('Failed to migrate database:', err);
            }
        }
    }

    return dbPath;
}

function initializePrisma() {
    const dbPath = getDatabasePath();
    console.log('Initializing database at:', dbPath);

    prisma = new PrismaClient({
        datasources: {
            db: {
                url: `file:${dbPath}`
            }
        }
    });
}
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
    initializePrisma();
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
        width: 302,
        webPreferences: { nodeIntegration: true }
    });

    const htmlContent = typeof data === 'string' ? data : data.html;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve) => {
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: true,
                printBackground: true,
                margins: { marginType: 'none' }
            }, (success, failureReason) => {
                printWindow.close();
                if (!success) {
                    console.error('Print failed:', failureReason);
                    resolve({ success: false, error: failureReason });
                } else {
                    resolve({ success: true });
                }
            });
        });
    });
});

ipcMain.handle('print:label', async (_event, data) => {
    const printWindow = new BrowserWindow({ show: false });
    const htmlContent = data.html || data;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve) => {
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: true,
                printBackground: true,
                margins: { marginType: 'none' }
            }, (success, failureReason) => {
                printWindow.close();
                if (!success) {
                    console.error('Label print failed:', failureReason);
                    resolve({ success: false, error: failureReason });
                } else {
                    resolve({ success: true });
                }
            });
        });
    });
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
