import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Box, IconButton, Typography,
  Breadcrumbs, Link, useMediaQuery, Tooltip, Avatar, Badge,
} from '@mui/material';
import {
  MenuOpen, Menu as MenuIcon, Refresh,
  NavigateNext, Notifications, Settings,
} from '@mui/icons-material';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from '../Drawer/index';
import { useAppContext } from '../../context/AppContext';
import { GREY, PRIMARY } from '../../themes/index';

const BREADCRUMB_MAP = {
  '/':          { label: 'Overview',    parent: null },
  '/videos':    { label: 'All Videos',  parent: 'Analytics' },
  '/shorts':    { label: 'Shorts',      parent: 'Analytics' },
  '/reels':     { label: 'IG Content',  parent: 'Analytics' },
  '/upload':    { label: 'Publish',     parent: 'Publishing' },
  '/accounts':  { label: 'Accounts',   parent: 'Management' },
  '/settings':  { label: 'Settings',   parent: 'Management' },
};

export default function Header({ drawerOpen, onToggleDrawer }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:1024px)');
  const { loading, refreshAll } = useAppContext();

  const drawerWidth = drawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH;

  // resolve breadcrumb for dynamic routes like /channel/:id and /instagram/:id
  let pathname = location.pathname;
  let crumb = BREADCRUMB_MAP[pathname];
  if (!crumb && pathname.startsWith('/channel/')) {
    crumb = { label: 'Channel Analytics', parent: 'Analytics' };
  } else if (!crumb && pathname.startsWith('/instagram/')) {
    crumb = { label: 'Instagram Analytics', parent: 'Analytics' };
  }

  return (
    <AppBar
      position="fixed"
      sx={{
        width: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
        ml: isMobile ? 0 : `${drawerWidth}px`,
        transition: 'width 0.2s ease, margin-left 0.2s ease',
        zIndex: 1200,
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${GREY.A800}`,
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ minHeight: '60px !important', px: { xs: 2, sm: 3 }, gap: 2 }}>
        {/* Drawer toggle */}
        <IconButton
          onClick={onToggleDrawer}
          edge="start"
          size="small"
          sx={{
            color: 'text.primary',
            bgcolor: drawerOpen ? 'transparent' : GREY[100],
            '&:hover': { bgcolor: GREY[100] },
          }}
        >
          {drawerOpen ? <MenuOpen /> : <MenuIcon />}
        </IconButton>

        {/* Breadcrumbs */}
        <Box sx={{ flex: 1 }}>
          {crumb && (
            <Breadcrumbs
              separator={<NavigateNext fontSize="small" sx={{ color: GREY[400] }} />}
              sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
            >
              <Link
                underline="hover"
                color="text.secondary"
                onClick={() => navigate('/')}
                sx={{ cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
              >
                Dashboard
              </Link>
              {crumb.parent && (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {crumb.parent}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                {crumb.label}
              </Typography>
            </Breadcrumbs>
          )}
        </Box>

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Refresh all accounts">
            <IconButton
              size="small"
              onClick={refreshAll}
              disabled={loading}
              sx={{
                color: loading ? PRIMARY.light : 'text.secondary',
                '&:hover': { bgcolor: GREY[100] },
              }}
            >
              <Refresh sx={{ fontSize: 20, ...(loading && { animation: 'spin 1s linear infinite' }) }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              size="small"
              onClick={() => navigate('/settings')}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: GREY[100] } }}
            >
              <Settings sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              ml: 0.5,
              bgcolor: PRIMARY.main,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            T
          </Avatar>
        </Box>
      </Toolbar>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppBar>
  );
}
