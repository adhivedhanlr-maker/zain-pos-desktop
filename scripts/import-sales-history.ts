import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ImportStats {
    sales: number;
    saleItems: number;
    totalAmount: number;
    skippedSales: number;
    errors: string[];
}

interface SaleData {
    invoiceNo: string;
    invoiceDate: Date;
    items: Array<{
        code: string;
        itemName: string;
        qty: number;
        unitPrice: number;
        netAmt: number;
        taxAmt: number;
        totalAmt: number;
        taxRate: number;
    }>;
    grandTotal: number;
    discount: number;
}

function parseDate(dateStr: string): Date {
    // Format: "02-04-2025" (DD-MM-YYYY)
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
    }
    return new Date();
}

async function getAdminUser() {
    let admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });

    if (!admin) {
        // Create admin if doesn't exist
        admin = await prisma.user.findFirst();
    }

    return admin;
}

async function getNextBillNo(): Promise<number> {
    const lastSale = await prisma.sale.findFirst({
        orderBy: { billNo: 'desc' },
    });
    return lastSale ? lastSale.billNo + 1 : 1;
}

async function cleanupSales() {
    console.log('🧹 Cleaning up previous sales data...');
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    console.log('  ✓ Sales tables cleared');
}

const TYPO_FIXES: { [key: string]: string } = {
    'doubil': 'Double',
    'dubil': 'Double',
    'niker': 'Knicker',
    'nicer': 'Knicker',
    'barmuda': 'Bermuda',
    'sadha': 'Sadha',
    'pnt': 'Pant',
    'pant': 'Pant',
    'shrt': 'Shirt',
    'tshirt': 'T-Shirt',
    't-shirt': 'T-Shirt',
    'cotton': 'Cotton',
    'cottn': 'Cotton',
    'jeans': 'Jeans',
    'jean': 'Jeans',
};

function cleanName(name: string): string {
    if (!name) return '';
    let clean = name.replace(/\s+\d+\s*$/, '').trim(); // Remove price
    clean = clean.replace(/\s+/g, ' '); // Remove extra spaces

    const words = clean.toLowerCase().split(' ');
    const fixedWords = words.map(word => {
        if (TYPO_FIXES[word]) return TYPO_FIXES[word];
        return word.charAt(0).toUpperCase() + word.slice(1);
    });

    return fixedWords.join(' ');
}

async function findProductVariant(itemCode: string, itemName: string): Promise<any> {
    // Try to find by barcode/SKU first
    let variant = await prisma.productVariant.findFirst({
        where: {
            OR: [
                { barcode: itemCode },
                { sku: itemCode },
            ],
        },
        include: { product: true },
    });

    if (variant) return { ...variant, product: variant.product };

    // Try to match by CLEANED product name
    const exactCleanName = cleanName(itemName);

    // First try exact match on cleaned name
    let product = await prisma.product.findFirst({
        where: { name: exactCleanName },
        include: { variants: true },
    });

    // If failed, try contains/fuzzy (legacy fallback)
    if (!product) {
        const rawCleanName = itemName.replace(/\s+\d+\s*$/, '').trim();
        product = await prisma.product.findFirst({
            where: { name: { contains: rawCleanName } },
            include: { variants: true },
        });
    }

    if (product && product.variants.length > 0) {
        return { ...product.variants[0], product };
    }

    return null;
}

async function importSalesHistory(): Promise<ImportStats> {
    await cleanupSales();

    const stats: ImportStats = {
        sales: 0,
        saleItems: 0,
        totalAmount: 0,
        skippedSales: 0,
        errors: [],
    };

    const file = 'migration/Report_Sales_Detail.xls';
    console.log(`📖 Reading: ${file}`);

    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`  Total rows: ${rawData.length}`);
    console.log(`  Processing sales transactions...\n`);

    const admin = await getAdminUser();
    if (!admin) {
        throw new Error('No admin user found');
    }

    let currentBillNo = await getNextBillNo();
    let i = 0;

    while (i < rawData.length) {
        const row = rawData[i];

        // Look for invoice header
        if (row && row[7] === 'Invoice No/Date :' && row[9]) {
            try {
                // Parse invoice number and date
                const invoiceInfo = row[9].toString();
                const parts = invoiceInfo.split('/').map((p: string) => p.trim());

                if (parts.length < 2) {
                    i++;
                    continue;
                }

                const invoiceNo = parts[0];
                const invoiceDate = parseDate(parts[1]);

                // Find the header row (should be a few rows down)
                let headerRow = i + 1;
                while (headerRow < rawData.length && headerRow < i + 5) {
                    const hRow = rawData[headerRow];
                    if (hRow && hRow[0] === 'Sl. No' && hRow[2] === 'Item name') {
                        break;
                    }
                    headerRow++;
                }

                if (headerRow >= rawData.length || headerRow >= i + 5) {
                    i++;
                    continue;
                }

                // Collect sale items
                const items: SaleData['items'] = [];
                let itemRow = headerRow + 1;

                while (itemRow < rawData.length) {
                    const iRow = rawData[itemRow];

                    // Check if it's a total row or end of items
                    if (!iRow || iRow[0] === null || iRow[2] === 'Total' || iRow[2] === null) {
                        break;
                    }

                    // Parse item data
                    const code = iRow[1]?.toString().trim() || '';
                    const itemName = iRow[2]?.toString().trim() || '';
                    const taxRate = parseFloat(iRow[4]?.toString() || '0') || 0;
                    const qty = parseFloat(iRow[5]?.toString() || '0') || 0;
                    const unitPrice = parseFloat(iRow[6]?.toString() || '0') || 0;
                    const netAmt = parseFloat(iRow[7]?.toString() || '0') || 0;
                    const taxAmt = parseFloat(iRow[8]?.toString() || '0') || 0;
                    const totalAmt = parseFloat(iRow[9]?.toString() || '0') || 0;

                    if (itemName && qty > 0) {
                        items.push({
                            code,
                            itemName,
                            qty,
                            unitPrice,
                            netAmt,
                            taxAmt,
                            totalAmt,
                            taxRate,
                        });
                    }

                    itemRow++;
                }

                // Find grand total
                let grandTotal = 0;
                let discount = 0;
                let searchRow = itemRow;

                while (searchRow < rawData.length && searchRow < itemRow + 20) {
                    const sRow = rawData[searchRow];

                    // Stop if we hit the next invoice start
                    if (sRow && sRow[7] === 'Invoice No/Date :') {
                        break;
                    }

                    if (sRow && sRow[7] === 'Grand Total' && sRow[9]) {
                        grandTotal = parseFloat(sRow[9].toString()) || 0;
                        // We found the last valuable piece of info, but let's just mark this row
                        // and maybe continue slightly just in case, but usually this is the end.
                        searchRow++;
                        break; // Stop searching!
                    }

                    if (sRow && sRow[7] === 'Discount Amount' && sRow[9]) {
                        discount = parseFloat(sRow[9].toString()) || 0;
                    }

                    searchRow++;
                }

                // Create sale if we have items
                if (items.length > 0 && grandTotal > 0) {
                    try {
                        // Calculate totals
                        const subtotal = items.reduce((sum, item) => sum + item.netAmt, 0);
                        const totalTax = items.reduce((sum, item) => sum + item.taxAmt, 0);
                        const cgst = totalTax / 2;
                        const sgst = totalTax / 2;

                        // Create sale
                        const sale = await prisma.sale.create({
                            data: {
                                billNo: currentBillNo++,
                                userId: admin.id,
                                customerName: 'Walk-in Customer',
                                subtotal: subtotal,
                                discount: discount,
                                discountPercent: discount > 0 ? (discount / subtotal) * 100 : 0,
                                taxAmount: totalTax,
                                cgst: cgst,
                                sgst: sgst,
                                grandTotal: grandTotal,
                                paymentMethod: 'CASH',
                                paidAmount: grandTotal,
                                changeAmount: 0,
                                remarks: `Imported from MaxSell - Invoice #${invoiceNo}`,
                                createdAt: invoiceDate,
                                updatedAt: invoiceDate,
                            },
                        });

                        // Create sale items
                        for (const item of items) {
                            const variant = await findProductVariant(item.code, item.itemName);

                            if (variant) {
                                await prisma.saleItem.create({
                                    data: {
                                        saleId: sale.id,
                                        variantId: variant.id,
                                        productName: variant.product.name,
                                        variantInfo: variant.size !== 'Standard' ? `Size: ${variant.size}` : null,
                                        quantity: Math.round(item.qty),
                                        mrp: variant.mrp,
                                        sellingPrice: item.unitPrice,
                                        discount: 0,
                                        taxRate: item.taxRate,
                                        taxAmount: item.taxAmt,
                                        total: item.totalAmt,
                                        createdAt: invoiceDate,
                                    },
                                });
                                stats.saleItems++;
                            } else {
                                stats.errors.push(`Product not found: ${item.itemName} (${item.code})`);
                            }
                        }

                        stats.sales++;
                        stats.totalAmount += grandTotal;

                        if (stats.sales % 100 === 0) {
                            console.log(`  ✓ Imported ${stats.sales} sales...`);
                        }
                    } catch (error: any) {
                        stats.errors.push(`Error importing invoice ${invoiceNo}: ${error.message}`);
                    }
                }

                i = searchRow;
            } catch (error: any) {
                stats.errors.push(`Error parsing sale at row ${i}: ${error.message}`);
                i++;
            }
        } else {
            i++;
        }
    }

    return stats;
}

async function generateReport(stats: ImportStats): Promise<void> {
    const reportPath = path.join(__dirname, '../migration/sales-import-report.txt');
    const report = `
MaxSell Sales History Import Report
Generated: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORT SUMMARY:
  ✓ Sales Transactions: ${stats.sales}
  ✓ Sale Items: ${stats.saleItems}
  ✓ Total Revenue: ₹${stats.totalAmount.toFixed(2)}
  ✓ Average Sale: ₹${stats.sales > 0 ? (stats.totalAmount / stats.sales).toFixed(2) : 0}
  ⚠ Skipped Sales: ${stats.skippedSales}

${stats.errors.length > 0
            ? `
ERRORS (${stats.errors.length}):
${stats.errors.slice(0, 50).map((e, i) => `  ${i + 1}. ${e}`).join('\n')}
${stats.errors.length > 50 ? `  ... and ${stats.errors.length - 50} more errors` : ''}
`
            : '✓ No errors encountered'
        }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
1. Open the POS application
2. Go to Sales History page
3. Verify imported sales
4. Go to Reports page
5. View sales analytics and forecasting
6. Check Dashboard for insights

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);
    console.log(report);
}

async function main() {
    console.log('🚀 MaxSell Sales History Import');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⏳ This may take 10-15 minutes for large datasets...\n');

    try {
        const stats = await importSalesHistory();
        await generateReport(stats);

        console.log('\n✅ Sales import completed!');
        console.log('🎉 Your historical sales data is now available');
        console.log('📊 Check Reports page for analytics and insights');

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();
