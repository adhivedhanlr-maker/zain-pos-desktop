import { format } from 'date-fns';
import { barcodeService } from './barcode.service';
import { ReceiptBlock } from '../components/settings/ReceiptDesigner';
import { LabelBlock } from '../components/settings/LabelDesigner';

interface ReceiptData {
  billNo: number | string;
  date: Date;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  gstin: string;
  logo?: string; // Add optional logo
  customerName?: string;
  items: Array<{
    name: string;
    variantInfo?: string;
    quantity: number;
    mrp: number;
    rate: number;
    discount?: number;
    taxRate?: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paymentMethod: string;
  paidAmount: number;
  changeAmount: number;
  userName: string;
}

interface LabelData {
  shopName: string;
  productName: string;
  barcode: string;
  productCode: string;
  price: number;
}

export const printService = {
  async printReceipt(data: ReceiptData) {
    try {
      // 1. Fetch Layout JSON
      const result = await window.electronAPI.db.query({
        model: 'setting',
        method: 'findUnique',
        args: { where: { key: 'RECEIPT_LAYOUT' } }
      });

      // Parse layout or use default
      let blocks: ReceiptBlock[] = [];
      if (result.success && result.data && result.data.value) {
        blocks = JSON.parse(result.data.value);
      } else {
        // Default Layout Fallback (Tax Invoice Standard)
        blocks = [
          { id: '1', type: 'header', content: 'TAX INVOICE', styles: { align: 'center', fontSize: 14, bold: true, marginBottom: 5 }, visible: true },
          { id: '2', type: 'text', content: '{{shopName}}', styles: { align: 'center', fontSize: 16, bold: true }, visible: true },
          { id: '3', type: 'text', content: '{{address}}\nPh: {{phone}}\nGSTIN: {{gstin}}', styles: { align: 'center', fontSize: 10 }, visible: true },
          { id: '4', type: 'divider', styles: {}, visible: true },
          { id: '5', type: 'bill_info', styles: {}, visible: true },
          { id: '6', type: 'divider', styles: {}, visible: true },
          { id: '7', type: 'items_table', styles: {}, visible: true },
          { id: '8', type: 'divider', styles: {}, visible: true },
          { id: '9', type: 'totals', styles: { align: 'right' }, visible: true },
          { id: '10', type: 'divider', styles: {}, visible: true },
          { id: '11', type: 'footer', content: 'Thank You! Visit Again', styles: { align: 'center', fontSize: 10, marginBottom: 10 }, visible: true },
          { id: '12', type: 'text', content: 'Authorised Signatory', styles: { align: 'right', fontSize: 10, marginTop: 20 }, visible: true },
        ];
      }

      // 2. Generate HTML from Blocks
      let htmlContent = '';

      // Helper to parsing placeholders
      const processText = (text: string) => {
        let processed = text || '';
        const replacements: Record<string, string> = {
          '{{shopName}}': data.shopName || '',
          '{{address}}': data.shopAddress || '',
          '{{phone}}': data.shopPhone || '',
          '{{gstin}}': data.gstin || '',
          '{{billNo}}': data.billNo?.toString() || '',
          '{{date}}': data.date ? format(new Date(data.date), 'dd/MM/yyyy hh:mm a') : format(new Date(), 'dd/MM/yyyy hh:mm a'),
          '{{userName}}': data.userName || '',
        };
        for (const [key, value] of Object.entries(replacements)) {
          processed = processed.replace(new RegExp(key, 'g'), value);
        }
        return processed.replace(/\n/g, '<br>');
      };

      for (const block of blocks) {
        if (!block.visible) continue;

        const styleStr = `
                    text-align: ${block.styles.align || 'left'};
                    font-size: ${block.styles.fontSize || 12}px;
                    font-weight: ${block.styles.bold ? 'bold' : 'normal'};
                    margin-top: ${block.styles.marginTop || 0}px;
                    margin-bottom: ${block.styles.marginBottom || 0}px;
                    width: 100%;
                `;

        switch (block.type) {
          case 'logo':
            if (data.logo) {
              htmlContent += `<div style="${styleStr}"><img src="${data.logo}" style="max-width: 60%; height: auto;" /></div>`;
            }
            break;

          case 'text':
          case 'header':
          case 'footer':
            htmlContent += `<div style="${styleStr}">${processText(block.content || '')}</div>`;
            break;

          case 'divider':
            htmlContent += `<div style="border-top: 1px dashed #000; margin: 5px 0; ${styleStr}"></div>`;
            break;

          case 'spacer':
            htmlContent += `<div style="height: 20px; ${styleStr}"></div>`;
            break;

          case 'bill_info':
            htmlContent += `
                            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; ${styleStr}">
                                <div style="text-align: left;">
                                    <div>Bill No: ${data.billNo}</div>
                                    <div>Date: ${format(new Date(data.date), 'dd/MM/yyyy')}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div>Customer: ${data.customerName || 'Walk-in'}</div>
                                </div>
                            </div>
                        `;
            break;

          case 'items_table':
            // Generate detailed table rows
            const rows = data.items.map((item: any, index: number) => `
                            <tr>
                                <td style="text-align: center;">${index + 1}</td>
                                <td style="text-align: left;">
                                    ${item.name}
                                    ${item.variantInfo ? `<div style="font-size: 9px; color: #555;">${item.variantInfo}</div>` : ''}
                                </td>
                                <td style="text-align: right;">${item.quantity}</td>
                                <td style="text-align: right;">${item.mrp?.toFixed(2)}</td>
                                <td style="text-align: right;">${item.rate?.toFixed(2)}</td>
                                <td style="text-align: right;">${item.discount?.toFixed(2) || '0.00'}</td>
                                <td style="text-align: right; font-weight: bold;">${item.total.toFixed(2)}</td>
                            </tr>
                        `).join('');

            htmlContent += `
                            <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 10px;">
                                <thead>
                                    <tr style="border-bottom: 1px dashed #000;">
                                        <th align="center" style="width: 5%;">#</th>
                                        <th align="left" style="width: 35%;">Item</th>
                                        <th align="right" style="width: 10%;">Qty</th>
                                        <th align="right" style="width: 15%;">MRP</th>
                                        <th align="right" style="width: 15%;">Rate</th>
                                        <th align="right" style="width: 10%;">Dis</th>
                                        <th align="right" style="width: 10%;">Amt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        `;
            break;

          case 'totals':
            // Tax Breakdown Calculation
            // Assuming simple split for now if not provided, basically 50/50 of total tax
            const totalTax = (data.cgst || 0) + (data.sgst || 0);
            const basicAmt = (data.subtotal || 0) - totalTax; // Roughly approximate if not passed explicitly, but subtotal usually excludes tax in some systems, includes in others. Based on POS.tsx, subtotal is gross.
            // Actually POS.tsx: subtotal = getSubtotal() -> usually sum of prices.
            // tax = getTaxAmount() -> separate line.
            // Let's stick to what data we have.
            // The user asked for "Basic Amt", "CGST", "SGST", "Cess", "Total Amt".

            // Let's build a small summary block
            htmlContent += `
                            <div style="${styleStr}; font-size: 11px;">
                                <table style="width: 100%; font-size: inherit;">
                                    <tr><td align="right">Total Items:</td><td align="right" width="80">${data.items.length}</td></tr>
                                    <tr><td align="right">Basic Amt:</td><td align="right" width="80">${basicAmt.toFixed(2)}</td></tr>
                                    <tr><td align="right">Less Discount:</td><td align="right" width="80">${data.discount.toFixed(2)}</td></tr>
                                    <tr><td align="right">CGST:</td><td align="right" width="80">${(data.cgst || 0).toFixed(2)}</td></tr>
                                    <tr><td align="right">SGST:</td><td align="right" width="80">${(data.sgst || 0).toFixed(2)}</td></tr>
                                    <tr style="font-weight: bold; font-size: 14px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
                                        <td align="right" style="padding: 5px 0;">NET AMOUNT:</td>
                                        <td align="right" style="padding: 5px 0;">₹${data.grandTotal.toFixed(2)}</td>
                                    </tr>
                                    <tr><td align="right" style="padding-top: 5px;">Paid:</td><td align="right" style="padding-top: 5px;">${data.paidAmount?.toFixed(2) || '0.00'}</td></tr>
                                    <tr><td align="right">Change:</td><td align="right">${data.changeAmount?.toFixed(2) || '0.00'}</td></tr>
                                </table>
                            </div>
                        `;
            break;
        }
      }

      const finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        @page { margin: 0; size: 78mm auto; }
                        body { 
                            font-family: 'Courier New', monospace; 
                            width: 78mm; 
                            margin: 0; 
                            padding: 0; 
                            font-size: 12px; 
                            color: #000; 
                            overflow-x: hidden;
                        }
                        * { box-sizing: border-box; }
                    </style>
                </head>
                <body>${htmlContent}</body>
                </html>
            `;

      await window.electronAPI.ipcRenderer.invoke('print:receipt', { html: finalHtml });

    } catch (error) {
      console.error('Print service error:', error);
      await window.electronAPI.ipcRenderer.invoke('print:receipt', { html: `<h1>Error printing</h1><pre>${JSON.stringify(error)}</pre>` });
    }
  },

  async printLabel(data: LabelData, copies: number = 1): Promise<void> {
    try {
      // 1. Fetch Layout JSON
      const result = await window.electronAPI.db.query({
        model: 'setting',
        method: 'findUnique',
        args: { where: { key: 'LABEL_LAYOUT' } }
      });

      // Parse layout or use default
      let blocks: LabelBlock[] = [];
      if (result.success && result.data && result.data.value) {
        blocks = JSON.parse(result.data.value);
      } else {
        blocks = [
          { id: '1', type: 'shop_name', styles: { align: 'left', fontSize: 10, bold: true, marginBottom: 0 }, visible: true },
          { id: '2', type: 'product_name', styles: { align: 'left', fontSize: 8, marginBottom: 2 }, visible: true },
          { id: '3', type: 'barcode', styles: { align: 'left', height: 40, marginBottom: 0 }, visible: true },
          { id: '4', type: 'text', content: '4649350', styles: { align: 'left', fontSize: 8, marginBottom: 0 }, visible: true },
          { id: '5', type: 'price', styles: { align: 'left', fontSize: 12, bold: true, marginBottom: 0 }, visible: true },
        ];
      }

      const barcodeImage = barcodeService.generateBarcodeImage(data.barcode);

      let htmlContent = '';
      for (const block of blocks) {
        if (!block.visible) continue;

        const styleStr = `
                    text-align: ${block.styles.align || 'center'};
                    font-size: ${block.styles.fontSize || 10}pt;
                    font-weight: ${block.styles.bold ? 'bold' : 'normal'};
                    margin-top: ${block.styles.marginTop || 0}px;
                    margin-bottom: ${block.styles.marginBottom || 0}px;
                    line-height: 1.1;
                `;

        switch (block.type) {
          case 'shop_name':
            htmlContent += `<div style="${styleStr}">${block.content || data.shopName}</div>`;
            break;
          case 'product_name':
            htmlContent += `<div style="${styleStr}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${block.content || data.productName}</div>`;
            break;
          case 'price':
            htmlContent += `<div style="${styleStr}">Rs. ${data.price}</div>`;
            break;
          case 'product_code':
            htmlContent += `<div style="${styleStr}">${data.productCode}</div>`;
            break;
          case 'text':
            htmlContent += `<div style="${styleStr}">${block.content || ''}</div>`;
            break;
          case 'barcode':
            htmlContent += `<div style="${styleStr}"><img src="${barcodeImage}" style="height: ${block.styles.height || 30}px; max-width: 100%;"></div>`;
            break;
          case 'meta_row':
            htmlContent += `
                            <div style="display: flex; justify-content: space-between; ${styleStr}">
                                <span>${data.productCode}</span>
                                <span>Rs. ${data.price}</span>
                            </div>
                         `;
            break;
          case 'divider':
            htmlContent += `<div style="border-top: 1px dashed black; margin: 2px 0;"></div>`;
            break;
          case 'spacer':
            htmlContent += `<div style="height: ${block.styles.height || 5}px;"></div>`;
            break;
        }
      }

      let html = `
                <html>
                <body style="font-family: Arial, sans-serif; width: 50mm; height: 25mm; margin: 0; padding: 1mm; box-sizing: border-box; overflow: hidden;">
                    ${htmlContent}
                </body>
                </html>`;

      for (let i = 0; i < copies; i++) {
        await window.electronAPI.ipcRenderer.invoke('print:label', { html });
        if (copies > 1) await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error('Print label error:', error);
    }
  }
};
