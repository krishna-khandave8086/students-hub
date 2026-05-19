const express = require('express');
const supabase = require('../supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const ADMIN_EMAIL = 'krishnakant.khandave_comp25@pccoer.in';

// Middleware to ensure user is admin
function requireAdmin(req, res, next) {
  if (req.user.student_id !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
}

// All admin routes require standard auth + admin auth
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users — Fetch all users
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('student_id, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(users);
  } catch (err) {
    console.error('Admin Fetch Users Error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// DELETE /api/admin/users/:email — Delete a user
router.delete('/users/:email', async (req, res) => {
  const targetEmail = req.params.email;
  if (targetEmail === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'Cannot delete the master admin.' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('student_id', targetEmail);

    if (error) throw error;
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin Delete User Error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// DELETE /api/admin/posts/:type/:id — Delete any post
router.delete('/posts/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const table = type === 'lost-found' ? 'lost_found' : 'marketplace';

  try {
    // Delete the post
    const { data: post, error: fetchError } = await supabase
      .from(table)
      .select('image_path')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete image if exists
    if (post && post.image_path) {
      const filePath = post.image_path.replace('https://btomaxaqtelnobiyfrrh.supabase.co/storage/v1/object/public/images/', '');
      await supabase.storage.from('images').remove([filePath]);
    }

    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ message: 'Post forcefully deleted.' });
  } catch (err) {
    console.error('Admin Delete Post Error:', err);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

module.exports = router;
