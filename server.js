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
        'https://didactic-story-backend.onrender.com'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
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
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Initialize Supabase client with error handling
let supabase;
try {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
    }
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
    console.error('Missing OpenRouter API key');
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

            console.log('OpenRouter API Response:', JSON.stringify(response.data, null, 2));

            if (response.data.error) {
                throw new Error(response.data.error.message || 'API Error');
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
                    console.error('Supabase error details:', {
                        message: dbError.message,
                        details: dbError.details,
                        hint: dbError.hint,
                        code: dbError.code
                    });
                    // Continue execution even if database insertion fails
                } else {
                    console.log('Successfully stored story in Supabase:', data);
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

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 