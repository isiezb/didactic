const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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

// Supabase client initialization
const supabaseUrl = 'https://ldexpvsuttybqilbdaxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZXhwdnN1dHR5YnFpbGJkYXhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mjk4OTk1NSwiZXhwIjoyMDU4NTY1OTU1fQ.1gN2iRX0cWa_n_65LyimAITggLW3SL_lemvlYvvPnrI';

// Initialize Supabase client with error handling
let supabase;
try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    process.exit(1);
}

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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

if (!OPENROUTER_API_KEY) {
    console.error('OpenRouter API key is not set in environment variables');
    process.exit(1);
}

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

        // Construct the prompt with optional fields
        let prompt = `Create a didactic story for ${academic_grade} students about ${subject}`;
        
        if (subject_specification) {
            prompt += `, specifically focusing on ${subject_specification}`;
        }
        
        if (setting) {
            prompt += `, set in ${setting}`;
        } else {
            prompt += `, set in an appropriate environment`;
        }
        
        if (main_character) {
            prompt += `, featuring ${main_character}`;
        } else {
            prompt += `, featuring a relatable protagonist`;
        }
        
        prompt += `, approximately ${word_count} words, in ${language}. The story should be educational and engaging, with clear learning objectives appropriate for ${academic_grade} level.`;

        // Make request to OpenRouter API
        try {
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
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.NODE_ENV === 'production' 
                            ? 'https://didactic-story-frontend.onrender.com'
                            : 'http://localhost:8000'
                    }
                }
            );

            if (response.data.error) {
                console.error('OpenRouter API Error:', response.data.error);
                return res.status(429).json({ 
                    error: 'API rate limit exceeded. Please try again in a few minutes.' 
                });
            }

            if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
                throw new Error('Invalid API response format');
            }

            const generatedStory = response.data.choices[0].message.content;

            // Store in Supabase
            try {
                const { data, error: dbError } = await supabase
                    .from('stories')
                    .insert([
                        {
                            academic_grade,
                            subject,
                            subject_specification,
                            setting,
                            main_character,
                            word_count,
                            language,
                            story_text: generatedStory
                        }
                    ]);

                if (dbError) {
                    console.error('Supabase error:', dbError);
                    // Continue execution even if database insertion fails
                } else {
                    console.log('Successfully stored story in Supabase');
                }
            } catch (dbError) {
                console.error('Supabase connection error:', dbError);
            }

            // Return success response
            return res.status(200).json({ story: generatedStory });
        } catch (error) {
            console.error('OpenRouter API Error:', error.response ? error.response.data : error.message);
            return res.status(500).json({ 
                error: error.response?.data?.error?.message || 'Failed to generate story'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to generate story' });
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