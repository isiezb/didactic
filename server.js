const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('./config');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS middleware
app.use((req, res, next) => {
    const allowedOrigins = [
        'http://localhost:8000',
        'https://didactic-story-frontend.onrender.com',
        'https://didactic-story-backend.onrender.com',
        'https://didactic-story.onrender.com',
        'https://didactic-story-generator.onrender.com'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve index.html for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// Test database connection
const testConnection = async () => {
    try {
        const { data, error } = await supabase.from('stories').select('count').limit(1);
        if (error) throw error;
        console.log('Database connection successful');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

// Run connection test on startup
testConnection();

// OpenRouter API configuration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Input validation function
const validateInputs = (inputs) => {
    const requiredFields = ['academic_grade', 'subject', 'word_count', 'language'];
    
    // Check if all required fields are present
    for (const field of requiredFields) {
        if (!inputs[field]) {
            return false;
        }
    }
    
    // Validate word_count is a number
    if (typeof inputs.word_count !== 'number') {
        return false;
    }
    
    return true;
};

// Story generation endpoint
app.post('/generate-story', async (req, res) => {
    try {
        // Validate inputs
        if (!validateInputs(req.body)) {
            return res.status(400).json({ error: 'Invalid or missing required inputs' });
        }

        const { 
            academic_grade, 
            subject, 
            subject_specification, 
            setting, 
            main_character, 
            word_count, 
            language 
        } = req.body;

        // Construct the prompt
        let prompt = `Create a didactic story for ${academic_grade} students about ${subject}`;
        if (subject_specification) prompt += `, specifically focusing on ${subject_specification}`;
        if (setting) prompt += `, set in ${setting}`;
        if (main_character) prompt += `, featuring ${main_character}`;
        prompt += `, approximately ${word_count} words, in ${language}. The story should be educational and engaging.`;

        // Make request to OpenRouter API
        const response = await axios.post(
            `${OPENROUTER_BASE_URL}/chat/completions`,
            {
                model: 'google/gemini-2.0-flash-001',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: word_count * 2,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': config.API_URL
                }
            }
        );

        if (response.data.error) {
            console.error('OpenRouter API Error:', response.data.error);
            return res.status(429).json({ 
                error: 'API rate limit exceeded. Please try again in a few minutes.' 
            });
        }

        const generatedStory = response.data.choices[0].message.content;

        // Store in Supabase
        try {
            await supabase.from('stories').insert([{
                academic_grade,
                subject,
                subject_specification,
                setting,
                main_character,
                word_count,
                language,
                story_text: generatedStory
            }]);
        } catch (dbError) {
            console.error('Supabase error:', dbError);
        }

        return res.status(200).json({ story: generatedStory });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: error.response?.data?.error?.message || 'Failed to generate story'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process, just log the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    // Don't exit the process, just log the error
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please try a different port or kill the process using this port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
}); 