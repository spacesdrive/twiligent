import { createContext, useContext } from 'react';

// true inside a metric tile, where a changed number rolls to its new value; tables and lists keep theirs still
export const RollingValueContext = createContext(false);

export function useRollingValue(): boolean {
  return useContext(RollingValueContext);
}
