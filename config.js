const config = {
    API_URL: process.env.NODE_ENV === 'production' 
        ? 'https://didactic-story-backend.onrender.com'
        : 'http://localhost:3000',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
};

module.exports = config; 