import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { immediate = true } = options;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.get(url);
      setData(result.data);
      return result.data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate) fetchData();
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData, setData };
}

export default useApi;
