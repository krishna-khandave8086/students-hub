const express = require('express');
const supabase = require('../supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/conversations — Get list of users the current user has chatted with
router.get('/conversations', authenticateToken, async (req, res) => {
  const userId = req.user.student_id;
  try {
    // Supabase doesn't easily support complex distinct queries via JS client for this,
    // so we fetch all messages where user is sender or receiver and extract unique contacts.
    const { data: messages, error } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const uniqueContacts = new Set();
    messages.forEach(msg => {
      if (msg.sender_id !== userId) uniqueContacts.add(msg.sender_id);
      if (msg.receiver_id !== userId) uniqueContacts.add(msg.receiver_id);
    });

    res.json(Array.from(uniqueContacts));
  } catch (err) {
    console.error('Fetch Conversations Error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// GET /api/messages/:otherUser — Get chat history with a specific user
router.get('/:otherUser', authenticateToken, async (req, res) => {
  const userId = req.user.student_id;
  const otherUser = req.params.otherUser;

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUser}),and(sender_id.eq.${otherUser},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(messages);
  } catch (err) {
    console.error('Fetch Messages Error:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// POST /api/messages — Send a message
router.post('/', authenticateToken, async (req, res) => {
  const senderId = req.user.student_id;
  const { receiver_id, content } = req.body;

  if (!receiver_id || !content) {
    return res.status(400).json({ error: 'Receiver and content are required.' });
  }

  try {
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: senderId,
        receiver_id,
        content
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newMessage);
  } catch (err) {
    console.error('Send Message Error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
