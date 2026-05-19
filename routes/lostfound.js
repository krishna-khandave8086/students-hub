const express = require('express');
const multer = require('multer');
const supabase = require('../supabase');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');

const router = express.Router();

// Use memory storage for multer since we upload directly to Supabase
const storage = multer.memoryStorage();
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
router.get('/', async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('lost_found')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(posts);
  } catch (err) {
    console.error('Fetch LF Error:', err);
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// GET /api/lost-found/user — Fetch posts by logged in user
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('lost_found')
      .select('*')
      .eq('user_id', req.user.student_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(posts);
  } catch (err) {
    console.error('Fetch User LF Error:', err);
    res.status(500).json({ error: 'Failed to fetch your posts.' });
  }
});

// POST /api/lost-found — Create new post (auth required)
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  const { type, item_name, location, details } = req.body;

  if (!type || !item_name || !location || !details) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  let image_path = null;

  try {
    if (req.file) {
      // Upload to Supabase Storage
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `lf_${Date.now()}_${Math.round(Math.random() * 1000)}.${fileExt}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);
        
      image_path = publicUrl;
    }

    const { data: newPost, error } = await supabase
      .from('lost_found')
      .insert([{
        user_id: req.user.student_id,
        type,
        item_name,
        location,
        details,
        image_path
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newPost);
  } catch (err) {
    console.error('Create LF Error:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// DELETE /api/lost-found/:id — Delete own post (auth required)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if post exists and belongs to user
    const { data: post, error: fetchError } = await supabase
      .from('lost_found')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.student_id) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }

    // Delete image from storage if it exists
    if (post.image_path) {
      // Extract filename from the URL (the last part of the path)
      const fileName = post.image_path.split('/').pop();
      await supabase.storage.from('images').remove([fileName]);
    }

    // Delete from DB
    const { error: deleteError } = await supabase
      .from('lost_found')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete LF Error:', err);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

module.exports = router;
