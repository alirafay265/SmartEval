import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useGrading } from '../hooks/useGrading';
import { GradingResponse } from '../services/gradingService';

interface ExamGradingProps {
  examText?: string;
  onGradingComplete?: (result: GradingResponse) => void;
}

export const ExamGrading: React.FC<ExamGradingProps> = ({
  examText: initialExamText = '',
  onGradingComplete,
}) => {
  const [examText, setExamText] = useState(initialExamText);
  const [answerKey, setAnswerKey] = useState('');
  const [rubric, setRubric] = useState('');
  const [maxScore, setMaxScore] = useState(100);

  const { gradeExam, testConnection, isGrading, gradingResult, error } = useGrading({
    onSuccess: (result) => {
      onGradingComplete?.(result);
    },
  });

  const handleGradeExam = async () => {
    if (!examText.trim()) {
      return;
    }

    await gradeExam({
      examText: examText.trim(),
      answerKey: answerKey.trim() || undefined,
      rubric: rubric.trim() || undefined,
      maxScore,
    });
  };

  const handleTestConnection = async () => {
    const isConnected = await testConnection();
    if (isConnected) {
      alert('✅ Connection to LLM service successful!');
    } else {
      alert('❌ Connection to LLM service failed. Please check your API key.');
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 80) return 'bg-blue-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI-Powered Exam Grading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="examText">Exam Submission*</Label>
            <Textarea
              id="examText"
              value={examText}
              onChange={(e) => setExamText(e.target.value)}
              placeholder="Paste the exam submission text here..."
              rows={8}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="answerKey">Answer Key (Optional)</Label>
              <Textarea
                id="answerKey"
                value={answerKey}
                onChange={(e) => setAnswerKey(e.target.value)}
                placeholder="Provide the correct answers..."
                rows={4}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="rubric">Grading Rubric (Optional)</Label>
              <Textarea
                id="rubric"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="Describe the grading criteria..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>

          <div className="w-full md:w-48">
            <Label htmlFor="maxScore">Maximum Score</Label>
            <Input
              id="maxScore"
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              min={1}
              max={1000}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleGradeExam}
              disabled={isGrading || !examText.trim()}
              className="flex-1"
            >
              {isGrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Grading Exam...
                </>
              ) : (
                'Grade Exam'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isGrading}
            >
              Test Connection
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {gradingResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Grading Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">
                {gradingResult.score}/{gradingResult.maxScore}
              </div>
              <Badge 
                className={`${getScoreColor(gradingResult.score, gradingResult.maxScore)} text-white`}
              >
                {Math.round((gradingResult.score / gradingResult.maxScore) * 100)}%
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Overall Feedback</h4>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">{gradingResult.feedback}</p>
              </div>
            </div>

            {gradingResult.breakdown && gradingResult.breakdown.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Question Breakdown</h4>
                <div className="space-y-3">
                  {gradingResult.breakdown.map((item, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-sm">{item.question}</p>
                          <Badge variant="outline">
                            {item.score}/{item.maxScore}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{item.feedback}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExamGrading;