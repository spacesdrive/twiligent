import { Box } from '@mui/material';

export default function Logo({ size = 40 }) {
    return (
        <Box
            component="img"
            src="/logo.png"
            alt="Social Analytics"
            sx={{
                width: size,
                height: size,
                flexShrink: 0,
                objectFit: 'contain',
                borderRadius: 1.5,
            }}
        />
    );
}
