import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar, useMediaQuery } from '@mui/material';
import MainDrawer, { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from './Drawer/index';
import Header from './Header/index';

export default function MainLayout() {
  const isMobile = useMediaQuery('(max-width:1024px)');
  const [drawerOpen, setDrawerOpen] = useState(true);

  const toggleDrawer = () => setDrawerOpen(prev => !prev);

  const contentMargin = isMobile ? 0 : (drawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <MainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: isMobile ? 0 : `${contentMargin}px`,
          transition: 'margin-left 0.2s ease',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header drawerOpen={drawerOpen} onToggleDrawer={toggleDrawer} />

        {/* Offset for fixed header */}
        <Toolbar sx={{ minHeight: '60px !important', flexShrink: 0 }} />

        {/* Page content */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3 },
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
