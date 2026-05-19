const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ error: 'College Email and password are required.' });
  }

  if (!student_id.endsWith('@pccoer.in')) {
    return res.status(400).json({ error: 'Registration is restricted to official @pccoer.in emails only.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  try {
    // Check if student already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('student_id', student_id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'This Student ID is already registered.' });
    }

    // Hash password and insert
    const hash = bcrypt.hashSync(password, 10);
    
    const { error } = await supabase
      .from('users')
      .insert([{ student_id, password_hash: hash }]);

    if (error) throw error;

    // Auto-login after registration
    const token = jwt.sign({ student_id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful!',
      token,
      student_id
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required.' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('student_id', student_id)
      .single();

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
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', require('../middleware/auth').authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const student_id = req.user.student_id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('student_id', student_id)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const validPassword = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('student_id', student_id);

    if (error) throw error;

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;
