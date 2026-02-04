# Zain POS Mobile Dashboard

Mobile-responsive dashboard for monitoring Zain Gents Palace POS from anywhere.

## Features

- 📊 Real-time sales monitoring
- 📦 Inventory tracking
- 📋 Invoice management
- 📈 Analytics and reports
- 📱 Mobile-responsive design
- 🔐 Secure authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
VITE_API_URL=http://localhost:3001
```

3. Start development server:
```bash
npm run dev
```

Dashboard will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variable: `VITE_API_URL=https://your-api.railway.app`
4. Deploy

## Pages

- **Dashboard** - Sales overview with charts
- **Sales** - Detailed sales trends
- **Inventory** - Product stock levels
- **Invoices** - Customer invoices
- **Reports** - Analytics and insights

## Default Login

- Username: `admin`
- Password: `admin123`
