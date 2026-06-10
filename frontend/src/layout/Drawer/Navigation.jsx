import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Tooltip,
} from '@mui/material';
import {
  Dashboard, YouTube, Subscriptions, ContentCut,
  Instagram, CloudUpload, ManageAccounts, Settings,
} from '@mui/icons-material';
import { useAppContext } from '../../context/AppContext';
import { PRIMARY, GREY } from '../../themes/index';

const DRAWER_WIDTH = 260;

const NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [
      { path: '/',        label: 'Overview',    icon: <Dashboard /> },
      { path: '/videos',  label: 'All Videos',  icon: <Subscriptions /> },
      { path: '/shorts',  label: 'Shorts',      icon: <ContentCut /> },
      { path: '/reels',   label: 'IG Content',  icon: <Instagram /> },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { path: '/upload',   label: 'Publish',  icon: <CloudUpload /> },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/accounts', label: 'Accounts', icon: <ManageAccounts /> },
      { path: '/settings', label: 'Settings', icon: <Settings /> },
    ],
  },
];

function NavItem({ item, open }) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === item.path;

  const button = (
    <ListItemButton
      selected={active}
      onClick={() => navigate(item.path)}
      sx={{
        borderRadius: 1.5,
        mb: 0.5,
        px: open ? 2 : 1.5,
        py: 1,
        justifyContent: open ? 'flex-start' : 'center',
        minHeight: 40,
        position: 'relative',
        ...(active && {
          bgcolor: PRIMARY.lighter,
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 0,
            top: '20%',
            height: '60%',
            width: 2,
            background: PRIMARY.main,
            borderRadius: '2px 0 0 2px',
          },
        }),
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: open ? 36 : 'auto',
          color: active ? PRIMARY.main : GREY[500],
          '& svg': { fontSize: 20 },
        }}
      >
        {item.icon}
      </ListItemIcon>
      {open && (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: '0.875rem',
            fontWeight: active ? 600 : 400,
            color: active ? PRIMARY.main : 'text.primary',
          }}
        />
      )}
    </ListItemButton>
  );

  if (!open) {
    return <Tooltip title={item.label} placement="right">{button}</Tooltip>;
  }
  return button;
}

export default function Navigation({ open }) {
  const { accounts } = useAppContext();
  const navigate = useNavigate();

  const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
  const igAccounts = accounts.filter(a => a.platform === 'instagram');

  return (
    <Box sx={{ flex: 1, overflow: 'auto', px: open ? 1.5 : 1, py: 1.5 }}>
      {NAV_GROUPS.map((group, gi) => (
        <Box key={gi} sx={{ mb: 1 }}>
          {open && (
            <Typography
              sx={{
                px: 1, mb: 0.75,
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {group.label}
            </Typography>
          )}
          <List disablePadding>
            {group.items.map(item => (
              <NavItem key={item.path} item={item} open={open} />
            ))}
          </List>
          {gi < NAV_GROUPS.length - 1 && (
            <Divider sx={{ my: 1.5 }} />
          )}
        </Box>
      ))}

      {/* Accounts quick list */}
      {open && accounts.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography
            sx={{
              px: 1, mb: 0.75,
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            Accounts
          </Typography>
          <List disablePadding>
            {accounts.map(acc => {
              const isIG = acc.platform === 'instagram';
              const path = isIG ? `/instagram/${acc.id}` : `/channel/${acc.id}`;
              return (
                <ListItemButton
                  key={acc.id}
                  onClick={() => navigate(path)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.3,
                    px: 1.5,
                    py: 0.75,
                    '&:hover': { bgcolor: GREY[100] },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <Avatar
                      src={acc.thumbnail || acc.profilePictureUrl || acc.thumbnails?.default || ''}
                      sx={{
                        width: 24,
                        height: 24,
                        fontSize: '0.6rem',
                        bgcolor: isIG ? '#E1306C' : '#FF0000',
                        border: 'none',
                      }}
                    >
                      {isIG ? <Instagram sx={{ fontSize: 12 }} /> : <YouTube sx={{ fontSize: 12 }} />}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={acc.title}
                    primaryTypographyProps={{
                      fontSize: '0.8rem',
                      fontWeight: 400,
                      noWrap: true,
                      color: 'text.primary',
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </>
      )}
    </Box>
  );
}
