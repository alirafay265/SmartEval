from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_active_user
from app.models.schemas import (
    SubmissionCreate, SubmissionResponse, BaseResponse,
    GradingRequest, GradingResponse, GradeSubmissionRequest
)
from app.services.database_service import submission_service, test_service
from app.services.grading_service import get_grading_service

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.post("/", response_model=BaseResponse)
async def create_submission(
    submission_data: SubmissionCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new submission"""
    try:
        # Verify test exists if test_id is provided
        if submission_data.test_id:
            test = await test_service.get_test_by_id(submission_data.test_id)
            if not test:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Test not found"
                )
        
        submission = await submission_service.create_submission(submission_data)
        return BaseResponse(
            success=True,
            message="Submission created successfully",
            data=submission
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create submission: {str(e)}"
        )

@router.get("/test/{test_id}", response_model=BaseResponse)
async def get_test_submissions(
    test_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all submissions for a test"""
    try:
        # Verify test ownership or admin access
        test = await test_service.get_test_by_id(test_id)
        if not test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test not found"
            )
        
        if test.created_by != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        submissions = await submission_service.get_submissions_by_test(test_id)
        return BaseResponse(
            success=True,
            message="Submissions retrieved successfully",
            data=submissions
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve submissions: {str(e)}"
        )

@router.get("/student/{student_email}", response_model=BaseResponse)
async def get_student_submissions(
    student_email: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all submissions by a student"""
    try:
        # Only allow access to own submissions or admin/teacher access
        if (current_user["email"] != student_email and 
            current_user["role"] not in ["admin", "teacher"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        submissions = await submission_service.get_submissions_by_student(student_email)
        return BaseResponse(
            success=True,
            message="Submissions retrieved successfully",
            data=submissions
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve submissions: {str(e)}"
        )

@router.get("/{submission_id}", response_model=BaseResponse)
async def get_submission(
    submission_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific submission"""
    try:
        submission = await submission_service.get_submission_by_id(submission_id)
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Submission not found"
            )
        
        # Check access permissions
        test = None
        if submission.test_id:
            test = await test_service.get_test_by_id(submission.test_id)
        if (submission.student_email != current_user["email"] and 
            (not test or test.created_by != current_user["id"]) and 
            current_user["role"] not in ["admin", "teacher"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return BaseResponse(
            success=True,
            message="Submission retrieved successfully",
            data=submission
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve submission: {str(e)}"
        )

@router.post("/{submission_id}/grade", response_model=BaseResponse)
async def grade_submission(
    submission_id: str,
    grade_request: GradeSubmissionRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Grade a submission manually or using AI"""
    try:
        # Get submission and verify access
        print(f"🔍 Looking for submission ID: {submission_id}")
        submission = await submission_service.get_submission_by_id(submission_id)
        print(f"📄 Submission found: {submission is not None}")
        if submission:
            print(f"📝 Submission details: content={bool(submission.content)}, test_id={submission.test_id}")
        
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Submission not found"
            )
        
        # Check test access if test_id exists
        test = None
        if submission.test_id:
            test = await test_service.get_test_by_id(submission.test_id)
            if test and (test.created_by != current_user["id"] and current_user["role"] not in ["admin", "teacher"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        # Note: For submissions without test_id, we allow grading by any authenticated teacher/admin
        
        if grade_request.use_ai:
            # Use AI grading
            # Get exam text from submission content or answers
            exam_text = ""
            if hasattr(submission, 'content') and submission.content:
                # Use content field (from file uploads)
                exam_text = submission.content
            elif hasattr(submission, 'answers') and submission.answers:
                # Use answers field (from manual form submissions)
                for question_id, answer in submission.answers.items():
                    exam_text += f"Question {question_id}: {answer}\n"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No content or answers found in submission to grade"
                )
            
            # Create grading request
            grading_request = GradingRequest(
                exam_text=exam_text,
                max_score=test.max_score if test else 100.0
            )
            
            # Get grading service instance
            grading_service = get_grading_service()
            if grading_service is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI grading service not available. Please check server configuration and API keys."
                )
            
            # Get AI grading result
            grading_result = await grading_service.grade_exam(grading_request)
            
            # Save grading result
            graded_submission = await submission_service.grade_submission(
                submission_id=submission_id,
                score=grading_result.score,
                feedback=grading_result.feedback,
                graded_by="ai"
            )
            
            return BaseResponse(
                success=True,
                message="Submission graded successfully using AI",
                data={
                    "submission": graded_submission,
                    "grading_details": grading_result
                }
            )
        
        else:
            # Manual grading
            if not grade_request.manual_scores or not grade_request.manual_feedback:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Manual scores and feedback are required for manual grading"
                )
            
            # Calculate total score from manual scores
            total_score = sum(grade_request.manual_scores.values())
            
            # Save grading result
            graded_submission = await submission_service.grade_submission(
                submission_id=submission_id,
                score=total_score,
                feedback=grade_request.manual_feedback,
                graded_by=current_user["id"]
            )
            
            return BaseResponse(
                success=True,
                message="Submission graded successfully (manual)",
                data=graded_submission
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to grade submission: {str(e)}"
        )

@router.post("/grade-text", response_model=GradingResponse)
async def grade_text_directly(
    grading_request: GradingRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Grade text directly using AI (for testing or quick grading)"""
    try:
        if current_user["role"] not in ["admin", "teacher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only teachers and admins can use this feature."
            )
        
        grading_service = get_grading_service()
        if grading_service is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI grading service not available. Please check server configuration and API keys."
            )
        
        result = await grading_service.grade_exam(grading_request)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to grade text: {str(e)}"
        )

@router.get("/test-ai-connection", response_model=BaseResponse)
async def test_ai_connection(current_user: dict = Depends(get_current_active_user)):
    """Test AI grading service connection"""
    try:
        if current_user["role"] not in ["admin", "teacher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        grading_service = get_grading_service()
        if grading_service is None:
            is_connected = False
        else:
            is_connected = await grading_service.test_connection()
        
        return BaseResponse(
            success=is_connected,
            message="AI connection test completed",
            data={"connected": is_connected}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Connection test failed: {str(e)}"
        )