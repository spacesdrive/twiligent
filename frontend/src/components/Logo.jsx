import React from 'react';
import { Box } from '@mui/material';

export default function Logo({ size = 40 }) {
    return (
        <Box
            sx={{
                width: size,
                height: size,
                flexShrink: 0,
                position: 'relative',
            }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Background circle with gradient */}
                <defs>
                    <linearGradient id="logoBg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FF0000" />
                        <stop offset="100%" stopColor="#CC0000" />
                    </linearGradient>
                    <linearGradient id="barGrad1" x1="0" y1="100" x2="0" y2="30" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.7" />
                    </linearGradient>
                    <linearGradient id="playGrad" x1="70" y1="20" x2="110" y2="55" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFD4D4" />
                    </linearGradient>
                    <filter id="shadow" x="-4" y="-2" width="128" height="128">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
                    </filter>
                </defs>

                {/* Main circle */}
                <rect width="120" height="120" rx="28" fill="url(#logoBg)" filter="url(#shadow)" />

                {/* Analytics bars */}
                <rect x="18" y="72" width="16" height="26" rx="4" fill="url(#barGrad1)" opacity="0.9" />
                <rect x="40" y="52" width="16" height="46" rx="4" fill="url(#barGrad1)" opacity="0.95" />
                <rect x="62" y="36" width="16" height="62" rx="4" fill="url(#barGrad1)" />

                {/* Upward trend line */}
                <path
                    d="M26 68 L48 48 L70 32"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.6"
                />

                {/* Play button triangle (YouTube) */}
                <g transform="translate(82, 18)">
                    <rect width="30" height="22" rx="5" fill="rgba(255,255,255,0.2)" />
                    <path d="M11 5 L23 11 L11 17Z" fill="url(#playGrad)" />
                </g>

                {/* Subtle dot accent */}
                <circle cx="70" cy="32" r="4" fill="#FFFFFF" opacity="0.9" />
            </svg>
        </Box>
    );
}
