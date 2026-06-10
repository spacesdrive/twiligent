import React from 'react';
import { Card, CardContent, CardHeader, Divider, Typography } from '@mui/material';
import { GREY, PRIMARY } from '../themes/index';

export default function MainCard({
  border = true,
  boxShadow = false,
  children,
  subheader,
  content = true,
  contentSX = {},
  darkTitle = false,
  divider = true,
  elevation,
  secondary,
  shadow,
  sx = {},
  title,
  modal = false,
  ...others
}) {
  return (
    <Card
      elevation={elevation ?? 0}
      sx={{
        position: 'relative',
        border: border ? `1px solid ${GREY.A800}` : 'none',
        borderRadius: 2,
        boxShadow: boxShadow
          ? shadow || '0 1px 4px rgba(0,0,0,0.08)'
          : 'none',
        ':hover': {
          boxShadow: boxShadow
            ? shadow || '0 4px 12px rgba(0,0,0,0.12)'
            : 'none',
        },
        ...(modal && {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 'calc(100% - 50px)', sm: 'auto' },
          maxWidth: 768,
        }),
        ...sx,
      }}
      {...others}
    >
      {title && (
        <CardHeader
          sx={{ p: 2.5 }}
          title={
            <Typography variant={darkTitle ? 'h4' : 'subtitle1'} sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          }
          action={secondary}
          subheader={subheader && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subheader}
            </Typography>
          )}
        />
      )}

      {title && divider && <Divider />}

      {content ? (
        <CardContent sx={{ p: 2.5, ...contentSX }}>{children}</CardContent>
      ) : (
        children
      )}
    </Card>
  );
}
