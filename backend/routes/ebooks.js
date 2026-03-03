// ============================================================
// Ebooks Routes — List, Download (preview/full)
// ============================================================

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { canAccess } = require('../config/plans');
const db = require('../config/database');

// Ebook metadata (mirrors frontend EBOOKS array)
const EBOOKS = [
  { id: 'book-1', title: '100 Days Cost Reduction Program', pages: 85, previewFile: 'book-1-preview.pdf', fullFile: 'book-1-full.pdf' },
  { id: 'book-2', title: 'Category Management Playbook', pages: 72, previewFile: 'book-2-preview.pdf', fullFile: 'book-2-full.pdf' },
  { id: 'book-3', title: 'Procurement Approval Framework', pages: 64, previewFile: 'book-3-preview.pdf', fullFile: 'book-3-full.pdf' },
  { id: 'book-4', title: 'Vendor Negotiation Masterclass', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-5', title: 'Should-Cost Analysis Guide', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-6', title: 'Supplier Performance Management', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-7', title: 'Procurement KPIs & Dashboards', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-8', title: 'Strategic Sourcing Toolkit', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-9', title: 'Make vs Buy Decision Framework', pages: 0, previewFile: null, fullFile: null },
  { id: 'book-10', title: 'Procurement Digital Transformation', pages: 0, previewFile: null, fullFile: null },
];

// ─── LIST ALL EBOOKS ───
router.get('/', (req, res) => {
  res.json(EBOOKS.map(b => ({
    id: b.id,
    title: b.title,
    pages: b.pages,
    available: !!b.fullFile
  })));
});

// ─── DOWNLOAD (generates presigned URL) ───
router.get('/download/:bookId', requireAuth, async (req, res) => {
  const book = EBOOKS.find(b => b.id === req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const isFullAccess = canAccess(req.user.plan, 'ebookFull');
  const fileKey = isFullAccess ? book.fullFile : book.previewFile;
  
  if (!fileKey) {
    return res.status(404).json({ error: 'This ebook is not yet available' });
  }

  // TODO: Generate presigned S3 URL for the PDF
  // const url = await getPresignedUrl(S3_BUCKET, `ebooks/${fileKey}`, 3600);

  // Log download
  await db('ebook_downloads').insert({
    user_id: req.user.id,
    ebook_id: req.params.bookId,
    download_type: isFullAccess ? 'full' : 'preview'
  });

  // Placeholder — replace with actual presigned URL
  res.json({
    downloadUrl: `/static/ebooks/${fileKey}`,
    type: isFullAccess ? 'full' : 'preview',
    bookTitle: book.title
  });
});

module.exports = router;
