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
    const uniqueName = `lf_${Date.now()}_${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// GET /api/lost-found — Fetch all posts
router.get('/', (req, res) => {
  const posts = db.prepare('SELECT * FROM lost_found ORDER BY created_at DESC').all();
  res.json(posts);
});

// POST /api/lost-found — Create new post (auth required)
router.post('/', authenticateToken, upload.single('image'), (req, res) => {
  const { type, item_name, location, details } = req.body;

  if (!type || !item_name || !location || !details) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const image_path = req.file ? `/uploads/${req.file.filename}` : null;

  const stmt = db.prepare(
    'INSERT INTO lost_found (user_id, type, item_name, location, details, image_path) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(req.user.student_id, type, item_name, location, details, image_path);

  const newPost = db.prepare('SELECT * FROM lost_found WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newPost);
});

// DELETE /api/lost-found/:id — Delete own post (auth required)
router.delete('/:id', authenticateToken, (req, res) => {
  const post = db.prepare('SELECT * FROM lost_found WHERE id = ?').get(req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  if (post.user_id !== req.user.student_id) {
    return res.status(403).json({ error: 'You can only delete your own posts.' });
  }

  // Delete the image file if it exists
  if (post.image_path) {
    const imgPath = path.join(__dirname, '..', post.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM lost_found WHERE id = ?').run(req.params.id);
  res.json({ message: 'Post deleted successfully.' });
});

module.exports = router;
