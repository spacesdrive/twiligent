import React from 'react';
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';

const GRADIENTS = {
    red: 'linear-gradient(135deg, #FF0000 0%, #FF4444 100%)',
    green: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
    blue: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    orange: 'linear-gradient(135deg, #E65100 0%, #FF9800 100%)',
    purple: 'linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)',
    teal: 'linear-gradient(135deg, #00695C 0%, #26A69A 100%)',
    pink: 'linear-gradient(135deg, #AD1457 0%, #EC407A 100%)',
    indigo: 'linear-gradient(135deg, #283593 0%, #5C6BC0 100%)',
    cyan: 'linear-gradient(135deg, #00838F 0%, #26C6DA 100%)',
    amber: 'linear-gradient(135deg, #FF6F00 0%, #FFCA28 100%)',
};

export default function StatCard({ icon, label, value, subtitle, gradient = 'blue', loading, small }) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: small ? 2 : 2.5, '&:last-child': { pb: small ? 2 : 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{
                        width: small ? 44 : 52, height: small ? 44 : 52, borderRadius: 2,
                        background: GRADIENTS[gradient] || GRADIENTS.blue,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        {React.cloneElement(icon, { sx: { color: '#fff', fontSize: small ? 22 : 26 } })}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: small ? 12 : 13, fontWeight: 500, mb: 0.3 }}>
                            {label}
                        </Typography>
                        {loading ? (
                            <Skeleton width="60%" height={small ? 28 : 36} />
                        ) : (
                            <Typography variant={small ? 'h6' : 'h5'} sx={{
                                fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
                                fontSize: small ? '1.1rem' : undefined,
                            }}>
                                {value}
                            </Typography>
                        )}
                        {subtitle && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
