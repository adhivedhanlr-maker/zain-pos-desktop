import React, { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ReceiptDesigner } from '../components/settings/ReceiptDesigner';
import { LabelDesigner } from '../components/settings/LabelDesigner';

export const Settings: React.FC = () => {
    const [shopSettings, setShopSettings] = useState({
        shopName: 'ZAIN GENTS PALACE',
        address: 'CHIRAMMAL TOWER, BEHIND CANARA BANK\nRAJA ROAD, NILESHWAR',
        phone: '9037106449, 7907026827',
        gstin: '32PVGPS0686J1ZV',
        email: '',
        logo: '',
    });

    const [printerSettings, setPrinterSettings] = useState({
        receiptPrinter: 'Epson TM-T82',
        labelPrinter: 'TSC TTP-244 Plus',
        pageSize: '80mm', // '80mm' | '58mm' | 'custom'
        contentWidth: 72, // mm
        fontFamily: 'sans-serif', // 'sans-serif' | 'monospace'
        fontSize: 12, // px
        isBold: false, // boolean
        showMRP: false, // Default hidden per user request
        showRate: false, // Default hidden per user request
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const result = await window.electronAPI.db.query({
                model: 'setting',
                method: 'findUnique',
                args: { where: { key: 'SHOP_SETTINGS' } }
            });
            if (result.success && result.data && result.data.value) {
                setShopSettings({ ...shopSettings, ...JSON.parse(result.data.value) });
            }

            // Load Printer Config (merged into shop settings for now to keep it simple, or separate key)
            // For now, let's try to load from a separate key PRINTER_CONFIG
            const printerResult = await window.electronAPI.db.query({
                model: 'setting',
                method: 'findUnique',
                args: { where: { key: 'PRINTER_CONFIG' } }
            });
            if (printerResult.success && printerResult.data && printerResult.data.value) {
                setPrinterSettings({ ...printerSettings, ...JSON.parse(printerResult.data.value) });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setShopSettings({ ...shopSettings, logo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveShopSettings = async () => {
        try {
            await window.electronAPI.db.query({
                model: 'setting',
                method: 'upsert',
                args: {
                    where: { key: 'SHOP_SETTINGS' },
                    update: { value: JSON.stringify(shopSettings) },
                    create: { key: 'SHOP_SETTINGS', value: JSON.stringify(shopSettings) }
                }
            });

            // Also save printer settings
            await window.electronAPI.db.query({
                model: 'setting',
                method: 'upsert',
                args: {
                    where: { key: 'PRINTER_CONFIG' },
                    update: { value: JSON.stringify(printerSettings) },
                    create: { key: 'PRINTER_CONFIG', value: JSON.stringify(printerSettings) }
                }
            });

            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        }
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <h3 className="text-xl font-bold mb-6">Shop Information</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="label">Shop Logo</label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="cursor-pointer"
                            />
                            <p className="text-xs text-gray-500 mt-1">Recommended: Square PNG/JPG, max 500KB</p>
                        </div>
                        {shopSettings.logo && (
                            <div className="relative w-20 h-20 border border-gray-200 rounded overflow-hidden">
                                <img src={shopSettings.logo} alt="Logo" className="w-full h-full object-contain" />
                                <button
                                    onClick={() => setShopSettings({ ...shopSettings, logo: '' })}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-80 hover:opacity-100"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <Input
                        label="Shop Name"
                        value={shopSettings.shopName}
                        onChange={(e) =>
                            setShopSettings({ ...shopSettings, shopName: e.target.value })
                        }
                    />
                    <div>
                        <label className="label">Address</label>
                        <textarea
                            value={shopSettings.address}
                            onChange={(e) =>
                                setShopSettings({ ...shopSettings, address: e.target.value })
                            }
                            className="input min-h-[100px]"
                        />
                    </div>
                    <Input
                        label="Phone Numbers"
                        value={shopSettings.phone}
                        onChange={(e) =>
                            setShopSettings({ ...shopSettings, phone: e.target.value })
                        }
                    />
                    <Input
                        label="GSTIN"
                        value={shopSettings.gstin}
                        onChange={(e) =>
                            setShopSettings({ ...shopSettings, gstin: e.target.value })
                        }
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={shopSettings.email}
                        onChange={(e) =>
                            setShopSettings({ ...shopSettings, email: e.target.value })
                        }
                    />
                    <Button variant="primary" onClick={handleSaveShopSettings}>
                        <Save className="w-5 h-5 mr-2" />
                        Save Shop Settings
                    </Button>
                </div>
            </div>

            <div className="card">
                <h3 className="text-xl font-bold mb-6">Printer Configuration</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Configure your printer names here.</p>
                    <Input
                        label="Receipt Printer (Epson)"
                        value={printerSettings.receiptPrinter}
                        onChange={(e) =>
                            setPrinterSettings({
                                ...printerSettings,
                                receiptPrinter: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Label Printer (TSC)"
                        value={printerSettings.labelPrinter}
                        onChange={(e) =>
                            setPrinterSettings({
                                ...printerSettings,
                                labelPrinter: e.target.value,
                            })
                        }
                    />
                </div>
            </div>

            {/* Receipt Designer */}
            <div className="card">
                <h3 className="text-xl font-bold mb-6">Receipt Template Designer</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Drag and drop elements to design your receipt. Click an item to edit its properties.
                    </p>
                    <ReceiptDesigner />
                </div>
            </div>

            {/* Label Designer */}
            <div className="card">
                <h3 className="text-xl font-bold mb-6">Label / Sticker Designer</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Design your barcode sticker (Standard: 50mm x 25mm). Drag items to reorder.
                    </p>
                    <LabelDesigner />
                </div>
            </div>

            <div className="card">
                <h3 className="text-xl font-bold mb-6">Database Management</h3>
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Backup and restore your database to prevent data loss.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="primary">Backup Database</Button>
                        <Button variant="secondary">Restore Database</Button>
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-xl font-bold mb-6">Thermal Printer Settings</h3>
                    <div className="space-y-6">

                        {/* Paper Size Selection */}
                        <div>
                            <label className="label">Paper Size</label>
                            <div className="flex gap-4 mb-2">
                                <button
                                    className={`px-4 py-2 rounded border ${printerSettings.pageSize === '80mm' ? 'bg-primary-50 border-primary-500 text-primary-700 font-bold' : 'bg-white border-gray-300'}`}
                                    onClick={() => setPrinterSettings({ ...printerSettings, pageSize: '80mm', contentWidth: 72 })}
                                >
                                    3 Inch (80mm)
                                </button>
                                <button
                                    className={`px-4 py-2 rounded border ${printerSettings.pageSize === '58mm' ? 'bg-primary-50 border-primary-500 text-primary-700 font-bold' : 'bg-white border-gray-300'}`}
                                    onClick={() => setPrinterSettings({ ...printerSettings, pageSize: '58mm', contentWidth: 48 })}
                                >
                                    2 Inch (58mm)
                                </button>
                                <button
                                    className={`px-4 py-2 rounded border ${printerSettings.pageSize === 'custom' ? 'bg-primary-50 border-primary-500 text-primary-700 font-bold' : 'bg-white border-gray-300'}`}
                                    onClick={() => setPrinterSettings({ ...printerSettings, pageSize: 'custom' })}
                                >
                                    Custom
                                </button>
                            </div>
                            {printerSettings.pageSize === 'custom' && (
                                <div className="flex items-center gap-2 max-w-xs">
                                    <span className="text-sm text-gray-500">Width (mm):</span>
                                    <Input
                                        type="number"
                                        value={printerSettings.contentWidth}
                                        onChange={(e) => setPrinterSettings({ ...printerSettings, contentWidth: parseInt(e.target.value) || 72 })}
                                    />
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Standard content width: 72mm for 80mm paper, 48mm for 58mm paper.</p>
                        </div>

                        {/* Font Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Font Style</label>
                                <select
                                    className="input"
                                    value={printerSettings.fontFamily}
                                    onChange={(e) => setPrinterSettings({ ...printerSettings, fontFamily: e.target.value })}
                                >
                                    <option value="sans-serif">Clean (Sans-Serif)</option>
                                    <option value="monospace">Classic (Courier/Dot Matrix)</option>
                                </select>
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer mt-6 select-none">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                        checked={printerSettings.isBold}
                                        onChange={(e) => setPrinterSettings({ ...printerSettings, isBold: e.target.checked })}
                                    />
                                    <span className="font-medium">Force Bold Text</span>
                                </label>
                            </div>
                        </div>

                        {/* Column Visibility */}
                        <div>
                            <label className="label">Table Columns</label>
                            <div className="flex gap-6 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                        checked={printerSettings.showMRP}
                                        onChange={(e) => setPrinterSettings({ ...printerSettings, showMRP: e.target.checked })}
                                    />
                                    <span className="font-medium">Show MRP</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                        checked={printerSettings.showRate}
                                        onChange={(e) => setPrinterSettings({ ...printerSettings, showRate: e.target.checked })}
                                    />
                                    <span className="font-medium">Show Rate</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button variant="primary" onClick={handleSaveShopSettings}>
                                <Save className="w-5 h-5 mr-2" />
                                Update Print Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
