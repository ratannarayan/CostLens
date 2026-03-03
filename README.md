# CostLens — Complete Developer Handoff Package

**AI-Powered Procurement Intelligence Platform for Indian Manufacturing**

Version: 1.0 | March 2026 | Prepared by: Pratap Sahoo, Founder

---

## What is CostLens?

CostLens is a SaaS platform that helps procurement professionals at manufacturing companies analyze costs, generate AI-powered reports, and negotiate better with suppliers. It features:

- **13 Costing Modules** — Should-Cost, Tool/Die, TCO, Transportation, Packaging, etc.
- **8 AI Analysis Reports** — Spend Analysis, Supplier Scorecards, Price Variance, etc.
- **4 AI Commercial Tools** — Price Check, Contract Analyzer, RFQ Comparator, Negotiation Brief
- **22 Smart Action Emails** — AI-drafted emails from analysis results
- **10 Ebooks** — Procurement knowledge library with gated downloads
- **Newsletter** — "The Procurement Edge" subscriber system
- **Credit System** — Freemium model with 4 plans (Free, Pro ₹1999/mo, Team ₹4999/mo, Enterprise)

---

## Package Contents

```
CostLens-Developer-Handoff/
│
├── README.md                          ← YOU ARE HERE (start here)
├── .env.example                       ← All environment variables (25+)
│
├── frontend/
│   ├── cl-v10.html                    ← Standalone demo (open in browser)
│   ├── cl-v10.jsx                     ← Raw React source (3,073 lines)
│   ├── package.json                   ← Vite + React dependencies
│   ├── vite.config.js                 ← Dev server with API proxy
│   ├── index.html                     ← Vite entry HTML
│   ├── public/
│   │   └── favicon.svg                ← Browser favicon
│   └── src/
│       ├── main.jsx                   ← React entry point
│       └── App.jsx                    ← Full application (same as cl-v10.jsx)
│
├── backend/
│   ├── server.js                      ← Express entry point (11 route mounts)
│   ├── package.json                   ← Node.js dependencies
│   ├── config/
│   │   ├── database.js                ← Knex PostgreSQL connection
│   │   └── plans.js                   ← 4 plans, feature matrix, credit costs
│   ├── middleware/
│   │   ├── auth.js                    ← JWT verification (requireAuth, requirePlan)
│   │   └── credits.js                 ← Credit check + atomic deduction
│   ├── routes/
│   │   ├── auth.js                    ← Register, Login, Profile, Password
│   │   ├── tools.js                   ← 4 AI tools + Smart Actions (all prompts here)
│   │   ├── reports.js                 ← 8 AI reports + Smart Actions
│   │   ├── modules.js                 ← Save/load/list costing analyses
│   │   ├── credits.js                 ← Balance, history, usage stats
│   │   ├── payments.js                ← Razorpay subscribe/verify/webhook
│   │   ├── uploads.js                 ← S3 file upload with presigned URLs
│   │   ├── ebooks.js                  ← Ebook library with plan-gated downloads
│   │   ├── teams.js                   ← Team creation + member management
│   │   ├── analytics.js               ← Event tracking + dashboard stats
│   │   └── newsletter.js              ← Subscribe/unsubscribe/stats
│   ├── utils/
│   │   ├── ai.js                      ← Anthropic Claude API wrapper (multimodal)
│   │   └── logger.js                  ← Winston file + console logging
│   └── scripts/
│       └── setup-db.sh                ← One-command database setup
│
├── docs/
│   ├── database-schema.sql            ← Complete PostgreSQL schema (14 tables)
│   ├── api-specification.md           ← All API endpoints documented
│   ├── developer-guide.docx           ← 16-section implementation guide
│   └── startup-playbook.docx          ← 18-month launch roadmap
│
└── assets/
    └── logos/
        ├── logo-primary.svg           ← Full logo (dark background)
        ├── logo-white.svg             ← White variant (for dark backgrounds)
        ├── app-icon-512.svg           ← App icon 512×512
        ├── favicon.svg                ← Favicon 32×32
        └── all-concepts.html          ← All 5 logo concepts for reference
```

**Total: 38 files**

---

## Quick Start (15 minutes)

### Step 1: Database

```bash
# Create a PostgreSQL database (Supabase, Neon, or local)
createdb costlens

# Run the schema
psql costlens < docs/database-schema.sql
```

### Step 2: Backend

```bash
cd backend
cp ../.env.example .env           # Edit with your credentials
npm install
npm start                         # Runs on port 4000
```

### Step 3: Frontend (Development)

```bash
cd frontend
npm install
npm run dev                       # Runs on port 3000, proxies /api to :4000
```

### Step 4: Frontend (Standalone Demo)

Just open `frontend/cl-v10.html` in any browser. No server needed. All 13 modules work. AI features need backend.

---

## Environment Variables

Copy `.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random 64-char string for JWT signing |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (sk-ant-...) |
| `RAZORPAY_KEY_ID` | ✅ | Razorpay dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | ✅ | Razorpay secret |
| `AWS_ACCESS_KEY_ID` | ✅ | For S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | ✅ | For S3 file uploads |
| `AWS_S3_BUCKET` | ✅ | S3 bucket name |
| `AWS_REGION` | ✅ | e.g., ap-south-1 (Mumbai) |
| `CORS_ORIGINS` | ✅ | Frontend URL(s), comma-separated |
| `SMTP_HOST` | ⬜ | Email server (for password reset) |
| `SMTP_USER` | ⬜ | Email username |
| `SMTP_PASS` | ⬜ | Email password |
| `PORT` | ⬜ | Backend port (default: 4000) |
| `NODE_ENV` | ⬜ | production / development |

---

## Architecture

```
┌──────────────────────┐      ┌──────────────────────┐
│   Frontend (React)   │      │   PostgreSQL          │
│   Vite + React 18    │─────▶│   14 tables           │
│   Port 3000          │      │   Supabase / Neon     │
└──────────┬───────────┘      └──────────▲────────────┘
           │ /api/*                      │
           ▼                             │
┌──────────────────────┐      ┌──────────┴────────────┐
│   Backend (Express)  │─────▶│   External Services   │
│   Node.js + JWT      │      │   • Anthropic Claude  │
│   Port 4000          │      │   • Razorpay          │
└──────────────────────┘      │   • AWS S3            │
                              │   • SMTP Email        │
                              └───────────────────────┘
```

---

## Key Integration Points

### 1. Authentication (CRITICAL — Do First)

The frontend prototype uses `window.storage` (browser-only). Production must replace with:

**Frontend change:** In `App.jsx`, find every `dbGet`/`dbSet` call and replace with API calls:

```javascript
// BEFORE (prototype)
const sess = await dbGet("cl-session");

// AFTER (production)
const res = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('cl-token')}` }
});
const user = await res.json();
```

**Login flow:**
```javascript
// BEFORE
const users = await dbGet("cl-users") || {};

// AFTER
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user } = await res.json();
localStorage.setItem('cl-token', token);
```

### 2. AI Tools (CRITICAL — Security)

The prototype calls Anthropic API directly from the browser (exposes API key). Production MUST route through backend:

```javascript
// BEFORE (INSECURE — remove this)
const res = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'x-api-key': EXPOSED_KEY }
});

// AFTER (secure)
const res = await fetch('/api/tools/run/price-check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ fields, files, notes })
});
```

All AI prompts are already defined server-side in `routes/tools.js` and `routes/reports.js`.

### 3. Credits

```javascript
// BEFORE (local state)
setCredits(c => c - 1);

// AFTER (server-managed)
// Credits are deducted automatically when AI endpoint is called
// Fetch current balance:
const res = await fetch('/api/credits/balance', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { credits, plan } = await res.json();
```

### 4. Newsletter

Frontend form posts to: `POST /api/newsletter/subscribe` with `{ email, source: "website" }`

### 5. Payments (Razorpay)

Flow is documented in `routes/payments.js`:
1. Frontend calls `POST /api/payments/subscribe` with plan ID
2. Backend creates Razorpay order, returns order_id
3. Frontend opens Razorpay checkout widget
4. On success, frontend sends payment details to `POST /api/payments/verify`
5. Backend verifies signature, activates plan, allocates credits

---

## Database Tables (14 total)

| Table | Purpose |
|-------|---------|
| `users` | User accounts, plans, credits, billing |
| `sessions` | JWT refresh tokens |
| `module_analyses` | Saved costing module results |
| `report_analyses` | AI report results + file references |
| `tool_analyses` | AI tool results |
| `email_drafts` | Smart Action email history |
| `credit_transactions` | Credit deduction/refill ledger |
| `file_uploads` | S3 file metadata |
| `ebook_downloads` | Download tracking |
| `teams` | Team accounts |
| `team_members` | Team membership |
| `analytics_events` | User behavior tracking |
| `newsletter_subscribers` | "The Procurement Edge" subscribers |
| `plan_config` | Plan definitions (seed data) |
| `credit_costs` | Feature credit costs (seed data) |

---

## API Endpoints (42 total)

See `docs/api-specification.md` for full details. Summary:

| Group | Endpoints | Auth Required |
|-------|-----------|---------------|
| Auth | 7 (register, login, profile, password) | Mixed |
| Tools | 4 (run + email for each tool) | Yes |
| Reports | 4 (run + email for each report) | Yes |
| Modules | 5 (save, list, get, update, delete) | Yes |
| Credits | 3 (balance, history, stats) | Yes |
| Payments | 3 (subscribe, verify, webhook) | Mixed |
| Uploads | 2 (upload, download) | Yes |
| Ebooks | 2 (list, download) | Mixed |
| Teams | 3 (create, add member, list) | Yes |
| Analytics | 2 (track event, dashboard) | Yes |
| Newsletter | 3 (subscribe, unsubscribe, stats) | No |
| Health | 1 | No |

---

## Credit System

| Feature | Credits | Notes |
|---------|---------|-------|
| Price Check | 1 | Free tier gets 2 free checks |
| Contract Analyzer | 3 | |
| RFQ Comparator | 3 | |
| Negotiation Brief | 2 | |
| Spend Analysis Report | 3 | |
| Supplier Scorecard | 2 | |
| Price Variance | 2 | |
| All other reports | 2-3 | See `config/plans.js` |
| Smart Action Email | 1 | |
| Costing Modules | 0 | Always free |

Plans: Free (0 credits), Pro (50/mo), Team (50/mo × 5 users), Enterprise (custom)

---

## Deployment Options

### Option A: Railway (Quickest — 10 min)

```bash
# Backend
railway login
cd backend && railway up

# Frontend
cd frontend && npm run build
# Deploy dist/ to Vercel or Cloudflare Pages
```

### Option B: Vercel + Supabase (Simplest)

- Frontend → Vercel (free)
- Database → Supabase (free tier)
- Backend → Vercel Serverless Functions or Railway

### Option C: AWS (Production Scale)

- Frontend → CloudFront + S3
- Backend → ECS Fargate or EC2
- Database → RDS PostgreSQL
- Files → S3 (already configured)

### Option D: Firebase (Demo Only)

The `cl-v10.html` file works standalone:

```bash
mkdir costlens && cd costlens
firebase init hosting
cp frontend/cl-v10.html public/index.html
firebase deploy
# Live at: https://costlens.web.app
```

---

## Security Checklist

- [ ] API keys NEVER in frontend code
- [ ] JWT_SECRET is random 64+ characters
- [ ] bcrypt used for password hashing (12 rounds)
- [ ] CORS restricted to your frontend domain(s)
- [ ] Rate limiting active (100 req/15min general, 10 req/min AI)
- [ ] S3 bucket is private (presigned URLs for access)
- [ ] HTTPS enforced in production
- [ ] SQL injection prevented (Knex parameterized queries)
- [ ] File uploads validated (type + 25MB limit)
- [ ] Credit deduction is atomic (check → deduct → call AI)

---

## File Sizes

| Component | Files | Size |
|-----------|-------|------|
| Frontend JSX | 1 | 378 KB |
| Frontend HTML (standalone) | 1 | 379 KB |
| Backend routes | 11 | 46 KB |
| Backend config/middleware/utils | 6 | 14 KB |
| Database schema | 1 | 17 KB |
| Documentation | 4 | 82 KB |
| Logo assets | 5 | 19 KB |
| **Total** | **38** | **~935 KB** |

---

## Development Workflow

```
1. Developer reads this README
2. Developer reads docs/developer-guide.docx (detailed 16-section guide)
3. Set up PostgreSQL → run docs/database-schema.sql
4. Set up backend → npm install → configure .env → npm start
5. Set up frontend → npm install → npm run dev
6. Replace auth (dbGet/dbSet → /api/auth endpoints)
7. Replace AI calls (direct Anthropic → /api/tools and /api/reports)
8. Replace credits (local state → /api/credits)
9. Connect payments (Razorpay checkout flow)
10. Test end-to-end → Deploy
```

Estimated implementation time: **2-3 weeks** for a full-stack developer familiar with React + Node.js.

---

## Contact

For questions about the codebase, business logic, or procurement domain:

**Pratap Sahoo** — Founder, CostLens
#   C o s t L e n s  
 