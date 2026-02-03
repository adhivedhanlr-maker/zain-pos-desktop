import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Printer, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { db } from '../lib/db';
import { barcodeService } from '../services/barcode.service';

import { StickerPrintModal } from '../components/ui/StickerPrintModal';
import { Skeleton } from '../components/ui/Skeleton';

export const Products: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [showStickerModal, setShowStickerModal] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        name: '',
        categoryId: '',
        hsn: '',
        taxRate: 5,
        barcode: '',
        variants: [
            {
                sku: '',
                size: '',
                color: '',
                mrp: 0,
                sellingPrice: 0,
                costPrice: 0,
                stock: 0,
                minStock: 5,
            },
        ],
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productsData, categoriesData] = await Promise.all([
                db.products.findMany({
                    include: {
                        category: true,
                        variants: true,
                    },
                }),
                db.categories.findMany({}),
            ]);
            setProducts(productsData);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingProduct) {
                // Update existing product
                await db.products.update({
                    where: { id: editingProduct.id },
                    data: {
                        name: formData.name,
                        categoryId: formData.categoryId,
                        hsn: formData.hsn,
                        taxRate: formData.taxRate,
                    },
                });

                // Update barcode of first variant if provided
                if (formData.barcode && editingProduct.variants.length > 0) {
                    await db.productVariants.update({
                        where: { id: editingProduct.variants[0].id },
                        data: { barcode: formData.barcode },
                    });
                }
            } else {
                // Create new product with variants
                await db.products.create({
                    data: {
                        name: formData.name,
                        categoryId: formData.categoryId,
                        hsn: formData.hsn,
                        taxRate: formData.taxRate,
                        variants: {
                            create: formData.variants.map((v) => ({
                                sku: v.sku || `SKU-${Date.now()}`,
                                barcode: barcodeService.generateBarcode(),
                                size: v.size,
                                color: v.color,
                                mrp: v.mrp,
                                sellingPrice: v.sellingPrice,
                                costPrice: v.costPrice,
                                stock: v.stock,
                                minStock: v.minStock,
                            })),
                        },
                    },
                });
            }

            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Failed to save product:', error);
            alert('Failed to save product');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            categoryId: '',
            hsn: '',
            taxRate: 5,
            barcode: '',
            variants: [
                {
                    sku: '',
                    size: '',
                    color: '',
                    mrp: 0,
                    sellingPrice: 0,
                    costPrice: 0,
                    stock: 0,
                    minStock: 5,
                },
            ],
        });
        setEditingProduct(null);
    };

    const handleDeleteProduct = async (product: any) => {
        if (!confirm(`Are you sure you want to delete "${product.name}"? This will also delete all variants and cannot be undone.`)) {
            return;
        }

        try {
            // Delete all variants first to avoid foreign key constraint errors
            await db.productVariants.deleteMany({
                where: { productId: product.id },
            });

            // Then delete the product
            await db.products.delete({
                where: { id: product.id },
            });

            loadData();
        } catch (error) {
            console.error('Failed to delete product:', error);
            alert('Failed to delete product. Error: ' + (error as Error).message);
        }
    };

    const handlePrintLabel = (variant: any, product: any) => {
        setSelectedVariant(variant);
        setSelectedProduct(product);
        setShowStickerModal(true);
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="pl-10"
                        />
                    </div>
                </div>
                <Button variant="primary" onClick={() => setShowModal(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Product
                </Button>
            </div>

            {/* Products Table */}
            <div className="card overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Sl No</th>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Variants</th>
                            <th>Total Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <tr key={index}>
                                    <td><Skeleton className="h-4 w-8" /></td>
                                    <td><Skeleton className="h-4 w-48" /></td>
                                    <td><Skeleton className="h-4 w-24" /></td>
                                    <td><Skeleton className="h-4 w-12" /></td>
                                    <td><Skeleton className="h-4 w-12" /></td>
                                    <td><Skeleton className="h-8 w-24" /></td>
                                </tr>
                            ))
                        ) : (
                            filteredProducts.map((product, index) => (
                                <tr key={product.id}>
                                    <td>{index + 1}</td>
                                    <td className="font-medium">{product.name}</td>
                                    <td>{product.category.name}</td>
                                    <td>{product.variants.length}</td>
                                    <td>
                                        {product.variants.reduce((sum: number, v: any) => sum + v.stock, 0)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingProduct(product);
                                                    setFormData({
                                                        name: product.name,
                                                        categoryId: product.categoryId,
                                                        hsn: product.hsn || '',
                                                        taxRate: product.taxRate,
                                                        barcode: product.variants[0]?.barcode || '',
                                                        variants: product.variants,
                                                    });
                                                    setShowModal(true);
                                                }}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            {product.variants.length > 0 && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handlePrintLabel(product.variants[0], product)}
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleDeleteProduct(product)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingProduct ? 'Edit Product' : 'Add New Product'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Product Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <Select
                        label="Category"
                        value={formData.categoryId}
                        onChange={(e) =>
                            setFormData({ ...formData, categoryId: e.target.value })
                        }
                        options={[
                            { value: '', label: 'Select Category' },
                            ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="HSN Code"
                            value={formData.hsn}
                            onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                        />
                        <Input
                            label="Tax Rate (%)"
                            type="number"
                            value={formData.taxRate}
                            onChange={(e) =>
                                setFormData({ ...formData, taxRate: parseFloat(e.target.value) })
                            }
                            step="0.01"
                            required
                        />
                    </div>

                    {editingProduct && (
                        <Input
                            label="Item Code / Barcode"
                            value={formData.barcode}
                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                            placeholder="Scan or enter barcode"
                        />
                    )}

                    {!editingProduct && (
                        <>
                            <h3 className="font-semibold mt-6">Variant Details</h3>
                            {formData.variants.map((variant, index) => (
                                <div key={index} className="p-4 border border-gray-200 dark:border-dark-border rounded-lg space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            label="Size"
                                            value={variant.size}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].size = e.target.value;
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                        />
                                        <Input
                                            label="Color"
                                            value={variant.color}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].color = e.target.value;
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input
                                            label="MRP"
                                            type="number"
                                            value={variant.mrp}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].mrp = parseFloat(e.target.value);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            step="0.01"
                                            required
                                        />
                                        <Input
                                            label="Selling Price"
                                            type="number"
                                            value={variant.sellingPrice}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].sellingPrice = parseFloat(e.target.value);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            step="0.01"
                                            required
                                        />
                                        <Input
                                            label="Cost Price"
                                            type="number"
                                            value={variant.costPrice}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].costPrice = parseFloat(e.target.value);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            label="Initial Stock"
                                            type="number"
                                            value={variant.stock}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].stock = parseInt(e.target.value);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            required
                                        />
                                        <Input
                                            label="Min Stock"
                                            type="number"
                                            value={variant.minStock}
                                            onChange={(e) => {
                                                const newVariants = [...formData.variants];
                                                newVariants[index].minStock = parseInt(e.target.value);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button type="submit" variant="primary" className="flex-1">
                            {editingProduct ? 'Update Product' : 'Create Product'}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Sticker Print Modal */}
            <StickerPrintModal
                isOpen={showStickerModal}
                onClose={() => {
                    setShowStickerModal(false);
                    setSelectedVariant(null);
                    setSelectedProduct(null);
                }}
                product={selectedProduct}
                variant={selectedVariant}
            />
        </div>
    );
};
