import React from 'react';
import { Box, Typography } from '@mui/material';
import Logo from '../../components/ui/Logo';
import { GREY, PRIMARY } from '../../themes/index';

export default function DrawerHeader({ open }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: open ? 3 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        minHeight: 60,
        borderBottom: `1px solid ${GREY.A800}`,
        flexShrink: 0,
      }}
    >
      <Logo size={32} />
      {open && (
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
          }}
        >
          Twiligent
        </Typography>
      )}
    </Box>
  );
}
