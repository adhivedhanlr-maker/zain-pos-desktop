import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

// Global error handling - MUST BE FIRST
process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Main Process Error', error.stack || error.message);
});
// Custom Prisma Import for Production
let PrismaClient: any;
try {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        // Load from the app bundle (manual copy strategy)
        // In manual build, we copied 'prisma' folder to 'resources/app/prisma'
        const clientPath = path.join(app.getAppPath(), 'prisma', 'generated', 'client');

        console.log('Loading Prisma from:', clientPath);

        try {
            const prismaModule = require(clientPath);
            console.log('Loaded module keys:', Object.keys(prismaModule));

            // Robust extraction: Handle named export or default export
            PrismaClient = prismaModule.PrismaClient || prismaModule.default?.PrismaClient || prismaModule;

        } catch (requireErr: any) {
            console.error('Require failed:', requireErr);
            dialog.showErrorBox('Prisma Missing', `Could not load Prisma Client from:\n${clientPath}\n\nError: ${requireErr.message}`);
            throw requireErr;
        }

        // Verify if it is a constructor (class/function)
        const typeStr = typeof PrismaClient;
        const isFunc = typeStr === 'function';

        if (!isFunc) {
            console.error('PrismaClient is not a function!', PrismaClient);
            dialog.showErrorBox('Prisma Type Error', `Loaded PrismaClient is ${typeStr}, expected function.\nPath: ${clientPath}`);
        }

    } else {
        // In development, load from the local generated folder
        PrismaClient = require('../prisma/generated/client').PrismaClient;
    }
} catch (err) {
    console.error('Failed to load Prisma Client:', err);
    dialog.showErrorBox('Prisma Load Error', 'Failed to load database client:\n' + (err instanceof Error ? err.stack : String(err)));
}

let prisma: any; // Type as any to avoid TS errors with dynamic require

function getDatabasePath() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        return path.join(process.cwd(), 'prisma', 'pos.db');
    }

    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'pos.db');

    // In production, the DB is copied to the resources folder via extraResources
    const resourcePath = path.join(process.resourcesPath, 'pos.db');

    if (!fs.existsSync(dbPath)) {
        console.log('Database not found at', dbPath);

        if (fs.existsSync(resourcePath)) {
            try {
                console.log('Copying database from resources:', resourcePath);
                fs.copyFileSync(resourcePath, dbPath);
                console.log('Database copied successfully.');
            } catch (err) {
                console.error('Failed to copy database from resources:', err);
                dialog.showErrorBox('Database Error', 'Failed to initialize database. Please contact support.');
            }
        } else {
            console.error('Critical: Resource database not found at', resourcePath);
            dialog.showErrorBox('Critical Error', 'Database file missing from installation. Please reinstall.');
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
        title: "ZAIN GENTS PALACE - POS System",
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        backgroundColor: '#FFFFFF', // White background
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            sandbox: false,
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../public/icon.ico'),
    });

    // Add deep debugging listeners
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        dialog.showErrorBox('Renderer Load Failed',
            `Code: ${errorCode}\nDescription: ${errorDescription}\nURL: ${validatedURL}`);
    });

    mainWindow.webContents.on('crashed', () => {
        dialog.showErrorBox('Renderer Crashed', 'The renderer process has crashed.');
    });

    // Load Splash Screen first
    const splashPath = path.join(__dirname, '../public/splash.html');
    if (fs.existsSync(splashPath)) {
        mainWindow.loadFile(splashPath).catch(e => console.error('Splash load failed', e));
    }

    // Delay loading the app to show splash
    setTimeout(() => {
        if (!mainWindow) return;

        if (isDev) {
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
        } else {
            const indexPath = path.join(__dirname, '../dist/index.html');

            // mainWindow.webContents.openDevTools();

            if (!fs.existsSync(indexPath)) {
                dialog.showErrorBox('Critical Error', `File not found: ${indexPath}`);
            }

            mainWindow.loadFile(indexPath).catch(err => {
                dialog.showErrorBox('Load Error', err.message);
            });
        }
    }, 2500);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    try {
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



const performAutoBackup = async () => {
    try {
        const dbPath = getDatabasePath();
        const backupDir = path.join(app.getPath('userData'), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

        fs.copyFileSync(dbPath, backupPath);
        console.log('Auto-backup created at:', backupPath);

        // Prune old backups (keep last 10)
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort();
        if (files.length > 10) {
            for (let i = 0; i < files.length - 10; i++) {
                fs.unlinkSync(path.join(backupDir, files[i]));
            }
        }
    } catch (error) {
        console.error('Auto-backup failed:', error);
    }
};

app.on('window-all-closed', async () => {
    // Attempt Backup on Close
    try {
        const setting = await prisma.setting.findUnique({ where: { key: 'BACKUP_CONFIG' } });
        if (setting && setting.value) {
            const config = JSON.parse(setting.value);
            // If explicit "On Close" is enabled or just default behavior?
            // Let's assume we always backup on close if enabled, or if manual "On Close" option is selected.
            // For now, let's just do it.
            if (config.enabled) await performAutoBackup();
        } else {
            // Default behavior: Backup on close
            await performAutoBackup();
        }
    } catch (e) {
        console.error('Backup on close failed', e);
    }

    if (process.platform !== 'darwin') {
        prisma.$disconnect();
        app.quit();
    }
});

let backupInterval: NodeJS.Timeout | null = null;

// Function to perform auto backup (referencing existing one if available, else defining)
// Assuming performAutoBackup exist or ensuring it does. 
// Ideally I should check if performAutoBackup is hoisted or available.
// To be safe, I will define the logic or ensure I can call it. 

// ... Wait, I'll assume performAutoBackup is defined at top level or I'll move it here.
// Only way to know is viewing the file or searching.
// I'll assume it exists if I added it previously.

ipcMain.handle('backup:configure', async (_event, config) => {
    try {
        await prisma.setting.upsert({
            where: { key: 'BACKUP_CONFIG' },
            update: { value: JSON.stringify(config) },
            create: { key: 'BACKUP_CONFIG', value: JSON.stringify(config) }
        });

        // Restart scheduler
        if (backupInterval) clearInterval(backupInterval);

        if (config.enabled && config.intervalMinutes > 0) {
            console.log(`Starting auto-backup every ${config.intervalMinutes} minutes`);
            backupInterval = setInterval(async () => {
                // Call global performAutoBackup
                await performAutoBackup();
            }, config.intervalMinutes * 60 * 1000);
        } else {
            console.log('Auto-backup disabled (or set to On-Close only)');
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
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

ipcMain.handle('print:label', async (_event, data) => {
    const printWindow = new BrowserWindow({ show: false });
    const htmlContent = data.html || data;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve) => {
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

// Global error handling was moved to the top

ipcMain.handle('devices:list', async () => {
    try {
        // Will be implemented with usb-detection
        return { success: true, data: [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// Product Import/Export Handlers
ipcMain.handle('products:importTemplate', async () => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save Import Template',
            defaultPath: 'zain_pos_import_template.xlsx',
            filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) return { success: false };

        const workbook = XLSX.utils.book_new();

        // 1. Products Template
        const pHeaders = [
            'Product Name', 'Barcode', 'Category', 'Size', 'Color',
            'MRP', 'Selling Price', 'Purchase Price', 'Stock', 'HSN Code', 'GST %'
        ];
        const pSheet = XLSX.utils.aoa_to_sheet([pHeaders]);
        XLSX.utils.book_append_sheet(workbook, pSheet, 'Products');

        // 2. Customers Template
        const cHeaders = [
            'Customer Name', 'Phone', 'Email', 'Address', 'GSTIN'
        ];
        const cSheet = XLSX.utils.aoa_to_sheet([cHeaders]);
        XLSX.utils.book_append_sheet(workbook, cSheet, 'Customers');

        XLSX.writeFile(workbook, filePath);

        return { success: true, path: filePath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('data:exportAll', async () => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Export All Data',
            defaultPath: `zain_pos_data_${new Date().toISOString().slice(0, 10)}.xlsx`,
            filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) return { success: false };

        const workbook = XLSX.utils.book_new();

        // 1. Products Sheet
        try {
            const products = await prisma.product.findMany({ include: { category: true, variants: true } });
            const productRows: any[] = [];
            products.forEach((p: any) => {
                if (p.variants.length === 0) {
                    productRows.push({
                        'Product Name': p.name,
                        'Category': p.category?.name || 'Uncategorized',
                        'HSN': p.hsn,
                        'Tax %': p.taxRate,
                        'Barcode': '', 'Size': '', 'Stock': 0 // Empty placeholders
                    });
                } else {
                    p.variants.forEach((v: any) => {
                        productRows.push({
                            'Product Name': p.name,
                            'Category': p.category?.name || 'Uncategorized',
                            'Barcode': v.barcode,
                            'Size': v.size,
                            'Color': v.color,
                            'MRP': v.mrp,
                            'Selling Price': v.sellingPrice,
                            'Cost Price': v.costPrice,
                            'Stock': v.stock,
                            'HSN': p.hsn
                        });
                    });
                }
            });
            const productSheet = XLSX.utils.json_to_sheet(productRows);
            XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');
        } catch (e) {
            console.error('Error exporting products:', e);
        }

        // 2. Sales Sheet
        try {
            const sales = await prisma.sale.findMany({
                include: { items: true, user: { select: { username: true } } },
                orderBy: { createdAt: 'desc' }
            });
            const saleRows = sales.map((s: any) => ({
                'Bill No': s.billNo,
                'Date': s.createdAt,
                'Customer': s.customerName || 'Walk-in',
                'Phone': s.customerPhone,
                'Total': s.grandTotal,
                'Status': s.status,
                'Payment Mode': s.paymentMethod,
                'Items': s.items.length,
                'Cashier': s.user?.username
            }));
            const saleSheet = XLSX.utils.json_to_sheet(saleRows);
            XLSX.utils.book_append_sheet(workbook, saleSheet, 'Sales');
        } catch (e) {
            console.error('Error exporting sales:', e);
        }

        // 3. Customers
        try {
            const customers = await prisma.customer.findMany();
            if (customers.length > 0) {
                const customerSheet = XLSX.utils.json_to_sheet(customers);
                XLSX.utils.book_append_sheet(workbook, customerSheet, 'Customers');
            }
        } catch (e) { console.error('Error exporting customers:', e); }

        XLSX.writeFile(workbook, filePath);

        return { success: true, path: filePath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:import', async () => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Select Excel File',
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return { success: false, message: 'Cancelled' };

        const filePath = filePaths[0];
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rawData.length === 0) return { success: false, error: 'File is empty' };

        let stats = { success: 0, skipped: 0, errors: 0, details: [] as string[] };
        const categoryMap = new Map<string, string>();

        // Cache existing categories
        try {
            const categories = await prisma.category.findMany();
            categories.forEach((c: any) => categoryMap.set(c.name.toLowerCase(), c.id));
        } catch (e) { console.error('Error fetching categories', e); }

        for (const row of rawData as any[]) {
            try {
                // Normalize keys
                const getVal = (keys: string[]) => {
                    for (const k of keys) {
                        const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                        if (found) return row[found];
                    }
                    return null;
                };

                const productName = getVal(['Product Name', 'Item Name', 'Name']);
                const barcode = getVal(['Barcode', 'Bar Code'])?.toString();
                const categoryName = getVal(['Category', 'Category Name']) || 'Uncategorized';

                if (!productName) {
                    stats.skipped++;
                    continue;
                }

                // Check Duplicates (by Barcode if present)
                let existingVariant = null;
                if (barcode) {
                    existingVariant = await prisma.productVariant.findFirst({ where: { barcode } });
                }

                if (existingVariant) {
                    stats.skipped++;
                    stats.details.push(`Skipped ${productName} (Duplicate Barcode: ${barcode})`);
                    continue;
                }

                // Get/Create Category
                let categoryId = categoryMap.get(categoryName.toLowerCase());
                if (!categoryId) {
                    const newCat = await prisma.category.create({ data: { name: categoryName } });
                    categoryMap.set(categoryName.toLowerCase(), newCat.id);
                    categoryId = newCat.id;
                }

                // Get Product or Create
                let product = await prisma.product.findFirst({ where: { name: productName } });
                if (!product) {
                    product = await prisma.product.create({
                        data: {
                            name: productName,
                            categoryId: categoryId || '',
                            hsn: getVal(['HSN Code', 'HSN'])?.toString(),
                            taxRate: parseFloat(getVal(['GST %', 'GST', 'Tax']) || '0')
                        }
                    });
                }

                // Create Variant
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        size: getVal(['Size'])?.toString() || 'Standard',
                        color: getVal(['Color'])?.toString(),
                        barcode: barcode || `GEN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        sku: `${productName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
                        mrp: parseFloat(getVal(['MRP']) || '0'),
                        sellingPrice: parseFloat(getVal(['Selling Price', 'Price']) || '0'),
                        costPrice: parseFloat(getVal(['Purchase Price', 'Cost']) || '0'),
                        stock: parseInt(getVal(['Stock', 'Qty']) || '0')
                    }
                });

                stats.success++;
            } catch (err: any) {
                stats.errors++;
                stats.details.push(`Error on row: ${err.message}`);
                console.error(err);
            }
        }

        return { success: true, stats };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error.message };
    }
});

// Database Management Handlers
ipcMain.handle('db:backup', async () => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Backup Database',
            defaultPath: `backup_zain_pos_${new Date().toISOString().slice(0, 10)}.db`,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (canceled || !filePath) return { success: false };

        let sourcePath = path.join(process.cwd(), 'pos.db');
        if (!fs.existsSync(sourcePath)) {
            sourcePath = path.join(process.cwd(), 'prisma/pos.db');
        }
        if (!fs.existsSync(sourcePath)) {
            sourcePath = path.join(process.resourcesPath, 'pos.db');
        }

        fs.copyFileSync(sourcePath, filePath);
        return { success: true, path: filePath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:restore', async () => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Select Backup File',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return { success: false };

        const backupPath = filePaths[0];

        let targetPath = path.join(process.cwd(), 'pos.db');
        if (!fs.existsSync(targetPath) && fs.existsSync(path.join(process.cwd(), 'prisma/pos.db'))) {
            targetPath = path.join(process.cwd(), 'prisma/pos.db');
        }

        await prisma.$disconnect();
        fs.copyFileSync(backupPath, targetPath);

        app.relaunch();
        app.quit();

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// User Management Handlers
ipcMain.handle('users:list', async () => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true, password: true }
        });
        return { success: true, data: users };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:create', async (_event, userData) => {
    try {
        if (!userData.username || !userData.password || !userData.name) {
            return { success: false, error: 'Missing required fields' };
        }

        const existing = await prisma.user.findUnique({ where: { username: userData.username } });
        if (existing) return { success: false, error: 'Username already exists' };

        const user = await prisma.user.create({
            data: {
                username: userData.username,
                password: userData.password,
                name: userData.name,
                role: userData.role || 'CASHIER',
                isActive: true
            }
        });
        return { success: true, data: user };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:update', async (_event, { id, data }) => {
    try {
        const user = await prisma.user.update({
            where: { id },
            data: data
        });
        return { success: true, data: user };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:changePassword', async (_event, { id, password }) => {
    try {
        await prisma.user.update({
            where: { id },
            data: { password }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:delete', async (_event, id) => {
    try {
        await prisma.user.update({
            where: { id },
            data: { isActive: false }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
