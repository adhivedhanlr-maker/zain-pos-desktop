import * as XLSX from 'xlsx';
import * as fs from 'fs';

const file = 'migration/Report_Sales_Detail.xls';
const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read as array to see raw structure
const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

let output = '';
output += `File: ${file}\n`;
output += `Total rows: ${rawData.length}\n\n`;

output += 'First 30 rows (raw):\n';
for (let i = 0; i < Math.min(30, rawData.length); i++) {
    output += `\nRow ${i + 1}: ${JSON.stringify(rawData[i])}\n`;
}

fs.writeFileSync('migration/sales-raw.txt', output);
console.log('✅ Written to migration/sales-raw.txt');
