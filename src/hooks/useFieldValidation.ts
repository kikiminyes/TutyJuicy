import { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react';
import useDebounce from './useDebounce';
import type { ValidationResult } from '../utils/validation';

type ValidatorFn<T> = (value: T) => ValidationResult | Promise<ValidationResult>;

export default function useFieldValidation<T = string>(
  value: T,
  validator: ValidatorFn<T>,
  delay = 300
) {
  const debounced = useDebounce(value, delay);
  const mounted = useRef(true);

  const [touched, setTouched] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsValidating(true);
      try {
        const result = await validator(debounced as T);
        if (cancelled || !mounted.current) return;
        setIsValid(result.isValid);
        setError(result.error);
      } catch (err) {
        if (cancelled || !mounted.current) return;
        setIsValid(false);
        setError((err as Error)?.message || 'Invalid');
      } finally {
        if (!cancelled && mounted.current) setIsValidating(false);
      }
    }

    run();

    return () => { cancelled = true; };
  }, [debounced, validator]);

  const markTouched: Dispatch<SetStateAction<boolean>> = (v) => setTouched((prev) => typeof v === 'function' ? (v as any)(prev) : v as boolean);

  return {
    touched,
    markTouched,
    isValidating,
    isValid,
    error: touched ? error : undefined
  } as const;
}
