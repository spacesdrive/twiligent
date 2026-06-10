import { createTheme, alpha } from '@mui/material/styles';

// Mantis palette — Ant Design blue as primary
const PRIMARY = {
  lighter: '#e6f4ff',
  100:     '#bae0ff',
  200:     '#91caff',
  light:   '#69b1ff',
  400:     '#4096ff',
  main:    '#1890ff',
  dark:    '#096dd9',
  700:     '#0050b3',
  darker:  '#003a8c',
  900:     '#002766',
  contrastText: '#fff',
};

const SECONDARY = {
  lighter: '#f9f0ff',
  light:   '#d3adf7',
  main:    '#722ed1',
  dark:    '#531dab',
  darker:  '#22075e',
  contrastText: '#fff',
};

const SUCCESS = {
  lighter: '#f6ffed',
  light:   '#b7eb8f',
  main:    '#52c41a',
  dark:    '#389e0d',
  darker:  '#135200',
  contrastText: '#fff',
};

const WARNING = {
  lighter: '#fffbe6',
  light:   '#ffe58f',
  main:    '#faad14',
  dark:    '#d46b08',
  darker:  '#613400',
  contrastText: '#212121',
};

const ERROR = {
  lighter: '#fff1f0',
  light:   '#ffa39e',
  main:    '#ff4d4f',
  dark:    '#cf1322',
  darker:  '#820014',
  contrastText: '#fff',
};

const INFO = {
  lighter: '#e6fffb',
  light:   '#87e8de',
  main:    '#13c2c2',
  dark:    '#08979c',
  darker:  '#006d75',
  contrastText: '#fff',
};

const GREY = {
  0:    '#ffffff',
  50:   '#fafafa',
  100:  '#f5f5f5',
  200:  '#f0f0f0',
  300:  '#d9d9d9',
  400:  '#bfbfbf',
  500:  '#8c8c8c',
  600:  '#595959',
  700:  '#262626',
  800:  '#141414',
  900:  '#000000',
  A50:  '#fafafb',
  A100: '#fafafa',
  A200: '#bfbfbf',
  A400: '#434343',
  A700: '#1f1f1f',
  A800: '#e6ebf1',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { ...PRIMARY },
    secondary: { ...SECONDARY },
    success:   { ...SUCCESS },
    warning:   { ...WARNING },
    error:     { ...ERROR },
    info:      { ...INFO },
    grey:      GREY,
    text: {
      primary:   GREY[700],
      secondary: GREY[500],
      disabled:  GREY[400],
    },
    action: {
      disabled: GREY[300],
    },
    divider: GREY[200],
    background: {
      paper:   GREY[0],
      default: GREY.A50,
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    htmlFontSize: 16,
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    600,
    h1: { fontWeight: 600, fontSize: '2.375rem', lineHeight: 1.21 },
    h2: { fontWeight: 600, fontSize: '1.875rem', lineHeight: 1.27 },
    h3: { fontWeight: 600, fontSize: '1.5rem',   lineHeight: 1.33 },
    h4: { fontWeight: 600, fontSize: '1.25rem',  lineHeight: 1.4  },
    h5: { fontWeight: 600, fontSize: '1rem',     lineHeight: 1.5  },
    h6: { fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.57 },
    body1: { fontSize: '0.875rem', lineHeight: 1.57 },
    body2: { fontSize: '0.75rem',  lineHeight: 1.66 },
    subtitle1: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.57 },
    subtitle2: { fontSize: '0.75rem',  fontWeight: 500, lineHeight: 1.66 },
    caption:   { fontSize: '0.75rem',  lineHeight: 1.66 },
    overline:  { lineHeight: 2.66 },
    button:    { textTransform: 'capitalize' },
  },
  shape: { borderRadius: 8 },
  breakpoints: {
    values: { xs: 0, sm: 768, md: 1024, lg: 1266, xl: 1440 },
  },
  mixins: {
    toolbar: { minHeight: 60, paddingTop: 8, paddingBottom: 8 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' },
        '*::-webkit-scrollbar': { width: 6, height: 6 },
        '*::-webkit-scrollbar-track': { background: GREY[100] },
        '*::-webkit-scrollbar-thumb': { background: GREY[300], borderRadius: 3 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${GREY.A800}`,
          boxShadow: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '20px 20px 0' },
        title: { fontSize: '0.875rem', fontWeight: 600 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 8 },
        outlined: { borderColor: GREY.A800 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { fontWeight: 500, textTransform: 'capitalize', borderRadius: 8 },
        contained: { '&:hover': { boxShadow: 'none' } },
        sizeLarge:  { padding: '8px 22px' },
        sizeMedium: { padding: '6px 16px' },
        sizeSmall:  { padding: '4px 10px' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
        sizeSmall: { padding: 4 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 500, '&.MuiChip-light': { color: PRIMARY.main, background: PRIMARY.lighter } },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: GREY[0],
          borderRight: `1px solid ${GREY.A800}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${GREY.A800}`,
          backgroundColor: GREY[0],
          backgroundImage: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: PRIMARY.lighter,
            color: PRIMARY.main,
            '&:hover': { backgroundColor: alpha(PRIMARY.lighter, 0.9) },
            '& .MuiListItemIcon-root': { color: PRIMARY.main },
          },
          '&:hover': { backgroundColor: alpha(PRIMARY.main, 0.04) },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36, color: GREY[600] },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: GREY.A800 },
            '&:hover fieldset': { borderColor: PRIMARY.light },
            '&.Mui-focused fieldset': { borderColor: PRIMARY.main },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
        input: { padding: '10.5px 14px' },
        notchedOutline: { borderColor: GREY.A800 },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: { padding: '10.5px 14px' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: GREY.A800 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          background: GREY.A50,
          '& .MuiTableCell-root': {
            color: GREY[700],
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: `1px solid ${GREY.A800}`,
            padding: '10px 16px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${GREY.A800}`,
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-of-type td': { borderBottom: 'none' },
          '&:hover': { backgroundColor: alpha(PRIMARY.main, 0.03) },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'capitalize',
          minHeight: 46,
          fontWeight: 500,
          fontSize: '0.875rem',
          '&.Mui-selected': { fontWeight: 600, color: PRIMARY.main },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: '2px 2px 0 0' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: GREY[700],
          fontSize: '0.75rem',
          borderRadius: 6,
          padding: '6px 12px',
        },
        arrow: { color: GREY[700] },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '20px 24px', fontSize: '1.125rem', fontWeight: 600 },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '16px 24px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 20px' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 3, backgroundColor: GREY[200] },
        bar: { borderRadius: 3 },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          width: 36,
          height: 36,
          fontSize: '0.875rem',
          background: PRIMARY.lighter,
          color: PRIMARY.main,
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        separator: { color: GREY[400] },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
        standardSuccess: { background: SUCCESS.lighter, color: SUCCESS.darker, '& .MuiAlert-icon': { color: SUCCESS.main } },
        standardWarning: { background: WARNING.lighter, color: WARNING.darker, '& .MuiAlert-icon': { color: WARNING.main } },
        standardError:   { background: ERROR.lighter,   color: ERROR.darker,   '& .MuiAlert-icon': { color: ERROR.main   } },
        standardInfo:    { background: INFO.lighter,    color: INFO.darker,    '& .MuiAlert-icon': { color: INFO.main    } },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 4, margin: '0 4px', padding: '6px 12px', fontSize: '0.875rem' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem', fontWeight: 500 },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 0, fontSize: '0.75rem' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        standard: { minWidth: 18, height: 18, fontSize: '0.65rem' },
      },
    },
  },
});

// Expose custom color tokens for use in components
theme.palette.primary = { ...theme.palette.primary, ...PRIMARY };
theme.palette.grey = { ...theme.palette.grey, ...GREY };

export { PRIMARY, SECONDARY, SUCCESS, WARNING, ERROR, INFO, GREY };
export default theme;
