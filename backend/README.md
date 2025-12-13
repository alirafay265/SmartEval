# GradeGuard Pro Backend

A FastAPI-based backend for the GradeGuard Pro AI-powered exam grading system.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with Supabase integration
- 📝 **Test Management** - Create, read, update, delete tests and questions
- 📄 **Submission Processing** - Handle exam submissions and grading
- 🤖 **AI Grading** - Automated grading using Hugging Face LLM API
- 📁 **File Processing** - Extract text from PDFs, DOCX, images, and spreadsheets
- 📊 **Analytics** - Comprehensive analytics for tests and student performance
- 🗄️ **Database Operations** - Full CRUD operations with Supabase

## Quick Start

### Prerequisites

- Python 3.8+
- Supabase account and project
- Hugging Face API key

### Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Update the environment variables with your credentials

5. **Run the application**
   ```bash
   # Development
   python main.py
   
   # Or using uvicorn directly
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at:
- **Main API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/refresh` - Refresh access token

### Tests
- `POST /api/v1/tests/` - Create new test
- `GET /api/v1/tests/` - Get user's tests
- `GET /api/v1/tests/{test_id}` - Get specific test
- `PUT /api/v1/tests/{test_id}` - Update test
- `DELETE /api/v1/tests/{test_id}` - Delete test

### Questions
- `POST /api/v1/tests/{test_id}/questions` - Add question to test
- `GET /api/v1/tests/{test_id}/questions` - Get test questions
- `PUT /api/v1/tests/{test_id}/questions/{question_id}` - Update question
- `DELETE /api/v1/tests/{test_id}/questions/{question_id}` - Delete question

### Submissions
- `POST /api/v1/submissions/` - Create submission
- `GET /api/v1/submissions/test/{test_id}` - Get test submissions
- `GET /api/v1/submissions/student/{email}` - Get student submissions
- `GET /api/v1/submissions/{submission_id}` - Get specific submission
- `POST /api/v1/submissions/{submission_id}/grade` - Grade submission
- `POST /api/v1/submissions/grade-text` - Grade text directly
- `GET /api/v1/submissions/test-ai-connection` - Test AI connection

### File Processing
- `POST /api/v1/files/upload` - Upload and process file
- `POST /api/v1/files/extract-text` - Extract text from file
- `GET /api/v1/files/supported-formats` - Get supported formats

### Analytics
- `GET /api/v1/analytics/test/{test_id}` - Get test analytics
- `GET /api/v1/analytics/student/{email}/performance` - Get student performance
- `GET /api/v1/analytics/dashboard` - Get dashboard analytics

## Architecture

```
backend/
├── app/
│   ├── api/                 # API route handlers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── tests.py        # Test management endpoints
│   │   ├── submissions.py   # Submission endpoints
│   │   ├── files.py        # File processing endpoints
│   │   └── analytics.py    # Analytics endpoints
│   ├── core/               # Core functionality
│   │   ├── config.py       # Configuration settings
│   │   ├── database.py     # Database connection
│   │   └── security.py     # Security utilities
│   ├── models/             # Data models
│   │   └── schemas.py      # Pydantic models
│   └── services/           # Business logic
│       ├── database_service.py  # Database operations
│       ├── grading_service.py   # AI grading logic
│       └── file_service.py      # File processing
├── main.py                 # Application entry point
├── requirements.txt        # Dependencies
└── .env                   # Environment variables
```

## Environment Variables

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# AI Grading
HUGGING_FACE_API_KEY=your_hugging_face_api_key

# Security
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Server
DEBUG=True
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Database Schema

The backend works with these main tables in Supabase:

- **users** - User profiles and authentication
- **tests** - Test definitions and metadata
- **questions** - Questions belonging to tests
- **submissions** - Student exam submissions
- **grades** - Grading results and feedback

## AI Grading

The system uses Hugging Face's LLM API for automated grading:

- **Model**: `openai/gpt-oss-20b:groq`
- **Features**: Text analysis, scoring, detailed feedback
- **Input**: Exam text, answer keys, rubrics
- **Output**: Scores, feedback, question-by-question breakdown

## File Processing

Supported file formats:
- **Documents**: PDF, DOC, DOCX, TXT
- **Spreadsheets**: XLSX, XLS, CSV
- **Images**: JPG, JPEG, PNG, BMP, TIFF (with OCR)

## Security

- JWT-based authentication
- Role-based access control (admin, teacher, student)
- Input validation and sanitization
- File type and size validation
- CORS protection

## Deployment

### Development
```bash
python main.py
```

### Production
```bash
# Using Gunicorn
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Using Docker (create Dockerfile)
docker build -t gradeguard-backend .
docker run -p 8000:8000 gradeguard-backend
```

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest

# Run with coverage
pytest --cov=app
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.