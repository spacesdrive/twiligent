import React from 'react';
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';

const GRADIENTS = {
    red:    'linear-gradient(135deg, #FF0000 0%, #FF4444 100%)',
    green:  'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
    blue:   'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
    orange: 'linear-gradient(135deg, #C2410C 0%, #F97316 100%)',
    purple: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
    teal:   'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
    pink:   'linear-gradient(135deg, #BE185D 0%, #EC4899 100%)',
    indigo: 'linear-gradient(135deg, #3730A3 0%, #6366F1 100%)',
    cyan:   'linear-gradient(135deg, #0E7490 0%, #22D3EE 100%)',
    amber:  'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)',
};

const GLOW = {
    red:    'rgba(255,0,0,0.15)',
    green:  'rgba(34,197,94,0.15)',
    blue:   'rgba(59,130,246,0.15)',
    orange: 'rgba(249,115,22,0.15)',
    purple: 'rgba(167,139,250,0.15)',
    teal:   'rgba(20,184,166,0.15)',
    pink:   'rgba(236,72,153,0.15)',
    indigo: 'rgba(99,102,241,0.15)',
    cyan:   'rgba(34,211,238,0.15)',
    amber:  'rgba(245,158,11,0.15)',
};

export default function StatCard({ icon, label, value, subtitle, gradient = 'blue', loading, small }) {
    const grad = GRADIENTS[gradient] || GRADIENTS.blue;
    const glow = GLOW[gradient] || GLOW.blue;

    return (
        <Card sx={{
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '2px',
                background: grad,
                opacity: 0.8,
            },
        }}>
            <CardContent sx={{ p: small ? 1.75 : 2.25, '&:last-child': { pb: small ? 1.75 : 2.25 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                    <Box sx={{
                        width: small ? 40 : 48,
                        height: small ? 40 : 48,
                        borderRadius: '12px',
                        background: grad,
                        boxShadow: `0 4px 14px ${glow}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        {React.cloneElement(icon, { sx: { color: '#fff', fontSize: small ? 20 : 24 } })}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            color: 'text.secondary',
                            fontSize: small ? 11 : 12,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            mb: 0.5,
                            lineHeight: 1,
                        }}>
                            {label}
                        </Typography>

                        {loading ? (
                            <Skeleton width="65%" height={small ? 26 : 34} sx={{ borderRadius: 1 }} />
                        ) : (
                            <Typography sx={{
                                fontWeight: 800,
                                fontSize: small ? '1.15rem' : '1.5rem',
                                lineHeight: 1.15,
                                letterSpacing: '-0.02em',
                                color: 'text.primary',
                            }}>
                                {value}
                            </Typography>
                        )}

                        {subtitle && (
                            <Typography sx={{
                                color: 'text.secondary',
                                fontSize: 11,
                                mt: 0.4,
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
