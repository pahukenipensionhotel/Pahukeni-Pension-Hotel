import { useState, useCallback } from "react";

/**
 * A custom hook to handle form submission with idempotency protection.
 * Prevents multiple clicks while an operation is in progress.
 */
export const useFormSubmission = (submitFn: (e: React.FormEvent) => Promise<void>) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      if (isSubmitting) return; // Prevent double submission

      e.preventDefault();
      setIsSubmitting(true);

      try {
        await submitFn(e);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, submitFn]
  );

  return { handleSubmit, isSubmitting };
};
