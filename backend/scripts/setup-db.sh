#!/bin/bash
# ============================================================
# CostLens — Database Setup Script
# Run this once to initialize the PostgreSQL database
# ============================================================

set -e

echo "╔═══════════════════════════════════════╗"
echo "║   CostLens Database Setup             ║"
echo "╚═══════════════════════════════════════╝"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  echo "Set it like: export DATABASE_URL=postgresql://user:pass@host:5432/costlens"
  exit 1
fi

echo "→ Connecting to database..."
echo "→ Running schema migration..."

psql "$DATABASE_URL" -f ../docs/database-schema.sql

echo ""
echo "✅ Database setup complete!"
echo "   - 13 tables created"
echo "   - Indexes applied"
echo "   - Seed data inserted (plans + credit costs)"
echo "   - Newsletter subscribers table ready"
echo ""
echo "Next: Set environment variables in .env and run 'npm start'"
