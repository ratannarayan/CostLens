# CostLens API Specification
## Version 1.0 | March 2026

Base URL: `https://api.costlens.in/api`  
Auth: Bearer JWT token in `Authorization` header

---

## Authentication

### POST /auth/register
```json
Request: { "email": "user@company.com", "password": "min8chars", "name": "Full Name", "company": "Company", "designation": "CPO", "industry": "Automotive" }
Response: { "token": "jwt...", "user": { "id", "email", "name", "plan": "free", "credits": 0, "freePriceChecks": 2 } }
```

### POST /auth/login
```json
Request: { "email": "user@company.com", "password": "password" }
Response: { "token": "jwt...", "user": { ... } }
```

### GET /auth/me (🔒 Auth Required)
```json
Response: { "id", "email", "name", "company", "plan", "credits", "freePriceChecks", "planDetails": { "name", "monthlyCredits", "features": {} } }
```

### PUT /auth/me (🔒)
```json
Request: { "name?", "company?", "designation?", "industry?" }
```

### POST /auth/change-password (🔒)
```json
Request: { "currentPassword", "newPassword" }
```

---

## AI Commercial Tools

### POST /tools/run/:toolId (🔒)
Tool IDs: `price-check` | `contract-analyzer` | `rfq-comparator` | `negotiation-brief`

```json
Request: {
  "fields": { "itemDesc": "CNC Housing", "material": "Aluminum 6061", ... },
  "files": [{ "base64": "...", "mimeType": "application/pdf", "name": "contract.pdf" }],
  "notes": "Optional additional context"
}
Response: { "result": { AI JSON response }, "analysisId": "uuid" }
```

Credit costs: price-check=1, contract-analyzer=3, rfq-comparator=3, negotiation-brief=2

**Price Check fields:** itemDesc, material, weight, process, supplierPrice, quantity, location  
**Negotiation Brief fields:** supplierName, items, currentSpend, contractType, objective, leverage, constraints, history  
**Contract Analyzer:** Upload PDF file(s)  
**RFQ Comparator:** Upload 2-5 quotation files  

### POST /tools/email/:toolId (🔒) — Smart Action Email
```json
Request: { "emailType": "price-reduction|cbs-request|amendment-request|award-letter|meeting-request|escalation", "result": { previous AI result }, "fields": { input fields } }
Response: { "email": { "subject": "...", "body": "..." } }
```
Cost: 1 credit per email

### GET /tools/history (🔒)
```json
Query: ?toolId=price-check&limit=20&offset=0
Response: [{ "id", "toolId", "inputData", "aiResult", "createdAt" }]
```

---

## Analysis Reports

### POST /reports/run/:reportId (🔒, Pro+)
Report IDs: `spend` | `price-variance` | `inventory-health` | `supplier-scorecard` | `category-opportunity` | `cost-reduction-tracker` | `savings-validation` | `supplier-risk`

```json
Request: { "mappedData": "cleaned CSV string", "dataSummary": "20 suppliers, 500 line items", "notes": "" }
Response: { "result": { "title", "executiveSummary", "keyMetrics", "findings", "riskAreas", "recommendations", "quickWins", "negotiationPoints" }, "reportId": "uuid" }
```

### POST /reports/email/:reportId (🔒) — Smart Action Email
```json
Request: { "emailType": "rpt-spend-consolidation|rpt-pv-correction|...", "result": { report result } }
Response: { "email": { "subject", "body" } }
```

### POST /reports/expert-request/:id (🔒)
Request expert human review. Triggers Razorpay payment flow.

### GET /reports/list (🔒)
### GET /reports/:id (🔒)

---

## Costing Modules

### POST /modules/save (🔒)
```json
Request: { "moduleId": "should-cost", "inputName": "CNC Housing v2", "inputData": { all form fields }, "resultData": { calculation result }, "resultValue": "₹240/pc" }
Response: { "id", ... }
```

### POST /modules/ai-extract (🔒, Pro+)
```json
Request: { "moduleId": "should-cost", "files": [{ "base64", "mimeType", "name" }], "prompt": "optional custom prompt" }
Response: { "extracted": { AI-extracted data } }
```
Cost: 1-2 credits

### GET /modules/list (🔒)
### GET /modules/:id (🔒)
### PATCH /modules/:id (🔒) — star, rename, notes
### DELETE /modules/:id (🔒)

---

## Credits

### GET /credits/balance (🔒)
```json
Response: { "credits": 42, "freePriceChecks": 1, "plan": "pro", "creditsResetAt": "2026-04-01" }
```

### GET /credits/history (🔒)
```json
Query: ?limit=50&offset=0&type=usage
Response: [{ "id", "type", "amount", "balanceAfter", "description", "createdAt" }]
```

### GET /credits/stats (🔒)
```json
Response: { "totalTransactions": 15, "totalCreditsUsed": 28, "toolUses": 8, "reportUses": 3 }
```

---

## Ebooks

### GET /ebooks/
Public. Returns list of all ebooks with availability.

### GET /ebooks/download/:bookId (🔒)
```json
Response: { "downloadUrl": "presigned-s3-url", "type": "preview|full", "bookTitle": "..." }
```
Free plan gets preview (first 10 pages). Pro+ gets full PDF.

---

## File Uploads

### POST /uploads/ (🔒)
Multipart form data. Field: `file`. Max 25MB.
Supported: PDF, PNG, JPG, XLSX, XLS, CSV
```json
Response: { "fileId": "uuid", "fileName": "quotation.pdf", "mimeType": "application/pdf", "size": 1234567 }
```

### GET /uploads/download/:fileId (🔒)
Returns presigned S3 download URL.

---

## Payments (Razorpay)

### POST /payments/subscribe (🔒)
```json
Request: { "planId": "pro", "billing": "monthly|annual" }
Response: { "orderId": "order_xxx", "amount": 199900, "currency": "INR", "keyId": "rzp_xxx" }
```

### POST /payments/verify (🔒)
```json
Request: { "razorpay_order_id", "razorpay_payment_id", "razorpay_signature", "planId", "billing" }
Response: { "message": "Plan activated", "plan": "pro", "credits": 50 }
```

### POST /payments/webhook
Razorpay server-to-server webhook for subscription events.

---

## Teams

### POST /teams/ (🔒, Team+ plan)
### POST /teams/:teamId/members (🔒)
### GET /teams/:teamId/members (🔒)
### DELETE /teams/:teamId/members/:userId (🔒)

---

## Analytics

### POST /analytics/event (Optional auth)
```json
Request: { "eventName": "module_opened", "eventData": { "moduleId": "should-cost" } }
```

### GET /analytics/dashboard (🔒)
```json
Response: { "totalAnalyses": 45, "totalReports": 8, "totalToolRuns": 12, "totalEmails": 5 }
```

---

## Error Responses

All errors follow format:
```json
{ "error": "Human-readable message", "required?": 3, "available?": 1 }
```

HTTP Status Codes:
- 400: Validation error
- 401: Auth required / invalid token
- 402: Insufficient credits
- 403: Plan upgrade required
- 404: Resource not found
- 429: Rate limit exceeded
- 500: Server error
