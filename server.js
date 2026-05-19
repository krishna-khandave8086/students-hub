const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Initialize database (creates tables if not exist)
require('./db');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lost-found', require('./routes/lostfound'));
app.use('/api/marketplace', require('./routes/marketplace'));

// Fallback to index.html for SPA
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (err.message === 'Only image files are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n  🏛️  Students Hub Server`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  🌐 Running at: http://localhost:${PORT}`);
  console.log(`  📁 Database:   students_hub.db`);
  console.log(`  📸 Uploads:    /uploads/`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
