import { useState, useCallback } from 'react';
import { gradingService, GradingRequest, GradingResponse } from '../services/gradingService';

interface UseGradingOptions {
  onSuccess?: (result: GradingResponse) => void;
  onError?: (error: string) => void;
}

export const useGrading = (options: UseGradingOptions = {}) => {
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gradeExam = useCallback(async (request: GradingRequest) => {
    setIsGrading(true);
    setError(null);
    setGradingResult(null);

    try {
      const result = await gradingService.gradeExam(request);
      setGradingResult(result);
      options.onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setIsGrading(false);
    }
  }, [options]);

  const testConnection = useCallback(async () => {
    try {
      const isConnected = await gradingService.testConnection();
      return isConnected;
    } catch (err) {
      console.error('Connection test failed:', err);
      return false;
    }
  }, []);

  const clearResults = useCallback(() => {
    setGradingResult(null);
    setError(null);
  }, []);

  return {
    gradeExam,
    testConnection,
    clearResults,
    isGrading,
    gradingResult,
    error,
  };
};