import { useEffect, useState } from 'react';
import { Package, AlertTriangle, Search } from 'lucide-react';
import api from '../lib/api';

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: {
        name: string;
    };
}

export default function Inventory() {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/inventory/products');
            setProducts(response.data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const lowStockCount = products.filter(p => p.stock <= 10).length;
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Inventory</h1>
                <p className="text-gray-600 mt-1">Manage your product stock levels</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Package className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Products</p>
                            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-50 rounded-lg">
                            <AlertTriangle className="text-red-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Low Stock Items</p>
                            <p className="text-2xl font-bold text-gray-900">{lowStockCount}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <Package className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Inventory Value</p>
                            <p className="text-2xl font-bold text-gray-900">₹{totalValue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="card">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="card hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                <p className="text-sm text-gray-600 mt-1">{product.category.name}</p>
                            </div>
                            {product.stock <= 10 && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                    Low Stock
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <div>
                                <p className="text-sm text-gray-600">Price</p>
                                <p className="text-lg font-bold text-gray-900">₹{product.price}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Stock</p>
                                <p className={`text-lg font-bold ${product.stock <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {product.stock}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                    <Package className="mx-auto text-gray-400" size={48} />
                    <p className="text-gray-600 mt-4">No products found</p>
                </div>
            )}
        </div>
    );
}
