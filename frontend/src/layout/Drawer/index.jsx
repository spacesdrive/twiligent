import React from 'react';
import { Drawer, Box, useMediaQuery } from '@mui/material';
import DrawerHeader from './DrawerHeader';
import Navigation from './Navigation';
import { GREY } from '../../themes/index';

export const DRAWER_WIDTH = 260;
export const MINI_DRAWER_WIDTH = 72;

export default function MainDrawer({ open, onClose }) {
  const isMobile = useMediaQuery('(max-width:1024px)');

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DrawerHeader open={!isMobile ? open : true} />
      <Navigation open={!isMobile ? open : true} />
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${GREY.A800}`,
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
          borderRight: `1px solid ${GREY.A800}`,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
