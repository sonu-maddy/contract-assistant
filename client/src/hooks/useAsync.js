import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync(asyncFunction, { immediate = true } = {}) {
  const functionRef = useRef(asyncFunction);

  functionRef.current = asyncFunction;

  const [state, setState] = useState({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async (...args) => {
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const data = await functionRef.current(...args);

      setState({
        data,
        loading: false,
        error: null,
      });

      return data;
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error,
      });

      throw error;
    }
  }, []);

  useEffect(() => {
    if (!immediate) {
      return;
    }

    execute().catch(() => {});
  }, [execute, immediate]);

  return {
    ...state,
    execute,
  };
}