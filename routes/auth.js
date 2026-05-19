const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  // Check if student already exists
  const existing = db.prepare('SELECT id FROM users WHERE student_id = ?').get(student_id);
  if (existing) {
    return res.status(409).json({ error: 'This Student ID is already registered.' });
  }

  // Hash password and insert
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (student_id, password_hash) VALUES (?, ?)');
  stmt.run(student_id, hash);

  // Auto-login after registration
  const token = jwt.sign({ student_id }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    message: 'Registration successful!',
    token,
    student_id
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  if (!user) {
    return res.status(401).json({ error: 'Invalid Student ID or password.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid Student ID or password.' });
  }

  const token = jwt.sign({ student_id: user.student_id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    message: 'Login successful!',
    token,
    student_id: user.student_id
  });
});

module.exports = router;
