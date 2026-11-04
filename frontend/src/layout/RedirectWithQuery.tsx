import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export interface RedirectWithQueryProps {
  to: string;
}

// an old address keeps working, with its filters and tabs, after a page moves
export default function RedirectWithQuery({ to }: RedirectWithQueryProps) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}
