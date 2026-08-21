import { useEffect, useState } from "react";

/**
 * Debounce a value by `delay` ms. Returns the stale value until the timer
 * fires, then updates to the latest value. Useful for search inputs that
 * trigger expensive filtering or API calls.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
