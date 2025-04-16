const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Create a Supabase client
const supabase = createClient(
    config.supabaseUrl,
    config.supabaseKey
);

module.exports = supabase; 