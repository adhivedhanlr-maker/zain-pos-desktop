
import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Type, Image as ImageIcon, Layout, AlignLeft, AlignCenter, AlignRight, Bold, RotateCcw, CreditCard, Menu, DollarSign, Percent, Hash } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { db } from '../../lib/db';

// --- Types ---

export interface ReceiptBlock {
    id: string;
    type: 'logo' | 'text' | 'header' | 'bill_info' | 'divider' | 'items_table' | 'totals' | 'footer' | 'spacer' |
    'header_row_1' | 'shop_title' | 'shop_details' | 'user_line' | 'grand_total' | 'item_count' | 'amount_words' | 'tax_breakdown';
    content?: string;
    styles: {
        align?: 'left' | 'center' | 'right';
        fontSize?: number;
        bold?: boolean;
        marginTop?: number;
        marginBottom?: number;
    };
    visible: boolean;
}

const DEFAULT_LAYOUT: ReceiptBlock[] = [
    { id: '1', type: 'header_row_1', visible: true, styles: { fontSize: 10, bold: true } },
    { id: '2', type: 'shop_title', content: '{{shopName}}', visible: true, styles: { align: 'center', fontSize: 16, bold: true, marginTop: 5 } },
    { id: '3', type: 'shop_details', content: '{{address}}', visible: true, styles: { align: 'center', fontSize: 10 } },
    { id: '4', type: 'text', content: 'Phone : {{phone}}', visible: true, styles: { align: 'center', fontSize: 10 } },
    { id: '5', type: 'text', content: 'Tax Invoice', visible: true, styles: { align: 'center', fontSize: 11, bold: true, marginTop: 5 } },
    { id: '6', type: 'text', content: 'GSTIN : {{gstin}}', visible: true, styles: { align: 'center', fontSize: 10, bold: true } },
    { id: '7', type: 'user_line', visible: true, styles: { fontSize: 10, marginTop: 5, marginBottom: 5 } },
    { id: 'table_header_line', type: 'divider', visible: true, styles: { marginTop: 2, marginBottom: 2 } },
    { id: '8', type: 'items_table', visible: true, styles: { fontSize: 10 } },
    { id: 'table_footer_line', type: 'divider', visible: true, styles: { marginTop: 2, marginBottom: 2 } },
    { id: '9', type: 'grand_total', visible: true, styles: { fontSize: 14, bold: true, marginTop: 5, marginBottom: 5 } },
    { id: 'grand_total_line', type: 'divider', visible: true, styles: { marginTop: 2, marginBottom: 2 } },
    { id: '10', type: 'item_count', visible: true, styles: { align: 'center', fontSize: 10, marginTop: 5 } },
    { id: '11', type: 'amount_words', visible: true, styles: { fontSize: 10, marginTop: 5 } },
    { id: '12', type: 'tax_breakdown', visible: true, styles: { fontSize: 9, marginTop: 10 } },
    { id: '13', type: 'footer', content: 'Authorised Signatory', visible: true, styles: { align: 'right', fontSize: 10, marginTop: 20 } },
    { id: '14', type: 'text', content: 'Please check items before leaving the counter\nThank You', visible: true, styles: { align: 'center', fontSize: 9, marginTop: 10 } }
];

// --- Sortable Item Component ---
const SortableBlock = ({ block, onRemove, onEdit, isSelected }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={`bg-white dark:bg-gray-800 border p-3 rounded mb-2 flex items-center gap-3 ${isSelected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical className="w-5 h-5" />
            </div>

            <div className="flex-1 cursor-pointer" onClick={() => onEdit(block)}>
                <div className="flex items-center gap-2 mb-1">
                    {getBlockIcon(block.type)}
                    <span className="font-bold text-sm capitalize">{block.type.replace('_', ' ')}</span>
                    {!block.visible && <span className="text-xs bg-gray-100 text-gray-500 px-1 rounded">Hidden</span>}
                </div>
                {block.content && <div className="text-xs text-gray-500 truncate font-mono">{block.content}</div>}
            </div>

            <button onClick={() => onRemove(block.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
};

const getBlockIcon = (type: string) => {
    switch (type) {
        case 'logo': return <ImageIcon className="w-4 h-4 text-blue-500" />;
        case 'text': return <Type className="w-4 h-4 text-gray-500" />;
        case 'header_row_1': return <CreditCard className="w-4 h-4 text-purple-500" />;
        case 'shop_title':
        case 'shop_details': return <Type className="w-4 h-4 text-blue-600" />;
        case 'items_table': return <Menu className="w-4 h-4 text-orange-500" />;
        case 'grand_total': return <DollarSign className="w-4 h-4 text-green-600" />;
        case 'tax_breakdown': return <Percent className="w-4 h-4 text-red-500" />;
        case 'item_count': return <Hash className="w-4 h-4 text-gray-600" />;
        case 'amount_words': return <Type className="w-4 h-4 text-indigo-500" />;
        case 'divider': return <div className="w-4 border-b border-dashed border-gray-400" />;
        default: return <Layout className="w-4 h-4 text-gray-400" />;
    }
};

// --- Main Designer Component ---
export const ReceiptDesigner: React.FC = () => {
    const [blocks, setBlocks] = useState<ReceiptBlock[]>(DEFAULT_LAYOUT);
    const [selectedBlock, setSelectedBlock] = useState<ReceiptBlock | null>(null);
    const [saving, setSaving] = useState(false);
    const [shopDetails, setShopDetails] = useState({
        shopName: 'YOUR SHOP NAME',
        address: '123 Business Street, City',
        phone: '0000000000',
        gstin: 'GSTINPlaceholder'
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        loadLayout();
        loadShopDetails();
    }, []);

    const loadShopDetails = async () => {
        try {
            const result = await db.settings.findUnique({ where: { key: 'SHOP_SETTINGS' } });
            if (result && result.value) {
                const data = JSON.parse(result.value);
                setShopDetails(data);
            }
        } catch (error) {
            console.error("Failed to load shop settings", error);
        }
    };

    const loadLayout = async () => {
        try {
            const result = await db.settings.findUnique({ where: { key: 'RECEIPT_LAYOUT' } });
            if (result && result.value) {
                setBlocks(JSON.parse(result.value));
            }
        } catch (error) {
            console.error("Failed to load layout", error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await db.settings.upsert({
                where: { key: 'RECEIPT_LAYOUT' },
                create: { key: 'RECEIPT_LAYOUT', value: JSON.stringify(blocks) },
                update: { value: JSON.stringify(blocks) }
            });
            alert('Layout saved successfully!');
        } catch (error) {
            console.error('Failed to save layout:', error);
            alert('Failed to save layout');
        } finally {
            setSaving(false);
        }
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset to the default layout?')) {
            setBlocks(DEFAULT_LAYOUT);
            setSelectedBlock(null);
        }
    };

    const addBlock = (type: ReceiptBlock['type']) => {
        const newBlock: ReceiptBlock = {
            id: Date.now().toString(),
            type,
            content: type === 'text' ? 'New Text' : '',
            styles: { align: 'center', fontSize: 10, bold: false },
            visible: true
        };
        setBlocks([...blocks, newBlock]);
        setSelectedBlock(newBlock);
    };

    const updateSelectedBlock = (updates: Partial<ReceiptBlock> | Partial<ReceiptBlock['styles']>) => {
        if (!selectedBlock) return;
        let updatedBlock;
        if ('align' in updates || 'fontSize' in updates || 'bold' in updates || 'marginTop' in updates || 'marginBottom' in updates) {
            updatedBlock = { ...selectedBlock, styles: { ...selectedBlock.styles, ...updates } };
        } else {
            updatedBlock = { ...selectedBlock, ...updates };
        }
        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
    };

    const removeBlock = (id: string) => {
        setBlocks(blocks.filter(b => b.id !== id));
        if (selectedBlock?.id === id) setSelectedBlock(null);
    };

    // --- Unified Render Function to Prevent Doubling ---
    const renderBlockContent = (block: ReceiptBlock) => {
        switch (block.type) {
            case 'logo':
                return <div className="bg-gray-200 h-16 flex items-center justify-center text-xs text-gray-500 font-mono border border-dashed border-gray-400 mb-2">[LOGO]</div>;

            case 'header_row_1':
                return (
                    <div className="flex justify-between font-bold text-[10px] mb-1">
                        <span>Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Bill No: 1172</span>
                    </div>
                );

            case 'shop_title':
            case 'shop_details':
            case 'text':
                return (
                    <div className="whitespace-pre-line">
                        {block.content
                            ?.replace(/{{shopName}}/g, shopDetails.shopName || 'Shop Name')
                            .replace(/{{address}}/g, shopDetails.address || 'Address')
                            .replace(/{{phone}}/g, shopDetails.phone || 'Phone')
                            .replace(/{{gstin}}/g, shopDetails.gstin || 'GSTIN')}
                    </div>
                );

            case 'user_line':
                return <div className="text-[10px]">User : Administrator</div>;

            case 'divider':
                return <div className="border-t border-dashed border-black"></div>;

            case 'items_table':
                return (
                    <table className="w-full text-left text-[9px]">
                        <thead className="border-b border-black">
                            <tr>
                                <th className="text-left w-[40%]">Item Name</th>
                                <th className="text-right">Qty</th>
                                <th className="text-right">MRP</th>
                                <th className="text-right">Rate</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="font-bold">S K C Baniyan 135</td>
                                <td className="text-right">1.00</td>
                                <td className="text-right">0.00</td>
                                <td className="text-right">135.00</td>
                                <td className="text-right font-bold">135.00</td>
                            </tr>
                        </tbody>
                    </table>
                );

            case 'grand_total':
                return (
                    <div className="flex justify-between items-center py-1 border-t border-b border-dashed border-black">
                        <div className="font-bold text-sm">Grand Total</div>
                        <div className="font-bold text-lg">135.00</div>
                    </div>
                );

            case 'item_count':
                return <div className="text-center text-[10px]">Items : 1</div>;

            case 'amount_words':
                return <div className="font-medium text-[9px] italic">Rupees One Hundred Thirty Five only</div>;

            case 'tax_breakdown':
                return (
                    <div className="text-[8px]">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="border-t border-black">
                                    <th className="text-left">Tax Slab</th>
                                    <th>Basic</th>
                                    <th>CGST</th>
                                    <th>SGST</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody className="border-t border-black border-dashed">
                                <tr>
                                    <td className="text-left">GST @ 5.00%</td>
                                    <td>128.57</td>
                                    <td>3.21</td>
                                    <td>3.21</td>
                                    <td>135.00</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );

            case 'footer':
                return <div className="whitespace-pre-line text-[10px]">{block.content || 'Footer Text'}</div>;

            case 'spacer':
                return <div style={{ height: block.styles.marginTop || 20 }}></div>;

            default:
                return null;
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-4">
            {/* LEFT: Tools & Layers */}
            <div className="w-80 flex flex-col gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                    <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Add Elements</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" size="sm" onClick={() => addBlock('header_row_1')} className="justify-start"><CreditCard className="w-4 h-4 mr-2" /> Top Header</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('shop_title')} className="justify-start"><Type className="w-4 h-4 mr-2" /> Shop Title</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('shop_details')} className="justify-start"><Type className="w-4 h-4 mr-2" /> Shop Details</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('items_table')} className="justify-start"><Menu className="w-4 h-4 mr-2" /> Items Table</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('grand_total')} className="justify-start"><DollarSign className="w-4 h-4 mr-2" /> Grand Total</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('amount_words')} className="justify-start"><Type className="w-4 h-4 mr-2" /> Amt Words</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('tax_breakdown')} className="justify-start"><Percent className="w-4 h-4 mr-2" /> Tax Table</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('item_count')} className="justify-start"><Hash className="w-4 h-4 mr-2" /> Item Count</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('text')} className="justify-start"><Type className="w-4 h-4 mr-2" /> Text</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('divider')} className="justify-start"><div className="w-4 border-b border-dashed border-gray-500 mr-2"></div> Divider</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('logo')} className="justify-start"><ImageIcon className="w-4 h-4 mr-2" /> Logo</Button>
                        <Button variant="secondary" size="sm" onClick={() => addBlock('spacer')} className="justify-start"><div className="w-4 h-4 mr-2 border border-dashed border-gray-400"></div> Spacer</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Layers (Drag to Reorder)</h3>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={blocks} strategy={verticalListSortingStrategy}>
                                {blocks.map((block) => (
                                    <SortableBlock key={block.id} block={block} onRemove={removeBlock} onEdit={setSelectedBlock} isSelected={selectedBlock?.id === block.id} />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
            </div>

            {/* MIDDLE: Preview Canvas */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-900 flex justify-center p-8 overflow-y-auto">
                <div className="bg-white text-black shadow-lg w-[300px] min-h-[400px] p-4 flex flex-col" style={{ fontFamily: 'Courier New, monospace', fontSize: '12px', lineHeight: '1.2' }}>
                    {blocks.map(block => (
                        <div
                            key={block.id}
                            onClick={() => setSelectedBlock(block)}
                            className={`relative hover:outline hover:outline-1 hover:outline-blue-400 cursor-pointer ${selectedBlock?.id === block.id ? 'outline outline-2 outline-blue-500' : ''} ${!block.visible ? 'opacity-30' : ''}`}
                            style={{
                                textAlign: block.styles.align,
                                fontSize: block.styles.fontSize,
                                fontWeight: block.styles.bold ? 'bold' : 'normal',
                                marginTop: block.styles.marginTop,
                                marginBottom: block.styles.marginBottom,
                                display: block.visible ? 'block' : 'none'
                            }}
                        >
                            {renderBlockContent(block)}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Properties Panel */}
            <div className="w-72 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Properties</h3>
                    <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={handleReset} title="Reset to Default"><RotateCcw className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                    </div>
                </div>

                {selectedBlock ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Type: {selectedBlock.type}</label>
                        </div>

                        {(selectedBlock.type === 'text' || selectedBlock.type === 'footer' || selectedBlock.type === 'shop_title' || selectedBlock.type === 'shop_details') && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Content</label>
                                <textarea className="input w-full h-20 text-sm" value={selectedBlock.content} onChange={(e) => updateSelectedBlock({ content: e.target.value })} />
                                <p className="text-[10px] text-gray-400 mt-1">Shortcodes: {"{{shopName}}"}, {"{{address}}"}, {"{{phone}}"}, {"{{gstin}}"}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Align & Style</label>
                            <div className="flex bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-1">
                                <button onClick={() => updateSelectedBlock({ align: 'left' })} className={`flex-1 p-1 rounded ${selectedBlock.styles.align === 'left' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignLeft className="w-4 h-4 mx-auto" /></button>
                                <button onClick={() => updateSelectedBlock({ align: 'center' })} className={`flex-1 p-1 rounded ${selectedBlock.styles.align === 'center' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignCenter className="w-4 h-4 mx-auto" /></button>
                                <button onClick={() => updateSelectedBlock({ align: 'right' })} className={`flex-1 p-1 rounded ${selectedBlock.styles.align === 'right' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignRight className="w-4 h-4 mx-auto" /></button>
                                <button onClick={() => updateSelectedBlock({ bold: !selectedBlock.styles.bold })} className={`flex-1 p-1 rounded border-l ${selectedBlock.styles.bold ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Bold className="w-4 h-4 mx-auto" /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Size</label>
                                <Input type="number" value={selectedBlock.styles.fontSize} onChange={(e) => updateSelectedBlock({ fontSize: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Visible</label>
                                <div className="h-10 flex items-center"><input type="checkbox" checked={selectedBlock.visible} onChange={(e) => updateSelectedBlock({ visible: e.target.checked })} /></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Margin T</label>
                                <Input type="number" value={selectedBlock.styles.marginTop || 0} onChange={(e) => updateSelectedBlock({ marginTop: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Margin B</label>
                                <Input type="number" value={selectedBlock.styles.marginBottom || 0} onChange={(e) => updateSelectedBlock({ marginBottom: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 mt-10 italic text-sm">Select a block to edit</div>
                )}
            </div>
        </div>
    );
};
