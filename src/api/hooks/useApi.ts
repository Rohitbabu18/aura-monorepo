import { useCallback, useState } from 'react';
import { ApiError, ApiRequestOptions, apiRequest, ApiResponse } from '../client';

const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const request = useCallback(
    async <T = unknown>(
      path: string,
      options?: ApiRequestOptions
    ): Promise<ApiResponse<T>> => {
      setLoading(true);
      setError(null);
      try {
        return await apiRequest<T>(path, options);
      } catch (err) {
        setError(err as ApiError);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { request, loading, error, setError };
};

export default useApi;
