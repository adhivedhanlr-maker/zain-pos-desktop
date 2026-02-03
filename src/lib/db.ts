// Database service wrapper for Electron IPC
class DatabaseService {
    async query(model: string, method: string, args?: any) {
        const result = await window.electronAPI.db.query({ model, method, args });
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.data;
    }

    // User operations
    users = {
        findUnique: (args: any) => this.query('user', 'findUnique', args),
        findMany: (args?: any) => this.query('user', 'findMany', args),
        create: (args: any) => this.query('user', 'create', args),
        update: (args: any) => this.query('user', 'update', args),
        delete: (args: any) => this.query('user', 'delete', args),
    };

    // Product operations
    products = {
        findUnique: (args: any) => this.query('product', 'findUnique', args),
        findMany: (args?: any) => this.query('product', 'findMany', args),
        create: (args: any) => this.query('product', 'create', args),
        update: (args: any) => this.query('product', 'update', args),
        delete: (args: any) => this.query('product', 'delete', args),
    };

    // Product Variant operations
    productVariants = {
        findUnique: (args: any) => this.query('productVariant', 'findUnique', args),
        findMany: (args?: any) => this.query('productVariant', 'findMany', args),
        create: (args: any) => this.query('productVariant', 'create', args),
        update: (args: any) => this.query('productVariant', 'update', args),
        delete: (args: any) => this.query('productVariant', 'delete', args),
        deleteMany: (args: any) => this.query('productVariant', 'deleteMany', args),
    };

    // Category operations
    categories = {
        findUnique: (args: any) => this.query('category', 'findUnique', args),
        findMany: (args?: any) => this.query('category', 'findMany', args),
        create: (args: any) => this.query('category', 'create', args),
        update: (args: any) => this.query('category', 'update', args),
        delete: (args: any) => this.query('category', 'delete', args),
    };

    // Customer operations
    customers = {
        findUnique: (args: any) => this.query('customer', 'findUnique', args),
        findMany: (args?: any) => this.query('customer', 'findMany', args),
        create: (args: any) => this.query('customer', 'create', args),
        update: (args: any) => this.query('customer', 'update', args),
        delete: (args: any) => this.query('customer', 'delete', args),
    };

    // Sale operations
    sales = {
        findUnique: (args: any) => this.query('sale', 'findUnique', args),
        findMany: (args?: any) => this.query('sale', 'findMany', args),
        create: (args: any) => this.query('sale', 'create', args),
        update: (args: any) => this.query('sale', 'update', args),
        delete: (args: any) => this.query('sale', 'delete', args),
        aggregate: (args: any) => this.query('sale', 'aggregate', args),
        groupBy: (args: any) => this.query('sale', 'groupBy', args),
    };

    // Sale Item operations
    saleItems = {
        aggregate: (args: any) => this.query('saleItem', 'aggregate', args),
    };

    // Inventory operations
    inventoryMovements = {
        findMany: (args?: any) => this.query('inventoryMovement', 'findMany', args),
        create: (args: any) => this.query('inventoryMovement', 'create', args),
    };

    // Settings operations
    settings = {
        findUnique: (args: any) => this.query('setting', 'findUnique', args),
        findMany: (args?: any) => this.query('setting', 'findMany', args),
        upsert: (args: any) => this.query('setting', 'upsert', args),
    };
}

export const db = new DatabaseService();
