# Didactic Story Generator

An AI-powered web application that generates educational stories based on academic grade, subject, and other parameters.

## Features

- Generate educational stories tailored to different academic levels
- Support for multiple subjects and languages
- Customizable story parameters (setting, main character, word count)
- Dark/Light mode support
- Responsive design
- Story metrics (word count, reading time)

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: Supabase
- AI: OpenRouter API (Gemini Flash)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/didactic-story-generator.git
cd didactic-story-generator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with:
```
OPENROUTER_API_KEY=your_openrouter_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

4. Start the backend server:
```bash
npm start
```

5. Start the frontend server:
```bash
python3 -m http.server 8000
```

6. Open `http://localhost:8000` in your browser

## Database Setup

Run the SQL commands in `setup.sql` in your Supabase database to create the required tables.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 