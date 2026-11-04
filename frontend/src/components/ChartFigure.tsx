import React, { useId } from 'react';

export interface ChartFigureProps {
  // the chart's name for screen readers, usually its title
  label?: string;
  // the takeaway in words, computed from the data
  description?: string;
  className?: string;
  children: React.ReactNode;
}

// a plot is a picture to a screen reader, so the figure carries its name and a hidden description of what it shows
export default function ChartFigure({ label, description, className, children }: ChartFigureProps) {
  const descriptionId = useId();
  return (
    <figure aria-label={label} aria-describedby={description ? descriptionId : undefined} className={className}>
      {description && <p id={descriptionId} className="sr-only">{description}</p>}
      {children}
    </figure>
  );
}
