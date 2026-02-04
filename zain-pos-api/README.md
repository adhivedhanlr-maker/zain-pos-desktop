# Zain POS API

Backend API for Zain POS Mobile Dashboard

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and update values:
```bash
copy .env.example .env
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Start development server:
```bash
npm run dev
```

API will be available at `http://localhost:3001`

## Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password

### Sales
- `GET /api/sales/summary` - Today's sales summary
- `GET /api/sales/daily` - Daily sales (last 30 days)
- `GET /api/sales/hourly` - Hourly sales (today)

### Inventory
- `GET /api/inventory/products` - All products
- `GET /api/inventory/low-stock` - Low stock products

### Invoices
- `GET /api/invoices` - Recent invoices
- `GET /api/invoices/:id` - Invoice details

### Reports
- `GET /api/reports/revenue` - Revenue trends
- `GET /api/reports/top-products` - Top selling products

## Deployment

Deploy to Railway:
1. Push to GitHub
2. Connect to Railway
3. Set environment variables
4. Deploy automatically
