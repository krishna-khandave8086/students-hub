const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `mp_${Date.now()}_${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// GET /api/marketplace — Fetch all listings
router.get('/', (req, res) => {
  const listings = db.prepare('SELECT * FROM marketplace ORDER BY created_at DESC').all();
  res.json(listings);
});

// POST /api/marketplace — Create new listing (auth required)
router.post('/', authenticateToken, upload.single('image'), (req, res) => {
  const { type, product_name, condition, price, contact } = req.body;

  if (!type || !product_name || !condition || !price || !contact) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const image_path = req.file ? `/uploads/${req.file.filename}` : null;

  const stmt = db.prepare(
    'INSERT INTO marketplace (user_id, type, product_name, condition, price, contact, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(req.user.student_id, type, product_name, condition, price, contact, image_path);

  const newListing = db.prepare('SELECT * FROM marketplace WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newListing);
});

// DELETE /api/marketplace/:id — Delete own listing (auth required)
router.delete('/:id', authenticateToken, (req, res) => {
  const listing = db.prepare('SELECT * FROM marketplace WHERE id = ?').get(req.params.id);

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found.' });
  }

  if (listing.user_id !== req.user.student_id) {
    return res.status(403).json({ error: 'You can only delete your own listings.' });
  }

  // Delete the image file if it exists
  if (listing.image_path) {
    const imgPath = path.join(__dirname, '..', listing.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM marketplace WHERE id = ?').run(req.params.id);
  res.json({ message: 'Listing deleted successfully.' });
});

module.exports = router;
