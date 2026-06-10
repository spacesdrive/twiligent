import React from 'react';
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

// Mantis-style palette for stat cards
const PALETTE = {
  blue:   { bg: '#e6f4ff', icon: '#1890ff', text: '#003a8c' },
  red:    { bg: '#fff1f0', icon: '#ff4d4f', text: '#820014' },
  green:  { bg: '#f6ffed', icon: '#52c41a', text: '#135200' },
  orange: { bg: '#fff7e6', icon: '#fa8c16', text: '#613400' },
  purple: { bg: '#f9f0ff', icon: '#722ed1', text: '#22075e' },
  teal:   { bg: '#e6fffb', icon: '#13c2c2', text: '#006d75' },
  pink:   { bg: '#fff0f6', icon: '#eb2f96', text: '#780650' },
  indigo: { bg: '#f0f5ff', icon: '#2f54eb', text: '#030852' },
  cyan:   { bg: '#e6fffb', icon: '#13c2c2', text: '#006d75' },
  amber:  { bg: '#fffbe6', icon: '#faad14', text: '#613400' },
};

export default function StatCard({
  icon,
  label,
  value,
  subtitle,
  gradient = 'blue',
  loading,
  small,
  trend,       // number: positive = up, negative = down
  trendLabel,  // string like "+12% this month"
}) {
  const pal = PALETTE[gradient] || PALETTE.blue;

  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: 'none',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
      }}
    >
      <CardContent sx={{ p: small ? 2 : 2.5, '&:last-child': { pb: small ? 2 : 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box
            sx={{
              width: small ? 40 : 48,
              height: small ? 40 : 48,
              borderRadius: 1.5,
              bgcolor: pal.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {React.cloneElement(icon, { sx: { color: pal.icon, fontSize: small ? 20 : 24 } })}
          </Box>

          {trend !== undefined && !loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              {trend >= 0
                ? <TrendingUp sx={{ fontSize: 14, color: '#52c41a' }} />
                : <TrendingDown sx={{ fontSize: 14, color: '#ff4d4f' }} />}
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: trend >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '0.7rem' }}
              >
                {Math.abs(trend)}%
              </Typography>
            </Box>
          )}
        </Box>

        {loading ? (
          <>
            <Skeleton width="60%" height={small ? 28 : 36} sx={{ borderRadius: 1, mb: 0.5 }} />
            <Skeleton width="80%" height={16} sx={{ borderRadius: 1 }} />
          </>
        ) : (
          <>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: small ? '1.1rem' : '1.375rem',
                lineHeight: 1.2,
                color: 'text.primary',
                mb: 0.25,
                letterSpacing: '-0.02em',
              }}
            >
              {value}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500, mb: trendLabel ? 0.5 : 0 }}
            >
              {label}
            </Typography>
            {(subtitle || trendLabel) && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}
              >
                {trendLabel || subtitle}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
