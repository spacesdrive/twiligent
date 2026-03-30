import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#FF0000', light: '#FF4444', dark: '#CC0000' },
        secondary: { main: '#3EA6FF', light: '#6EC6FF', dark: '#0078D4' },
        background: { default: '#080B14', paper: '#0E1420' },
        success: { main: '#22C55E', light: '#4ADE80', dark: '#16A34A' },
        warning: { main: '#F59E0B', light: '#FCD34D' },
        error: { main: '#EF4444', light: '#F87171' },
        text: { primary: '#F1F5F9', secondary: '#94A3B8' },
        divider: 'rgba(255,255,255,0.07)',
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h3: { fontWeight: 800, letterSpacing: '-0.03em' },
        h4: { fontWeight: 800, letterSpacing: '-0.02em' },
        h5: { fontWeight: 700, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600, letterSpacing: '-0.01em' },
        subtitle1: { color: '#94A3B8', fontWeight: 500 },
        body2: { color: '#94A3B8' },
        caption: { color: '#64748B' },
    },
    shape: { borderRadius: 14 },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#0E1420',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:hover': {
                        borderColor: 'rgba(255,255,255,0.13)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: 'none' },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 10,
                    letterSpacing: '-0.01em',
                },
                contained: {
                    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.5)' },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { fontWeight: 600, borderRadius: 8 },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#060910',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    backgroundImage: 'none',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                        '&.Mui-focused fieldset': { borderColor: 'rgba(255,0,0,0.5)' },
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#0E1420',
                    backgroundImage: 'none',
                    borderRadius: 18,
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: '#1E2A3A',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 8,
                    padding: '6px 12px',
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: { borderRadius: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: '#64748B',
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                    },
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.025) !important' },
                    '& .MuiTableCell-root': {
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        color: '#CBD5E1',
                    },
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: 'rgba(255,255,255,0.07)' },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: { borderRadius: 10, transition: 'all 0.15s ease' },
            },
        },
        MuiAvatar: {
            styleOverrides: {
                root: {
                    border: '2px solid rgba(255,255,255,0.08)',
                },
            },
        },
    },
});

export default theme;
