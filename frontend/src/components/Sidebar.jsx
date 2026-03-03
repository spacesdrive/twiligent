import React from 'react';
import {
    Drawer, Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
    Avatar, Divider, Chip,
} from '@mui/material';
import {
    Dashboard as DashboardIcon, YouTube as YouTubeIcon, ManageAccounts,
    Settings, TrendingUp, PlaylistPlay, ContentCut, Instagram, CloudUpload,
} from '@mui/icons-material';
import Logo from './Logo';

const DRAWER_WIDTH = 260;

const NAV = [
    { id: 'overview', label: 'Overview', icon: <DashboardIcon /> },
    { id: 'videos', label: 'All Videos', icon: <PlaylistPlay /> },
    { id: 'shorts', label: 'All Shorts', icon: <ContentCut /> },
    { id: 'reels', label: 'IG Content', icon: <Instagram /> },
    { id: 'upload', label: 'Upload', icon: <CloudUpload /> },
    { id: 'accounts', label: 'Accounts', icon: <ManageAccounts /> },
    { id: 'settings', label: 'Settings', icon: <Settings /> },
];

export default function Sidebar({ tab, setTab, accounts, onViewChannel }) {
    return (
        <Drawer variant="permanent" sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}>
            {/* Logo */}
            <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Logo size={40} />
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                        Social Analytics
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, letterSpacing: '0.5px' }}>
                        Dashboard Pro
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Nav */}
            <List sx={{ px: 1.5, py: 2 }}>
                {NAV.map(item => (
                    <ListItemButton key={item.id} selected={tab === item.id}
                        onClick={() => setTab(item.id)}
                        sx={{
                            borderRadius: 2, mb: 0.5, py: 1.2,
                            '&.Mui-selected': { bgcolor: 'rgba(255,0,0,0.08)', '&:hover': { bgcolor: 'rgba(255,0,0,0.12)' } },
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                        }}>
                        <ListItemIcon sx={{ minWidth: 40, color: tab === item.id ? 'primary.main' : 'text.secondary' }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label}
                            primaryTypographyProps={{ fontSize: 14, fontWeight: tab === item.id ? 600 : 400 }} />
                    </ListItemButton>
                ))}
            </List>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 2 }} />

            {/* Channels Quick Access */}
            <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>
                    Accounts
                </Typography>
            </Box>
            <List sx={{ px: 1.5, flex: 1, overflow: 'auto' }}>
                {accounts.length === 0 ? (
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', py: 2, px: 1 }}>
                        No accounts added yet
                    </Typography>
                ) : (
                    accounts.map(acc => (
                        <ListItemButton key={acc.id}
                            selected={tab === 'channel' || tab === 'ig-analytics'}
                            onClick={() => onViewChannel(acc)}
                            sx={{
                                borderRadius: 2, mb: 0.5, py: 0.8,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                            }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <Avatar src={acc.thumbnail || acc.thumbnails?.default || acc.thumbnailUrl || acc.profilePictureUrl || ''}
                                    sx={{ width: 28, height: 28 }}>
                                    {acc.platform === 'instagram' ? <Instagram sx={{ fontSize: 16 }} /> : <YouTubeIcon sx={{ fontSize: 16 }} />}
                                </Avatar>
                            </ListItemIcon>
                            <ListItemText primary={acc.title}
                                primaryTypographyProps={{ fontSize: 13, fontWeight: 500, noWrap: true }} />
                            {acc.platform === 'instagram' && (
                                <Instagram sx={{ fontSize: 14, color: '#DD2A7B', ml: 0.5 }} />
                            )}
                        </ListItemButton>
                    ))
                )}
            </List>

            {/* Footer */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip icon={<YouTubeIcon />} label={`${accounts.filter(a => a.platform !== 'instagram').length} YT`}
                        size="small" variant="outlined"
                        sx={{ flex: 1, justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.1)', fontSize: 11 }} />
                    <Chip icon={<Instagram />} label={`${accounts.filter(a => a.platform === 'instagram').length} IG`}
                        size="small" variant="outlined"
                        sx={{ flex: 1, justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.1)', fontSize: 11 }} />
                </Box>
            </Box>
        </Drawer>
    );
}
