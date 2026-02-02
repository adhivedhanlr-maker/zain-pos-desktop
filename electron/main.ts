import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Global error handling - MUST BE FIRST
process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Main Process Error', error.stack || error.message);
});
// Custom Prisma Import for Production
let PrismaClient: any;
try {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        // In production, load from the unpacked resources folder
        const clientPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'prisma', 'generated', 'client');
        PrismaClient = require(clientPath).PrismaClient;
    } else {
        // In development, load from the local generated folder
        PrismaClient = require('../prisma/generated/client').PrismaClient;
    }
} catch (err) {
    console.error('Failed to load Prisma Client:', err);
}

let prisma: any; // Type as any to avoid TS errors with dynamic require

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
        title: "!!! ZAIN POS FIXED V3 !!!",
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        backgroundColor: '#FFA500', // ORANGE BACKGROUND
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            sandbox: false,
        },
        autoHideMenuBar: true,
        icon: fs.existsSync(path.join(__dirname, '../public/icon.png'))
            ? path.join(__dirname, '../public/icon.png')
            : undefined,
    });

    // Add deep debugging listeners
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        dialog.showErrorBox('Renderer Load Failed',
            `Code: ${errorCode}\nDescription: ${errorDescription}\nURL: ${validatedURL}`);
    });

    mainWindow.webContents.on('crashed', () => {
        dialog.showErrorBox('Renderer Crashed', 'The renderer process has crashed.');
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');

        // Open DevTools BEFORE loading to catch early errors
        mainWindow.webContents.openDevTools();

        if (!fs.existsSync(indexPath)) {
            dialog.showErrorBox('Critical Error', `File not found: ${indexPath}`);
        }

        mainWindow.loadFile(indexPath).catch(err => {
            dialog.showErrorBox('Load Error', err.message);
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    try {
        // FORCE ALERT TO PROVE THIS CODE IS RUNNING
        dialog.showMessageBoxSync({
            type: 'info',
            title: 'Startup Verification',
            message: 'Zain POS v2 [DEBUG MODE] is now starting. If you do not see the login screen next, please check the dev tools on the right.',
            buttons: ['OK']
        });

        initializePrisma();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (err: any) {
        dialog.showErrorBox('Startup Error', err.stack || err.message);
    }
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

// Global error handling was moved to the top

ipcMain.handle('devices:list', async () => {
    try {
        // Will be implemented with usb-detection
        return { success: true, data: [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
