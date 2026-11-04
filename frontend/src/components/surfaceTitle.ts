import { createContext, useContext } from 'react';

// the id of the nearest SurfaceBox title, so a table inside can take its accessible name from it
export const SurfaceTitleContext = createContext<string | undefined>(undefined);

export function useSurfaceTitleId(): string | undefined {
  return useContext(SurfaceTitleContext);
}
