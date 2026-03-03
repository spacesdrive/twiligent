import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#FF0000', light: '#FF4444', dark: '#CC0000' },
        secondary: { main: '#3EA6FF', light: '#6EC6FF', dark: '#0078D4' },
        background: { default: '#0F0F0F', paper: '#1A1A1A' },
        success: { main: '#2E7D32', light: '#4CAF50' },
        warning: { main: '#FF9800', light: '#FFB74D' },
        error: { main: '#F44336', light: '#EF5350' },
        text: { primary: '#FFFFFF', secondary: '#AAAAAA' },
        divider: 'rgba(255,255,255,0.08)',
        youtube: { main: '#FF0000', dark: '#CC0000', contrastText: '#fff' },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h3: { fontWeight: 700, letterSpacing: '-0.02em' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 600, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600 },
        subtitle1: { color: '#AAAAAA' },
        body2: { color: '#AAAAAA' },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#1A1A1A',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.12)' },
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
                root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { fontWeight: 500 },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#0A0A0A',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#1A1A1A',
                    backgroundImage: 'none',
                    borderRadius: 16,
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: { backgroundColor: '#333', fontSize: 13 },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: { borderRadius: 4, height: 6 },
            },
        },
    },
});

export default theme;
