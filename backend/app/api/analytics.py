from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_active_user
from app.models.schemas import BaseResponse, TestAnalytics, StudentPerformance
from app.services.database_service import submission_service, test_service
from app.core.database import supabase

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/test/{test_id}", response_model=BaseResponse)
async def get_test_analytics(
    test_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get analytics for a specific test"""
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
        
        # Get all submissions for the test
        submissions = await submission_service.get_submissions_by_test(test_id)
        
        if not submissions:
            return BaseResponse(
                success=True,
                message="No submissions found for this test",
                data=TestAnalytics(
                    test_id=test_id,
                    total_submissions=0,
                    average_score=0.0,
                    highest_score=0.0,
                    lowest_score=0.0,
                    completion_rate=0.0,
                    score_distribution={}
                )
            )
        
        # Calculate analytics
        graded_submissions = [s for s in submissions if s.total_score is not None]
        total_submissions = len(submissions)
        graded_count = len(graded_submissions)
        
        if graded_count == 0:
            scores = [0.0]
        else:
            scores = [float(s.total_score) for s in graded_submissions if s.total_score is not None]
        
        average_score = sum(scores) / len(scores) if scores else 0.0
        highest_score = max(scores) if scores else 0.0
        lowest_score = min(scores) if scores else 0.0
        completion_rate = (graded_count / total_submissions * 100) if total_submissions > 0 else 0.0
        
        # Score distribution (by grade ranges)
        score_ranges = {
            "A (90-100)": 0,
            "B (80-89)": 0,
            "C (70-79)": 0,
            "D (60-69)": 0,
            "F (0-59)": 0
        }
        
        for score in scores:
            if score is not None:
                percentage = (score / test.max_score) * 100 if test.max_score > 0 else 0
                if percentage >= 90:
                    score_ranges["A (90-100)"] += 1
                elif percentage >= 80:
                    score_ranges["B (80-89)"] += 1
                elif percentage >= 70:
                    score_ranges["C (70-79)"] += 1
                elif percentage >= 60:
                    score_ranges["D (60-69)"] += 1
                else:
                    score_ranges["F (0-59)"] += 1
        
        analytics = TestAnalytics(
            test_id=test_id,
            total_submissions=total_submissions,
            average_score=round(average_score, 2),
            highest_score=highest_score,
            lowest_score=lowest_score,
            completion_rate=round(completion_rate, 2),
            score_distribution=score_ranges
        )
        
        return BaseResponse(
            success=True,
            message="Test analytics retrieved successfully",
            data=analytics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve test analytics: {str(e)}"
        )

@router.get("/student/{student_email}/performance", response_model=BaseResponse)
async def get_student_performance(
    student_email: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get performance analytics for a specific student"""
    try:
        # Check access permissions
        if (current_user["email"] != student_email and 
            current_user["role"] not in ["admin", "teacher"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get all submissions by the student
        submissions = await submission_service.get_submissions_by_student(student_email)
        
        if not submissions:
            return BaseResponse(
                success=True,
                message="No submissions found for this student",
                data=StudentPerformance(
                    student_email=student_email,
                    tests_taken=0,
                    average_score=0.0,
                    total_points_earned=0.0,
                    total_points_possible=0.0,
                    recent_tests=[]
                )
            )
        
        # Calculate performance metrics
        graded_submissions = [s for s in submissions if s.total_score is not None]
        tests_taken = len(submissions)
        
        total_points_earned = sum(float(s.total_score) for s in graded_submissions if s.total_score is not None) if graded_submissions else 0.0
        
        # Get test details to calculate total points possible
        total_points_possible = 0.0
        for submission in graded_submissions:
            if submission.test_id:
                test = await test_service.get_test_by_id(submission.test_id)
                if test:
                    total_points_possible += test.max_score
            elif submission.max_marks:
                total_points_possible += submission.max_marks
        
        average_score = (total_points_earned / total_points_possible * 100) if total_points_possible > 0 else 0.0
        
        # Get recent tests (last 5)
        from datetime import datetime as dt
        recent_submissions = sorted(submissions, key=lambda x: x.uploaded_at or dt.min, reverse=True)[:5]
        recent_tests = []
        
        for submission in recent_submissions:
            if not submission.test_id:
                continue
            test = await test_service.get_test_by_id(submission.test_id)
            if test:
                score_percentage = (submission.total_score / test.max_score * 100) if (submission.total_score and test.max_score > 0) else 0
                recent_tests.append({
                    "test_id": test.id,
                    "test_title": test.title,
                    "score": submission.total_score,
                    "max_score": test.max_score,
                    "percentage": round(score_percentage, 2),
                    "submitted_at": submission.uploaded_at,
                    "graded": submission.total_score is not None
                })
        
        performance = StudentPerformance(
            student_email=student_email,
            tests_taken=tests_taken,
            average_score=round(average_score, 2),
            total_points_earned=round(total_points_earned, 2),
            total_points_possible=round(total_points_possible, 2),
            recent_tests=recent_tests
        )
        
        return BaseResponse(
            success=True,
            message="Student performance retrieved successfully",
            data=performance
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve student performance: {str(e)}"
        )

@router.get("/dashboard", response_model=BaseResponse)
async def get_dashboard_analytics(current_user: dict = Depends(get_current_active_user)):
    """Get dashboard analytics for the current user"""
    try:
        if current_user["role"] == "teacher":
            # Teacher dashboard - get analytics for their tests
            tests = await test_service.get_tests_by_user(current_user["id"])
            
            total_tests = len(tests)
            total_submissions = 0
            total_students = set()
            
            for test in tests:
                submissions = await submission_service.get_submissions_by_test(test.id)
                total_submissions += len(submissions)
                for submission in submissions:
                    total_students.add(submission.student_email)
            
            dashboard_data = {
                "total_tests": total_tests,
                "total_submissions": total_submissions,
                "total_students": len(total_students),
                "recent_tests": tests[:5]  # Last 5 tests
            }
            
        elif current_user["role"] == "student":
            # Student dashboard - get their performance
            submissions = await submission_service.get_submissions_by_student(current_user["email"])
            graded_submissions = [s for s in submissions if s.total_score is not None]
            
            total_tests_taken = len(submissions)
            average_score = 0.0
            
            if graded_submissions:
                total_points = 0.0
                max_points = 0.0
                
                for submission in graded_submissions:
                    if submission.test_id:
                        test = await test_service.get_test_by_id(submission.test_id)
                        if test and submission.total_score is not None:
                            total_points += float(submission.total_score)
                            max_points += test.max_score
                    elif submission.marks_obtained is not None and submission.max_marks:
                        total_points += float(submission.marks_obtained)
                        max_points += submission.max_marks
                
                average_score = (total_points / max_points * 100) if max_points > 0 else 0.0
            
            dashboard_data = {
                "total_tests_taken": total_tests_taken,
                "tests_graded": len(graded_submissions),
                "average_score": round(average_score, 2),
                "recent_submissions": submissions[:5]  # Last 5 submissions
            }
            
        else:  # admin
            # Admin dashboard - global statistics
            # This would require more complex queries - simplified for now
            dashboard_data = {
                "message": "Admin dashboard - implement global statistics here"
            }
        
        return BaseResponse(
            success=True,
            message="Dashboard analytics retrieved successfully",
            data=dashboard_data
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve dashboard analytics: {str(e)}"
        )