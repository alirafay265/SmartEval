from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime

# Base Response
class BaseResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "teacher"  # teacher, admin, student

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Test Models
class TestBase(BaseModel):
    title: str
    course_name: Optional[str] = None
    exam_type: Optional[str] = "midterm"
    test_file_url: Optional[str] = None
    # Legacy fields for backward compatibility
    description: Optional[str] = None
    subject: Optional[str] = None
    max_score: float = 100.0
    time_limit: Optional[int] = None  # in minutes
    instructions: Optional[str] = None

class TestCreate(TestBase):
    pass

class TestUpdate(BaseModel):
    title: Optional[str] = None
    course_name: Optional[str] = None
    exam_type: Optional[str] = None
    test_file_url: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    max_score: Optional[float] = None
    time_limit: Optional[int] = None
    instructions: Optional[str] = None

class TestResponse(BaseModel):
    id: str
    title: str
    user_id: str
    course_name: Optional[str] = None
    exam_type: Optional[str] = None
    test_file_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Legacy fields for backward compatibility
    description: Optional[str] = None
    subject: Optional[str] = None
    max_score: Optional[float] = 100.0
    time_limit: Optional[int] = None
    instructions: Optional[str] = None
    is_active: bool = True
    
    model_config = {"from_attributes": True}

# Question Models
class QuestionBase(BaseModel):
    test_id: str
    question_text: str
    question_type: str = "text"  # text, multiple_choice, essay
    points: float = 1.0
    correct_answer: Optional[str] = None
    options: Optional[List[str]] = None

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    points: Optional[float] = None
    correct_answer: Optional[str] = None
    options: Optional[List[str]] = None

class QuestionResponse(QuestionBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Submission Models
class SubmissionBase(BaseModel):
    test_id: Optional[str] = None
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    status: Optional[str] = "ungraded"
    marks_obtained: Optional[float] = None
    max_marks: Optional[float] = None
    content: Optional[str] = None  # Extracted text content
    extracted_questions: Optional[List[Dict[str, Any]]] = None  # Structured Q&A data
    rubric_criteria: Optional[str] = None

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionResponse(SubmissionBase):
    id: str
    user_id: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    # Keep these for backwards compatibility but optional
    graded_at: Optional[datetime] = None
    total_score: Optional[float] = None
    graded_by: Optional[str] = None  # "ai" or user_id
    feedback: Optional[str] = None
    # Legacy fields - optional for backwards compatibility
    student_email: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    submitted_at: Optional[datetime] = None

# Grading Models
class GradingRequest(BaseModel):
    exam_text: str
    answer_key: Optional[str] = None
    rubric: Optional[str] = None
    max_score: float = 100.0

class QuestionBreakdown(BaseModel):
    question: str
    score: float
    max_score: float
    feedback: str

class GradingResponse(BaseModel):
    score: float
    max_score: float
    feedback: str
    breakdown: List[QuestionBreakdown] = []

class GradeSubmissionRequest(BaseModel):
    submission_id: str
    use_ai: bool = True
    manual_scores: Optional[Dict[str, float]] = None
    manual_feedback: Optional[str] = None

# Analytics Models
class TestAnalytics(BaseModel):
    test_id: str
    total_submissions: int
    average_score: float
    highest_score: float
    lowest_score: float
    completion_rate: float
    score_distribution: Dict[str, int]

class StudentPerformance(BaseModel):
    student_email: str
    tests_taken: int
    average_score: float
    total_points_earned: float
    total_points_possible: float
    recent_tests: List[Dict[str, Any]]

# File Upload Models
class FileUploadResponse(BaseModel):
    filename: str
    file_path: str
    file_size: int
    upload_time: datetime
    extracted_text: Optional[str] = None

# Exam Processing Models
class ExamQuestion(BaseModel):
    question_number: int
    question: str
    student_answer: str
    max_marks: float
    question_type: str = "essay"  # essay, multiple_choice

class ExamProcessingResponse(BaseModel):
    filename: str
    extracted_text: str
    parsed_questions: List[ExamQuestion]
    total_questions: int

class ExamGradingRequest(BaseModel):
    submission_id: Optional[str] = None  # ID of the submission to update after grading
    questions: List[ExamQuestion]
    rubric_criteria: Optional[str] = None
    test_questions: Optional[List[str]] = None  # Questions from the test if test_id is provided
    total_marks: Optional[int] = None  # Total marks the exam is graded out of

class QuestionGradingResult(BaseModel):
    question_number: int
    question: str
    student_answer: str
    max_marks: float
    awarded_marks: float
    feedback: str
    percentage: float

class ExamGradingResult(BaseModel):
    total_questions: int
    total_max_marks: float
    total_awarded_marks: float
    overall_percentage: float
    overall_feedback: str
    question_results: List[QuestionGradingResult]