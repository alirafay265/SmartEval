from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.database import db, supabase
from app.models.schemas import (
    UserCreate, UserResponse, TestCreate, TestResponse, TestUpdate,
    QuestionCreate, QuestionResponse, QuestionUpdate,
    SubmissionCreate, SubmissionResponse
)

# db is already the admin client (bypasses RLS) if service role key is set
# supabase is the regular anon client needed for auth operations

class UserService:
    @staticmethod
    async def create_user(user_data: UserCreate) -> UserResponse:
        """Create a new user"""
        try:
            # Check if user already exists
            existing_user = db.table("users").select("*").eq("email", user_data.email).execute()
            if existing_user.data:
                raise ValueError("User with this email already exists")
            
            # Create user in Supabase Auth
            auth_response = supabase.auth.sign_up({
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "full_name": user_data.full_name,
                        "role": user_data.role
                    }
                }
            })
            
            if auth_response.user:
                # Create user profile in users table
                user_profile = {
                    "id": auth_response.user.id,
                    "email": user_data.email,
                    "full_name": user_data.full_name,
                    "role": user_data.role,
                    "is_active": True,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                result = db.table("users").insert(user_profile).execute()
                return UserResponse(**result.data[0])
            else:
                raise ValueError("Failed to create user")
                
        except Exception as e:
            raise Exception(f"Error creating user: {str(e)}")

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[UserResponse]:
        """Get user by email"""
        result = db.table("users").select("*").eq("email", email).execute()
        if result.data:
            return UserResponse(**result.data[0])
        return None

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[UserResponse]:
        """Get user by ID"""
        result = db.table("users").select("*").eq("id", user_id).execute()
        if result.data:
            return UserResponse(**result.data[0])
        return None

    @staticmethod
    async def get_all_users() -> List[UserResponse]:
        """Get all users"""
        result = db.table("users").select("*").execute()
        return [UserResponse(**user) for user in result.data]

class TestService:
    @staticmethod
    async def create_test(test_data: TestCreate, created_by: str) -> TestResponse:
        """Create a new test"""
        try:
            test_dict = test_data.dict()
            test_dict["created_by"] = created_by
            test_dict["created_at"] = datetime.utcnow().isoformat()
            test_dict["is_active"] = True
            
            result = db.table("tests").insert(test_dict).execute()
            return TestResponse(**result.data[0])
            
        except Exception as e:
            raise Exception(f"Error creating test: {str(e)}")

    @staticmethod
    async def get_test_by_id(test_id: str) -> Optional[TestResponse]:
        """Get test by ID"""
        result = db.table("tests").select("*").eq("id", test_id).execute()
        if result.data:
            return TestResponse(**result.data[0])
        return None

    @staticmethod
    async def get_tests_by_user(user_id: str) -> List[TestResponse]:
        """Get all tests created by a user"""
        result = db.table("tests").select("*").eq("created_by", user_id).execute()
        return [TestResponse(**test) for test in result.data]

    @staticmethod
    async def update_test(test_id: str, test_data: TestUpdate, user_id: str) -> Optional[TestResponse]:
        """Update a test"""
        try:
            # Check if user owns the test
            existing_test = await TestService.get_test_by_id(test_id)
            if not existing_test or existing_test.created_by != user_id:
                return None
            
            update_data = test_data.dict(exclude_unset=True)
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = db.table("tests").update(update_data).eq("id", test_id).execute()
            if result.data:
                return TestResponse(**result.data[0])
            return None
            
        except Exception as e:
            raise Exception(f"Error updating test: {str(e)}")

    @staticmethod
    async def delete_test(test_id: str, user_id: str) -> bool:
        """Delete a test"""
        try:
            # Check if user owns the test
            existing_test = await TestService.get_test_by_id(test_id)
            if not existing_test or existing_test.created_by != user_id:
                return False
            
            # Soft delete by setting is_active to False
            result = db.table("tests").update({"is_active": False}).eq("id", test_id).execute()
            return len(result.data) > 0
            
        except Exception as e:
            raise Exception(f"Error deleting test: {str(e)}")

class QuestionService:
    @staticmethod
    async def create_question(question_data: QuestionCreate) -> QuestionResponse:
        """Create a new question"""
        try:
            question_dict = question_data.dict()
            question_dict["created_at"] = datetime.utcnow().isoformat()
            
            result = db.table("questions").insert(question_dict).execute()
            return QuestionResponse(**result.data[0])
            
        except Exception as e:
            raise Exception(f"Error creating question: {str(e)}")

    @staticmethod
    async def get_questions_by_test(test_id: str) -> List[QuestionResponse]:
        """Get all questions for a test"""
        result = db.table("questions").select("*").eq("test_id", test_id).execute()
        return [QuestionResponse(**question) for question in result.data]

    @staticmethod
    async def update_question(question_id: str, question_data: QuestionUpdate) -> Optional[QuestionResponse]:
        """Update a question"""
        try:
            update_data = question_data.dict(exclude_unset=True)
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = db.table("questions").update(update_data).eq("id", question_id).execute()
            if result.data:
                return QuestionResponse(**result.data[0])
            return None
            
        except Exception as e:
            raise Exception(f"Error updating question: {str(e)}")

    @staticmethod
    async def delete_question(question_id: str) -> bool:
        """Delete a question"""
        try:
            result = db.table("questions").delete().eq("id", question_id).execute()
            return len(result.data) > 0
            
        except Exception as e:
            raise Exception(f"Error deleting question: {str(e)}")

class SubmissionService:
    @staticmethod
    async def create_submission(submission_data: SubmissionCreate) -> SubmissionResponse:
        """Create a new submission"""
        try:
            submission_dict = submission_data.dict()
            submission_dict["submitted_at"] = datetime.utcnow().isoformat()
            
            result = db.table("submissions").insert(submission_dict).execute()
            return SubmissionResponse(**result.data[0])
            
        except Exception as e:
            raise Exception(f"Error creating submission: {str(e)}")

    @staticmethod
    async def get_submission_by_id(submission_id: str) -> Optional[SubmissionResponse]:
        """Get submission by ID"""
        import json
        print(f"🔍 Querying submission with ID: {submission_id}", flush=True)
        result = db.table("submissions").select("*").eq("id", submission_id).execute()
        print(f"📊 Query result: {len(result.data) if result.data else 0} records found", flush=True)
        if result.data:
            data = result.data[0]
            print(f"📄 Raw submission data keys: {list(data.keys())}", flush=True)
            
            # Parse extracted_questions if it's a string
            if isinstance(data.get('extracted_questions'), str):
                try:
                    data['extracted_questions'] = json.loads(data['extracted_questions'])
                except:
                    data['extracted_questions'] = None
            
            try:
                return SubmissionResponse(**data)
            except Exception as e:
                print(f"❌ Error parsing submission response: {e}", flush=True)
                return None
        return None

    @staticmethod
    async def get_submissions_by_test(test_id: str) -> List[SubmissionResponse]:
        """Get all submissions for a test"""
        result = db.table("submissions").select("*").eq("test_id", test_id).execute()
        return [SubmissionResponse(**submission) for submission in result.data]

    @staticmethod
    async def get_submissions_by_student(student_email: str) -> List[SubmissionResponse]:
        """Get all submissions by a student"""
        result = db.table("submissions").select("*").eq("student_email", student_email).execute()
        return [SubmissionResponse(**submission) for submission in result.data]

    @staticmethod
    async def update_submission(submission_id: str, update_data: dict) -> Optional[SubmissionResponse]:
        """Update submission with arbitrary data"""
        try:
            result = db.table("submissions").update(update_data).eq("id", submission_id).execute()
            if result.data:
                return SubmissionResponse(**result.data[0])
            return None
        except Exception as e:
            raise Exception(f"Error updating submission: {str(e)}")

    @staticmethod
    async def grade_submission(submission_id: str, score: float, feedback: str, graded_by: str) -> Optional[SubmissionResponse]:
        """Grade a submission"""
        try:
            update_data = {
                "total_score": score,
                "marks_obtained": score,
                "feedback": feedback,
                "graded_by": graded_by,
                "graded_at": datetime.utcnow().isoformat(),
                "status": "graded"
            }
            
            result = db.table("submissions").update(update_data).eq("id", submission_id).execute()
            if result.data:
                return SubmissionResponse(**result.data[0])
            return None
            
        except Exception as e:
            raise Exception(f"Error grading submission: {str(e)}")

# Create service instances
user_service = UserService()
test_service = TestService()
question_service = QuestionService()
submission_service = SubmissionService()
