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
router.get('/', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('marketplace')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(listings);
  } catch (err) {
    console.error('Fetch MP Error:', err);
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// POST /api/marketplace — Create new listing (auth required)
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  const { type, product_name, condition, price, contact } = req.body;

  if (!type || !product_name || !condition || !price || !contact) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  let image_path = null;

  try {
    if (req.file) {
      // Upload to Supabase Storage
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `mp_${Date.now()}_${Math.round(Math.random() * 1000)}.${fileExt}`;
      
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

    const { data: newListing, error } = await supabase
      .from('marketplace')
      .insert([{
        user_id: req.user.student_id,
        type,
        product_name,
        condition,
        price,
        contact,
        image_path
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newListing);
  } catch (err) {
    console.error('Create MP Error:', err);
    res.status(500).json({ error: 'Failed to create listing.' });
  }
});

// DELETE /api/marketplace/:id — Delete own listing (auth required)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if listing exists and belongs to user
    const { data: listing, error: fetchError } = await supabase
      .from('marketplace')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.user_id !== req.user.student_id) {
      return res.status(403).json({ error: 'You can only delete your own listings.' });
    }

    // Delete image from storage if it exists
    if (listing.image_path) {
      const fileName = listing.image_path.split('/').pop();
      await supabase.storage.from('images').remove([fileName]);
    }

    // Delete from DB
    const { error: deleteError } = await supabase
      .from('marketplace')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({ message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error('Delete MP Error:', err);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

module.exports = router;
