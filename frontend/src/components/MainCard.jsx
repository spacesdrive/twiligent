import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function MainCard({
  children,
  title,
  subheader,
  secondary,
  content = true,
  contentClassName = '',
  className = '',
  noPadding = false,
  ...props
}) {
  return (
    <Card className={cn('border border-border shadow-none', className)} {...props}>
      {title && (
        <>
          <CardHeader className="px-5 py-4 flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {subheader && (
                <p className="text-xs text-muted-foreground mt-0.5">{subheader}</p>
              )}
            </div>
            {secondary && <div className="flex-shrink-0">{secondary}</div>}
          </CardHeader>
          <Separator />
        </>
      )}
      {content ? (
        <CardContent className={cn('px-5 py-4', noPadding && 'p-0', contentClassName)}>
          {children}
        </CardContent>
      ) : (
        children
      )}
    </Card>
  );
}
