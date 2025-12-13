/**
 * LLM-based grading service using Hugging Face API
 * This service handles automated grading of exam submissions using AI
 */

interface GradingRequest {
  examText: string;
  answerKey?: string;
  rubric?: string;
  maxScore?: number;
}

interface GradingResponse {
  score: number;
  maxScore: number;
  feedback: string;
  breakdown?: {
    question: string;
    score: number;
    maxScore: number;
    feedback: string;
  }[];
}

class GradingService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.HUGGING_FACE_API_KEY || '';
    this.baseUrl = "https://router.huggingface.co/v1";
    this.model = "openai/gpt-oss-20b:groq";
    
    if (!this.apiKey) {
      console.warn('Hugging Face API key not found in environment variables');
    }
  }

  /**
   * Initialize the OpenAI client for Hugging Face
   */
  private async createClient() {
    // Note: This is a TypeScript/frontend implementation
    // For actual usage, you might want to implement this on the backend
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response;
  }

  /**
   * Grade an exam submission using LLM
   */
  async gradeExam(request: GradingRequest): Promise<GradingResponse> {
    try {
      const prompt = this.buildGradingPrompt(request);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are an expert teacher and grader. Your task is to grade exam submissions fairly and provide constructive feedback. Always return your response in JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent grading
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the LLM response and extract grading information
      return this.parseGradingResponse(content, request.maxScore || 100);
      
    } catch (error) {
      console.error('Error grading exam:', error);
      throw new Error('Failed to grade exam submission');
    }
  }

  /**
   * Build the grading prompt for the LLM
   */
  private buildGradingPrompt(request: GradingRequest): string {
    let prompt = `Please grade the following exam submission and provide detailed feedback.

EXAM SUBMISSION:
${request.examText}

`;

    if (request.answerKey) {
      prompt += `ANSWER KEY:
${request.answerKey}

`;
    }

    if (request.rubric) {
      prompt += `GRADING RUBRIC:
${request.rubric}

`;
    }

    prompt += `INSTRUCTIONS:
- Grade the submission out of ${request.maxScore || 100} points
- Provide specific feedback for each answer
- Highlight strengths and areas for improvement
- Be fair and constructive in your evaluation

Please return your response in the following JSON format:
{
  "score": <total_score>,
  "maxScore": ${request.maxScore || 100},
  "feedback": "<overall_feedback>",
  "breakdown": [
    {
      "question": "<question_text>",
      "score": <points_earned>,
      "maxScore": <points_possible>,
      "feedback": "<specific_feedback>"
    }
  ]
}`;

    return prompt;
  }

  /**
   * Parse the LLM response and extract grading information
   */
  private parseGradingResponse(content: string, maxScore: number): GradingResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score || 0,
          maxScore: parsed.maxScore || maxScore,
          feedback: parsed.feedback || 'No feedback provided',
          breakdown: parsed.breakdown || [],
        };
      }
      
      // If no JSON found, create a basic response
      return {
        score: 0,
        maxScore,
        feedback: content || 'Unable to parse grading response',
        breakdown: [],
      };
    } catch (error) {
      console.error('Error parsing grading response:', error);
      return {
        score: 0,
        maxScore,
        feedback: 'Error parsing grading response',
        breakdown: [],
      };
    }
  }

  /**
   * Test the LLM connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: "What is the capital of France?"
            }
          ],
          max_tokens: 50,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

export const gradingService = new GradingService();
export type { GradingRequest, GradingResponse };