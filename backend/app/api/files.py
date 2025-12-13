from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from typing import List
from app.core.security import get_current_active_user
from app.models.schemas import (
    BaseResponse, FileUploadResponse, ExamProcessingResponse, 
    ExamGradingRequest, ExamGradingResult, ExamQuestion
)
from app.services.file_service import file_processing_service
from app.services.grading_service import get_grading_service
from datetime import datetime
import os
import aiofiles

router = APIRouter(prefix="/files", tags=["File Processing"])

@router.post("/upload", response_model=BaseResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload and process a file"""
    try:
        # Validate file type
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required"
            )
        
        if not file_processing_service.validate_file_type(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type"
            )
        
        if not file_processing_service.validate_file_type(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type"
            )
        
        # Validate file size
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if not file_processing_service.validate_file_size(file_size):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed size (10MB)"
            )
        
        # Reset file position
        await file.seek(0)
        
        # Extract text from file
        extracted_text = await file_processing_service.extract_text_from_file(file)
        
        # Create upload directory if it doesn't exist
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(upload_dir, f"{current_user['id']}_{file.filename}")
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Create response
        upload_response = FileUploadResponse(
            filename=file.filename or "unknown",
            file_path=file_path,
            file_size=file_size,
            upload_time=datetime.utcnow(),
            extracted_text=extracted_text
        )
        
        return BaseResponse(
            success=True,
            message="File uploaded and processed successfully",
            data=upload_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}"
        )

@router.post("/extract-text", response_model=BaseResponse)
async def extract_text_from_file_endpoint(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Extract text from uploaded file without saving it"""
    try:
        # Validate file type
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required"
            )
        
        if not file_processing_service.validate_file_type(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type"
            )
        
        # Validate file size
        content = await file.read()
        file_size = len(content)
        
        if not file_processing_service.validate_file_size(file_size):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed size (10MB)"
            )
        
        # Reset file position
        await file.seek(0)
        
        # Extract text from file
        extracted_text = await file_processing_service.extract_text_from_file(file)
        
        return BaseResponse(
            success=True,
            message="Text extracted successfully",
            data={
                "filename": file.filename or "unknown",
                "file_size": file_size,
                "extracted_text": extracted_text
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text extraction failed: {str(e)}"
        )

@router.post("/process-exam", response_model=BaseResponse)
async def process_exam_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Process exam file and extract structured questions"""
    print(f"🔍 Processing file: {file.filename} for user: {current_user.get('email', 'unknown')}")
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required"
            )
        
        if not file_processing_service.validate_file_type(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF, DOCX, JPG, and PNG files are allowed for exam processing"
            )
        
        # Validate file size
        content = await file.read()
        file_size = len(content)
        
        if not file_processing_service.validate_file_size(file_size):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed size (10MB)"
            )
        
        # Reset file position
        await file.seek(0)
        
        # Process exam file
        print(f"📄 Starting file processing for {file.filename}")
        result = await file_processing_service.process_exam_file(file)
        
        print(f"✅ File processed successfully: {len(result.get('parsed_questions', []))} questions extracted")
        
        # Convert to response model
        exam_questions = [
            ExamQuestion(**q) for q in result["parsed_questions"]
        ]
        
        response_data = ExamProcessingResponse(
            filename=result["filename"],
            extracted_text=result["extracted_text"],
            parsed_questions=exam_questions,
            total_questions=result["total_questions"]
        )
        
        return BaseResponse(
            success=True,
            message="Exam file processed successfully",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Exam processing error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Exam processing failed: {str(e)}"
        )

@router.post("/grade-exam", response_model=BaseResponse)
async def grade_exam_questions(
    exam_request: ExamGradingRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Grade structured exam questions using AI"""
    try:
        if current_user["role"] not in ["admin", "teacher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only teachers and admins can grade exams"
            )
        
        # Get grading service instance
        grading_service = get_grading_service()
        if grading_service is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Grading service not available. Please check server configuration and OpenAI API key."
            )
        
        # Grade the exam
        grading_result = await grading_service.grade_structured_exam(exam_request)
        
        # Update submission status if submission_id is provided
        if exam_request.submission_id:
            try:
                from app.services.database_service import submission_service
                from datetime import datetime
                await submission_service.update_submission(
                    exam_request.submission_id, 
                    {
                        "status": "graded",
                        "graded_at": datetime.utcnow().isoformat(),
                        "marks_obtained": grading_result.total_awarded_marks,
                        "max_marks": grading_result.total_max_marks,
                        "total_score": grading_result.overall_percentage,
                        "graded_by": "ai"
                    }
                )
                print(f"✅ Updated submission {exam_request.submission_id} status to graded")
            except Exception as update_error:
                print(f"⚠️ Failed to update submission status: {update_error}")
                # Don't fail the entire request if status update fails
        
        return BaseResponse(
            success=True,
            message="Exam graded successfully",
            data=grading_result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Exam grading failed: {str(e)}"
        )

@router.get("/supported-formats", response_model=BaseResponse)
async def get_supported_formats():
    """Get list of supported file formats for exam processing"""
    supported_formats = {
        "exam_files": ["pdf", "docx", "jpg", "jpeg", "png"]
    }
    
    return BaseResponse(
        success=True,
        message="Supported file formats retrieved successfully",
        data=supported_formats
    )