import os
import json
from typing import Dict, List, Optional
from app.core.config import settings

# Import with fallback
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
from app.models.schemas import (
    GradingRequest, GradingResponse, QuestionBreakdown,
    ExamQuestion, ExamGradingRequest, ExamGradingResult, QuestionGradingResult
)

class GradingService:
    def __init__(self):
        """Initialize the grading service with Hugging Face API"""
        if not OpenAI:
            raise ValueError("OpenAI package not available. Please install openai package.")
        
        # Check if we have the API key
        try:
            api_key = settings.hugging_face_api_key
        except Exception:
            raise ValueError("Settings not properly configured. Please check your environment variables.")
        
        if not api_key:
            raise ValueError("Hugging Face API key not found in environment variables")
        
        try:
            self.client = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=api_key,
            )
            self.model = "openai/gpt-oss-20b:groq"
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")

    async def grade_exam(self, request: GradingRequest) -> GradingResponse:
        """
        Grade an exam submission using LLM
        
        Args:
            request: GradingRequest containing exam text and grading parameters
            
        Returns:
            GradingResponse with score, feedback, and detailed breakdown
        """
        try:
            prompt = self._build_grading_prompt(request)
            print(f"[DEBUG] Sending grading request to AI...", flush=True)
            print(f"[DEBUG] Exam text length: {len(request.exam_text)}", flush=True)
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert teacher and grader. Your task is to grade exam submissions fairly and provide constructive feedback. Always return your response in JSON format."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,  # Lower temperature for more consistent grading
                max_tokens=1000,
            )
            
            response_content = completion.choices[0].message.content or ""
            print(f"[DEBUG] AI response received, length: {len(response_content)}", flush=True)
            return self._parse_grading_response(response_content, request.max_score)
            
        except Exception as e:
            print(f"[ERROR] Error grading exam: {e}", flush=True)
            import traceback
            traceback.print_exc()
            # Return a fallback response instead of raising exception
            return GradingResponse(
                score=0.0,
                max_score=request.max_score,
                feedback=f"Grading failed: {str(e)}",
                breakdown=[]
            )

    def _build_grading_prompt(self, request: GradingRequest) -> str:
        """Build the grading prompt for the LLM"""
        prompt = f"""Please grade the following exam submission and provide detailed feedback.

EXAM SUBMISSION:
{request.exam_text}

"""
        
        if request.answer_key:
            prompt += f"""ANSWER KEY:
{request.answer_key}

"""
        
        if request.rubric:
            prompt += f"""GRADING RUBRIC:
{request.rubric}

"""
        
        prompt += f"""INSTRUCTIONS:
- Grade the submission out of {request.max_score} points
- Provide specific feedback for each answer
- Highlight strengths and areas for improvement
- Be fair and constructive in your evaluation

Please return your response in the following JSON format:
{{
  "score": <total_score>,
  "maxScore": {request.max_score},
  "feedback": "<overall_feedback>",
  "breakdown": [
    {{
      "question": "<question_text>",
      "score": <points_earned>,
      "maxScore": <points_possible>,
      "feedback": "<specific_feedback>"
    }}
  ]
}}"""
        
        return prompt

    def _parse_grading_response(self, content: str, max_score: float) -> GradingResponse:
        """Parse the LLM response and extract grading information"""
        print(f"[DEBUG] Raw AI response:\n{content[:500]}...", flush=True)
        
        try:
            # Try to extract JSON from the response
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            
            print(f"[DEBUG] JSON found at indices {start_idx} to {end_idx}", flush=True)
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                print(f"[DEBUG] Extracted JSON: {json_str[:300]}...", flush=True)
                
                # Try to fix common JSON issues
                try:
                    parsed = json.loads(json_str)
                except json.JSONDecodeError:
                    # Try fixing escaped quotes and newlines in strings
                    import re
                    # Replace problematic escape sequences
                    fixed_json = json_str.replace('\\"', '"').replace('\n', ' ')
                    # Try again with fixed JSON
                    try:
                        parsed = json.loads(fixed_json)
                    except json.JSONDecodeError:
                        # Last resort: extract just score and feedback using regex
                        score_match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', json_str)
                        feedback_match = re.search(r'"feedback"\s*:\s*"([^"]+)"', json_str)
                        
                        score = float(score_match.group(1)) if score_match else 0.0
                        feedback = feedback_match.group(1) if feedback_match else "Could not parse full feedback"
                        
                        return GradingResponse(
                            score=score,
                            max_score=max_score,
                            feedback=feedback,
                            breakdown=[]
                        )
                
                breakdown = []
                if 'breakdown' in parsed:
                    for item in parsed['breakdown']:
                        breakdown.append(QuestionBreakdown(
                            question=item.get('question', ''),
                            score=float(item.get('score', 0)),
                            max_score=float(item.get('maxScore', 0)),
                            feedback=item.get('feedback', '')
                        ))
                
                return GradingResponse(
                    score=float(parsed.get('score', 0)),
                    max_score=float(parsed.get('maxScore', max_score)),
                    feedback=parsed.get('feedback', 'No feedback provided'),
                    breakdown=breakdown
                )
            
            # If no JSON found, create a basic response with the raw content as feedback
            print(f"[DEBUG] No valid JSON found in response", flush=True)
            return GradingResponse(
                score=0.0,
                max_score=max_score,
                feedback=f"AI Response (unparsed): {content[:500]}" if content else 'No response from AI',
                breakdown=[]
            )
            
        except json.JSONDecodeError as e:
            print(f"[DEBUG] JSON parse error: {e}", flush=True)
            return GradingResponse(
                score=0.0,
                max_score=max_score,
                feedback=f"JSON parse error. Raw response: {content[:300]}",
                breakdown=[]
            )
        except Exception as e:
            print(f"Error parsing grading response: {e}", flush=True)
            return GradingResponse(
                score=0.0,
                max_score=max_score,
                feedback=f'Error parsing response: {str(e)}',
                breakdown=[]
            )

    async def grade_structured_exam(self, exam_request: ExamGradingRequest) -> ExamGradingResult:
        """Grade a structured exam with individual questions"""
        try:
            question_results = []
            total_max_marks = 0
            total_awarded_marks = 0
            
            for question in exam_request.questions:
                # Grade each question individually
                question_result = await self._grade_individual_question(
                    question, 
                    rubric_criteria=exam_request.rubric_criteria,
                    test_questions=exam_request.test_questions
                )
                question_results.append(question_result)
                
                total_max_marks += question.max_marks
                total_awarded_marks += question_result.awarded_marks
            
            # Calculate overall percentage
            overall_percentage = (total_awarded_marks / total_max_marks * 100) if total_max_marks > 0 else 0
            
            # Generate overall feedback
            overall_feedback = self._generate_overall_feedback(overall_percentage, question_results)
            
            return ExamGradingResult(
                total_questions=len(question_results),
                total_max_marks=total_max_marks,
                total_awarded_marks=total_awarded_marks,
                overall_percentage=round(overall_percentage, 2),
                overall_feedback=overall_feedback,
                question_results=question_results
            )
            
        except Exception as e:
            print(f"Error grading structured exam: {e}")
            # Return a fallback response with error information
            return ExamGradingResult(
                total_questions=len(exam_request.questions),
                total_max_marks=sum(q.max_marks for q in exam_request.questions),
                total_awarded_marks=0.0,
                overall_percentage=0.0,
                overall_feedback=f"Grading failed: {str(e)}",
                question_results=[
                    QuestionGradingResult(
                        question_number=q.question_number,
                        question=q.question,
                        student_answer=q.student_answer,
                        max_marks=q.max_marks,
                        awarded_marks=0.0,
                        feedback="Grading failed due to system error",
                        percentage=0.0
                    ) for q in exam_request.questions
                ]
            )

    async def _grade_individual_question(
        self, 
        question: ExamQuestion, 
        rubric_criteria: Optional[str] = None, 
        test_questions: Optional[List[str]] = None
    ) -> QuestionGradingResult:
        """Grade an individual question"""
        try:
            # Build the grading criteria section
            criteria_section = ""
            if rubric_criteria:
                criteria_section = f"\nRUBRIC CRITERIA:\n{rubric_criteria}\n"
            elif test_questions:
                criteria_section = f"\nTEST CONTEXT: This question is part of a structured test.\n"
            
            prompt = f"""Please grade the following question and student answer. Provide a score and brief feedback.

QUESTION: {question.question}
STUDENT ANSWER: {question.student_answer}
MAX MARKS: {question.max_marks}
QUESTION TYPE: {question.question_type}{criteria_section}
Please provide your response in the following JSON format:
{{
  "awarded_marks": <points_awarded>,
  "feedback": "<specific_feedback>",
  "reasoning": "<brief_explanation>"
}}

Grading Guidelines:
- Be fair and consistent
- Consider partial credit for partially correct answers
- Provide constructive feedback
- Award marks between 0 and {question.max_marks}
{f"- Follow the provided rubric criteria above when grading" if rubric_criteria else ""}"""

            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert teacher grading exam questions. Be fair, consistent, and provide constructive feedback."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.2,  # Lower temperature for consistency
                max_tokens=300,
                timeout=30  # 30 second timeout
            )
            
            response_content = completion.choices[0].message.content or ""
            result = self._parse_question_grading_response(response_content, question)
            
            return result
            
        except Exception as e:
            print(f"Error grading question {question.question_number}: {e}")
            # Return a default result in case of error
            return QuestionGradingResult(
                question_number=question.question_number,
                question=question.question,
                student_answer=question.student_answer,
                max_marks=question.max_marks,
                awarded_marks=0.0,
                feedback="Unable to grade this question due to an error.",
                percentage=0.0
            )

    def _parse_question_grading_response(self, content: str, question: ExamQuestion) -> QuestionGradingResult:
        """Parse the grading response for an individual question"""
        try:
            # Try to extract JSON from the response
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            
            awarded_marks = 0.0
            feedback = "No feedback provided"
            
            if start_idx != -1 and end_idx != 0:
                json_str = content[start_idx:end_idx]
                parsed = json.loads(json_str)
                awarded_marks = float(parsed.get('awarded_marks', 0))
                feedback = parsed.get('feedback', 'No feedback provided')
                
                # Ensure awarded marks don't exceed max marks
                awarded_marks = min(awarded_marks, question.max_marks)
                awarded_marks = max(awarded_marks, 0)  # Ensure not negative
            
            percentage = (awarded_marks / question.max_marks * 100) if question.max_marks > 0 else 0
            
            return QuestionGradingResult(
                question_number=question.question_number,
                question=question.question,
                student_answer=question.student_answer,
                max_marks=question.max_marks,
                awarded_marks=awarded_marks,
                feedback=feedback,
                percentage=round(percentage, 2)
            )
            
        except Exception as e:
            print(f"Error parsing grading response: {e}")
            return QuestionGradingResult(
                question_number=question.question_number,
                question=question.question,
                student_answer=question.student_answer,
                max_marks=question.max_marks,
                awarded_marks=0.0,
                feedback="Error parsing grading response",
                percentage=0.0
            )

    def _generate_overall_feedback(self, percentage: float, question_results: List[QuestionGradingResult]) -> str:
        """Generate overall feedback based on performance"""
        if percentage >= 90:
            return f"Excellent performance! You scored {percentage:.1f}%. Keep up the great work."
        elif percentage >= 80:
            return f"Good job! You scored {percentage:.1f}%. Review the areas where you lost marks for improvement."
        elif percentage >= 70:
            return f"Satisfactory performance with {percentage:.1f}%. Focus on understanding the concepts better."
        elif percentage >= 60:
            return f"You scored {percentage:.1f}%. There's room for improvement. Please review the material."
        else:
            return f"You scored {percentage:.1f}%. Consider seeking additional help and reviewing the fundamentals."

    async def test_connection(self) -> bool:
        """Test the LLM connection"""
        if not OpenAI or not hasattr(self, 'client'):
            print("OpenAI client not available")
            return False
        
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": "What is the capital of France?"
                    }
                ],
                max_tokens=50,
                timeout=10  # 10 second timeout for connection test
            )
            
            return (completion.choices[0].message.content or "") != ""
            
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False

# Create global instance with error handling
def get_grading_service() -> Optional[GradingService]:
    """Get grading service instance, creating it if needed"""
    try:
        return GradingService()
    except Exception as e:
        print(f"Warning: Could not initialize grading service: {e}")
        return None

# Initialize service lazily
grading_service = None