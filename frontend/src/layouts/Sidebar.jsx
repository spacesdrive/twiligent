import React from 'react';
// React is used for React.cloneElement in NAV item icon rendering
import {
    Drawer, Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
    Avatar, Divider, Chip,
} from '@mui/material';
import {
    Dashboard as DashboardIcon, YouTube as YouTubeIcon, ManageAccounts,
    Settings, PlaylistPlay, ContentCut, Instagram, CloudUpload,
} from '@mui/icons-material';
import Logo from '../components/ui/Logo';

const DRAWER_WIDTH = 256;

const NAV = [
    { id: 'overview',  label: 'Overview',    icon: <DashboardIcon /> },
    { id: 'videos',    label: 'All Videos',  icon: <PlaylistPlay /> },
    { id: 'shorts',    label: 'All Shorts',  icon: <ContentCut /> },
    { id: 'reels',     label: 'IG Content',  icon: <Instagram /> },
    { id: 'upload',    label: 'Publish',     icon: <CloudUpload /> },
    { id: 'accounts',  label: 'Accounts',    icon: <ManageAccounts /> },
    { id: 'settings',  label: 'Settings',    icon: <Settings /> },
];

export default function Sidebar({ tab, setTab, accounts, onViewChannel }) {
    return (
        <Drawer variant="permanent" sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', overflowX: 'hidden' },
        }}>
            {/* Logo + Brand */}
            <Box sx={{ px: 2.5, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Logo size={36} />
                <Typography sx={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.4px', color: 'text.primary' }}>
                    Twiligent
                </Typography>
            </Box>

            <Divider sx={{ mx: 2, mb: 1 }} />

            {/* Navigation */}
            <Box sx={{ px: 1.5, py: 1 }}>
                <Typography sx={{ px: 1, mb: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>
                    Menu
                </Typography>
                <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                    {NAV.map(item => {
                        const active = tab === item.id;
                        return (
                            <ListItemButton
                                key={item.id}
                                selected={active}
                                onClick={() => setTab(item.id)}
                                sx={{
                                    borderRadius: 2, py: 1.1,
                                    background: active
                                        ? 'linear-gradient(135deg, rgba(255,0,0,0.18) 0%, rgba(255,68,68,0.08) 100%)'
                                        : 'transparent',
                                    border: active ? '1px solid rgba(255,0,0,0.2)' : '1px solid transparent',
                                    '&:hover': {
                                        background: active
                                            ? 'linear-gradient(135deg, rgba(255,0,0,0.22) 0%, rgba(255,68,68,0.12) 100%)'
                                            : 'rgba(255,255,255,0.04)',
                                    },
                                    transition: 'all 0.15s ease',
                                }}>
                                <ListItemIcon sx={{
                                    minWidth: 38,
                                    color: active ? '#FF4444' : '#64748B',
                                    transition: 'color 0.15s',
                                }}>
                                    {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{
                                        fontSize: 13.5,
                                        fontWeight: active ? 700 : 500,
                                        color: active ? 'text.primary' : '#94A3B8',
                                        letterSpacing: '-0.01em',
                                    }}
                                />
                                {active && (
                                    <Box sx={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: '#FF0000',
                                        boxShadow: '0 0 8px rgba(255,0,0,0.7)',
                                    }} />
                                )}
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>

            <Divider sx={{ mx: 2, my: 1.5 }} />

            {/* Accounts Quick Access */}
            <Box sx={{ px: 2, mb: 1 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>
                    Accounts
                </Typography>
            </Box>

            <List sx={{ px: 1.5, flex: 1, overflow: 'auto' }} disablePadding>
                {accounts.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
                            No accounts added yet
                        </Typography>
                    </Box>
                ) : (
                    accounts.map(acc => {
                        const isIG = acc.platform === 'instagram';
                        return (
                            <ListItemButton
                                key={acc.id}
                                onClick={() => onViewChannel(acc)}
                                sx={{
                                    borderRadius: 2, mb: 0.4, py: 0.9,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                                }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Box sx={{ position: 'relative' }}>
                                        <Avatar
                                            src={acc.thumbnail || acc.thumbnails?.default || acc.thumbnailUrl || acc.profilePictureUrl || ''}
                                            sx={{ width: 28, height: 28, border: 'none' }}>
                                            {isIG ? <Instagram sx={{ fontSize: 14 }} /> : <YouTubeIcon sx={{ fontSize: 14 }} />}
                                        </Avatar>
                                        <Box sx={{
                                            position: 'absolute', bottom: -2, right: -2,
                                            width: 12, height: 12, borderRadius: '50%',
                                            bgcolor: isIG ? '#E1306C' : '#FF0000',
                                            border: '1.5px solid #060910',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {isIG
                                                ? <Instagram sx={{ fontSize: 7, color: '#fff' }} />
                                                : <YouTubeIcon sx={{ fontSize: 7, color: '#fff' }} />}
                                        </Box>
                                    </Box>
                                </ListItemIcon>
                                <ListItemText
                                    primary={acc.title}
                                    primaryTypographyProps={{ fontSize: 12.5, fontWeight: 500, noWrap: true, color: '#CBD5E1' }}
                                />
                            </ListItemButton>
                        );
                    })
                )}
            </List>

            {/* Footer summary */}
            <Box sx={{ p: 2, pt: 1.5 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                        icon={<YouTubeIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${accounts.filter(a => a.platform !== 'instagram').length} YT`}
                        size="small" variant="outlined"
                        sx={{ flex: 1, justifyContent: 'flex-start', borderColor: 'rgba(255,0,0,0.25)', color: '#FF4444', fontSize: 11, fontWeight: 600 }}
                    />
                    <Chip
                        icon={<Instagram sx={{ fontSize: '14px !important' }} />}
                        label={`${accounts.filter(a => a.platform === 'instagram').length} IG`}
                        size="small" variant="outlined"
                        sx={{ flex: 1, justifyContent: 'flex-start', borderColor: 'rgba(225,48,108,0.25)', color: '#E1306C', fontSize: 11, fontWeight: 600 }}
                    />
                </Box>
            </Box>
        </Drawer>
    );
}
