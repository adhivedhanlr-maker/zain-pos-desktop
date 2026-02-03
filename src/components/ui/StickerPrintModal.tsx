import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Modal } from './Modal';
import { Button } from './Button';
import { formatIndianCurrency } from '../../lib/format';
import { db } from '../../lib/db';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';

// Copied from LabelDesigner.tsx to avoid complex imports
export interface LabelBlock {
    id: string;
    type: 'shop_name' | 'product_name' | 'price' | 'barcode' | 'product_code' | 'meta_row' | 'text' | 'divider' | 'spacer';
    content?: string;
    styles: {
        align?: 'left' | 'center' | 'right';
        fontSize?: number;
        bold?: boolean;
        marginTop?: number;
        marginBottom?: number;
        height?: number; // for barcode height or spacer
    };
    visible: boolean;
}

const DEFAULT_LABEL_LAYOUT: LabelBlock[] = [
    { id: '1', type: 'shop_name', styles: { align: 'left', fontSize: 10, bold: true, marginBottom: 0 }, visible: true },
    { id: '2', type: 'product_name', styles: { align: 'left', fontSize: 8, bold: false, marginBottom: 2 }, visible: true },
    { id: '3', type: 'barcode', styles: { align: 'left', height: 45, marginBottom: 0 }, visible: true },
    { id: '4', type: 'text', content: '4649350', styles: { align: 'left', fontSize: 8, bold: false, marginBottom: 0 }, visible: true },
    { id: '5', type: 'price', styles: { align: 'left', fontSize: 12, bold: true, marginBottom: 0 }, visible: true },
];

interface StickerPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    variant: any;
}

export const StickerPrintModal: React.FC<StickerPrintModalProps> = ({
    isOpen,
    onClose,
    product,
    variant,
}) => {
    const [quantity, setQuantity] = useState(1);
    const [layout, setLayout] = useState<LabelBlock[]>(DEFAULT_LABEL_LAYOUT);
    const [shopSettings, setShopSettings] = useState<any>({ shopName: 'Zain POS' });
    const [showConfig, setShowConfig] = useState(false);

    // Print Configuration State
    const [config, setConfig] = useState({
        width: 38,      // mm
        height: 25,     // mm
        perRow: 2,
        gapX: 4,        // mm
        gapY: 2,         // mm
        marginLeft: 4,
        marginTop: 1,
        contentScale: 100 // Percentage
    });




    useEffect(() => {
        if (isOpen) {
            loadSettings();
            // Try to load saved config from localStorage
            const savedConfig = localStorage.getItem('sticker_print_config');
            if (savedConfig) {
                try {
                    setConfig(JSON.parse(savedConfig));
                } catch (e) { console.error("Failed to parse saved config", e); }
            }
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const [layoutResult, shopResult] = await Promise.all([
                db.settings.findUnique({ where: { key: 'LABEL_LAYOUT' } }),
                db.settings.findUnique({ where: { key: 'SHOP_SETTINGS' } })
            ]);

            if (layoutResult && layoutResult.value) {
                setLayout(JSON.parse(layoutResult.value));
            }

            if (shopResult && shopResult.value) {
                setShopSettings(JSON.parse(shopResult.value));
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    // Save config when it changes
    const updateConfig = (newConfig: typeof config) => {
        setConfig(newConfig);
        localStorage.setItem('sticker_print_config', JSON.stringify(newConfig));
    };

    // Render barcode for preview
    useEffect(() => {
        if (isOpen && (variant?.barcode || variant?.sku) && layout.some(b => b.type === 'barcode' && b.visible)) {
            // Use setTimeout to ensure DOM is updated
            setTimeout(() => {
                try {
                    document.querySelectorAll('.preview-barcode').forEach((element) => {
                        JsBarcode(element, variant.barcode || variant.sku, {
                            format: 'CODE128',
                            width: 1.5,
                            height: 40,
                            displayValue: false,
                            fontSize: 10,
                            margin: 0
                        });
                    });
                } catch (error) {
                    console.error('Failed to generate barcode:', error);
                }
            }, 100);
        }
    }, [isOpen, variant, layout, config]);

    const renderBlockOnScreen = (block: LabelBlock) => {
        if (!block.visible) return null;

        const style: React.CSSProperties = {
            textAlign: block.styles.align,
            fontSize: `${block.styles.fontSize || 10}pt`, // Use pt to match print output
            fontWeight: block.styles.bold ? 'bold' : 'normal',
            marginTop: `${(block.styles.marginTop || 0)}px`,
            marginBottom: `${(block.styles.marginBottom || 0)}px`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        };

        switch (block.type) {
            case 'shop_name':
                return <div key={block.id} style={style}>{block.content || shopSettings.shopName}</div>;
            case 'product_name':
                return <div key={block.id} style={style}>{block.content || product.name}</div>;
            case 'price':
                return <div key={block.id} style={style}>{formatIndianCurrency(variant.mrp)}</div>;
            case 'barcode':
                return (
                    <div key={block.id} style={{ ...style, display: 'flex', justifyContent: block.styles.align || 'center' }}>
                        <svg className="preview-barcode" style={{ height: block.styles.height ? `${block.styles.height}px` : '40px', maxWidth: '100%' }}></svg>
                    </div>
                );
            case 'text':
                return <div key={block.id} style={style}>{block.content}</div>;
            case 'product_code':
                return <div key={block.id} style={style}>{variant.barcode || variant.sku}</div>;
            case 'meta_row':
                return (
                    <div key={block.id} style={{ ...style, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{variant.barcode || variant.sku}</span>
                        <span>{formatIndianCurrency(variant.sellingPrice)}</span>
                    </div>
                );
            case 'divider':
                return <div key={block.id} className="border-t border-black my-1" />;
            case 'spacer':
                return <div key={block.id} style={{ height: (block.styles.height || 10) }}></div>;
            default:
                return null;
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const stickersHTML = Array(quantity).fill(null).map((_, index) => {
            const blocksHTML = layout.map(block => {
                if (!block.visible) return '';

                const style = `
                    text-align: ${block.styles.align || 'center'};
                    font-size: ${block.styles.fontSize || 10}pt;
                    font-weight: ${block.styles.bold ? 'bold' : 'normal'};
                    margin-top: ${block.styles.marginTop || 0}px;
                    margin-bottom: ${block.styles.marginBottom || 0}px;
                    line-height: 1.1;
                    white-space: nowrap;
                    overflow: hidden;
                `;

                switch (block.type) {
                    case 'shop_name':
                        return `<div style="${style}">${block.content || shopSettings.shopName}</div>`;
                    case 'product_name':
                        return `<div style="${style}">${block.content || product.name}</div>`;
                    case 'price':
                        return `<div style="${style}">MRP: ${formatIndianCurrency(variant.mrp)}</div>`;
                    case 'barcode':
                        return `<div style="${style} display: flex; justify-content: ${block.styles.align || 'center'};">
                                    <svg id="barcode-${index}-${block.id}" class="barcode-svg" data-height="${block.styles.height || 30}"></svg>
                                </div>`;
                    case 'text':
                        return `<div style="${style}">${block.content}</div>`;
                    case 'product_code':
                        return `<div style="${style}">SKU: ${variant.sku}</div>`;
                    case 'meta_row':
                        return `<div style="${style} display: flex; justify-content: space-between;">
                                    <span>${variant.sku}</span>
                                    <span>${formatIndianCurrency(variant.sellingPrice)}</span>
                                </div>`;
                    case 'divider':
                        return `<div style="border-top: 1px solid black; margin: 2px 0;"></div>`;
                    case 'spacer':
                        return `<div style="height: ${block.styles.height || 10}px"></div>`;
                    default: return '';
                }
            }).join('');

            const isLastInRow = (index + 1) % config.perRow === 0;
            const marginRight = isLastInRow ? 0 : config.gapX;

            return `<div class="sticker" style="margin-right: ${marginRight}mm; margin-bottom: ${config.gapY}mm;">
                        <div class="content-wrapper">
                            ${blocksHTML}
                        </div>
                    </div>`;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Stickers - ${product.name}</title>
                <style>
                    @media print {
                        @page {
                            size: auto;
                            margin: 0mm;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                        }
                    }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding-left: ${config.marginLeft}mm;
                            padding-top: ${config.marginTop}mm;
                            width: ${(config.width + config.gapX) * config.perRow}mm;
                            font-size: 0; /* Remove whitespace between inline-block elements */
                        }
                    .sticker {
                        width: ${config.width}mm;
                        height: ${config.height}mm;
                        padding: 1mm; /* Reduced padding */
                        box-sizing: border-box;
                        display: inline-block;
                        vertical-align: top;
                        overflow: hidden;
                        /* border: 1px dashed #eee; */ /* Debug border removed for cleaner print */
                        flex-direction: column;
                        page-break-inside: avoid;
                    }
                    /* Restore font size for content */
                    .sticker > div {
                        font-size: 10pt; 
                    }
                    .content-wrapper {
                        transform: scale(${config.contentScale / 100});
                        transform-origin: top left;
                        width: ${100 * (100 / config.contentScale)}%;
                        height: ${100 * (100 / config.contentScale)}%;
                    }
                    .barcode-svg {
                        max-width: 100%;
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            </head>
            <body>
                ${stickersHTML}
                <script>
                    window.onload = function() {
                        // Generate barcodes for each sticker
                         document.querySelectorAll('.barcode-svg').forEach(svg => {
                             const height = svg.getAttribute('data-height');
                            JsBarcode(svg, '${variant.barcode || variant.sku}', {
                                format: 'CODE128',
                                width: 1.5,
                                height: parseInt(height) || 30,
                                displayValue: false,
                                fontSize: 10,
                                margin: 0
                            });
                         });
                        
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!product || !variant) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Product Sticker">
            <div className="space-y-4">

                {/* Print Configuration Toggle */}
                <div className="flex justify-between items-center cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded" onClick={() => setShowConfig(!showConfig)}>
                    <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span className="text-sm font-medium">Print Settings ({config.width}x{config.height}mm - {config.perRow} Up)</span>
                    </div>
                    {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>

                {/* Configuration Panel */}
                {showConfig && (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm mb-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">Sticker Width (mm)</label>
                            <input
                                type="number"
                                value={config.width}
                                onChange={(e) => updateConfig({ ...config, width: Number(e.target.value) })}
                                className="w-full px-2 py-1 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Sticker Height (mm)</label>
                            <input
                                type="number"
                                value={config.height}
                                onChange={(e) => updateConfig({ ...config, height: Number(e.target.value) })}
                                className="w-full px-2 py-1 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Stickers Per Row</label>
                            <input
                                type="number"
                                value={config.perRow}
                                onChange={(e) => updateConfig({ ...config, perRow: Number(e.target.value) })}
                                className="w-full px-2 py-1 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Gap Between (mm)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="X"
                                    value={config.gapX}
                                    onChange={(e) => updateConfig({ ...config, gapX: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border rounded"
                                />
                                <input
                                    type="number"
                                    placeholder="Y"
                                    value={config.gapY}
                                    onChange={(e) => updateConfig({ ...config, gapY: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border rounded"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Margins (L / T) (mm)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Left"
                                    value={config.marginLeft}
                                    onChange={(e) => updateConfig({ ...config, marginLeft: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border rounded"
                                />
                                <input
                                    type="number"
                                    placeholder="Top"
                                    value={config.marginTop}
                                    onChange={(e) => updateConfig({ ...config, marginTop: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border rounded"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Content Zoom (%)</label>
                            <input
                                type="number"
                                value={config.contentScale}
                                onChange={(e) => updateConfig({ ...config, contentScale: Number(e.target.value) })}
                                className="w-full px-2 py-1 border rounded"
                            />
                        </div>
                    </div>
                )}

                {/* Preview */}
                <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-hidden">
                    <div className="flex flex-wrap" style={{ width: `${(config.width + config.gapX) * config.perRow}mm`, maxWidth: '100%' }}>
                        {/* Show just enough stickers to visualize the row and gap */}
                        {Array.from({ length: Math.min(config.perRow * 2, 4) }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-dashed border-gray-400 overflow-hidden flex flex-col relative"
                                style={{
                                    width: `${config.width}mm`,
                                    height: `${config.height}mm`,
                                    marginRight: (i + 1) % config.perRow === 0 ? 0 : `${config.gapX}mm`,
                                    marginBottom: `${config.gapY}mm`,
                                    padding: '2mm',
                                    transform: 'scale(1)', // render 1:1 roughly
                                }}
                            >
                                <div className="absolute top-0 right-0 bg-gray-200 text-[8px] px-1 opacity-50">#{i + 1}</div>
                                {layout.map(block => renderBlockOnScreen(block))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quantity */}
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">Number of Stickers</label>
                    <input
                        type="number"
                        min="1"
                        max="100"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>

                {/* Info */}
                <div className="text-xs text-gray-500">
                    <p>Total Print Width: ~{Math.ceil((config.width + config.gapX) * config.perRow)}mm</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handlePrint}>
                        <PrinterIcon className="w-4 h-4 mr-2" />
                        Print {quantity} Sticker{quantity > 1 ? 's' : ''}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

function PrinterIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2-2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
        </svg>
    );
}
