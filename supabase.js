const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://btomaxaqtelnobiyfrrh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0b21heGFxdGVsbm9iaXlmcnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTAxMzgsImV4cCI6MjA5NDc4NjEzOH0.h5f2qf-xR_5jVN1O7T-EhQFmqvBBla7dpRcETF8wR00';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
