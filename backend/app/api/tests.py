from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_active_user
from app.models.schemas import (
    TestCreate, TestResponse, TestUpdate, BaseResponse,
    QuestionCreate, QuestionResponse, QuestionUpdate
)
from app.services.database_service import test_service, question_service

router = APIRouter(prefix="/tests", tags=["Tests"])

@router.post("/", response_model=BaseResponse)
async def create_test(
    test_data: TestCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new test"""
    try:
        test = await test_service.create_test(test_data, current_user["id"])
        return BaseResponse(
            success=True,
            message="Test created successfully",
            data=test
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create test: {str(e)}"
        )

@router.get("/", response_model=BaseResponse)
async def get_user_tests(current_user: dict = Depends(get_current_active_user)):
    """Get all tests created by the current user"""
    try:
        tests = await test_service.get_tests_by_user(current_user["id"])
        return BaseResponse(
            success=True,
            message="Tests retrieved successfully",
            data=tests
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tests: {str(e)}"
        )

@router.get("/{test_id}", response_model=BaseResponse)
async def get_test(
    test_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific test by ID"""
    try:
        test = await test_service.get_test_by_id(test_id)
        if not test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test not found"
            )
        
        # Check if user has access to this test
        if test.created_by != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return BaseResponse(
            success=True,
            message="Test retrieved successfully",
            data=test
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve test: {str(e)}"
        )

@router.put("/{test_id}", response_model=BaseResponse)
async def update_test(
    test_id: str,
    test_data: TestUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a test"""
    try:
        test = await test_service.update_test(test_id, test_data, current_user["id"])
        if not test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test not found or access denied"
            )
        
        return BaseResponse(
            success=True,
            message="Test updated successfully",
            data=test
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update test: {str(e)}"
        )

@router.delete("/{test_id}", response_model=BaseResponse)
async def delete_test(
    test_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a test"""
    try:
        success = await test_service.delete_test(test_id, current_user["id"])
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test not found or access denied"
            )
        
        return BaseResponse(
            success=True,
            message="Test deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete test: {str(e)}"
        )

@router.post("/{test_id}/questions", response_model=BaseResponse)
async def create_question(
    test_id: str,
    question_data: QuestionCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new question for a test"""
    try:
        # Verify test ownership
        test = await test_service.get_test_by_id(test_id)
        if not test or test.created_by != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Set the test_id for the question
        question_data.test_id = test_id
        question = await question_service.create_question(question_data)
        
        return BaseResponse(
            success=True,
            message="Question created successfully",
            data=question
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create question: {str(e)}"
        )

@router.get("/{test_id}/questions", response_model=BaseResponse)
async def get_test_questions(
    test_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all questions for a test"""
    try:
        # Verify test access
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
        
        questions = await question_service.get_questions_by_test(test_id)
        
        return BaseResponse(
            success=True,
            message="Questions retrieved successfully",
            data=questions
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve questions: {str(e)}"
        )

@router.put("/{test_id}/questions/{question_id}", response_model=BaseResponse)
async def update_question(
    test_id: str,
    question_id: str,
    question_data: QuestionUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a question"""
    try:
        # Verify test ownership
        test = await test_service.get_test_by_id(test_id)
        if not test or test.created_by != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        question = await question_service.update_question(question_id, question_data)
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        return BaseResponse(
            success=True,
            message="Question updated successfully",
            data=question
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update question: {str(e)}"
        )

@router.delete("/{test_id}/questions/{question_id}", response_model=BaseResponse)
async def delete_question(
    test_id: str,
    question_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a question"""
    try:
        # Verify test ownership
        test = await test_service.get_test_by_id(test_id)
        if not test or test.created_by != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        success = await question_service.delete_question(question_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        return BaseResponse(
            success=True,
            message="Question deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete question: {str(e)}"
        )