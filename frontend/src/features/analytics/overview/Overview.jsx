import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Avatar, Chip, Button,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Divider, LinearProgress,
} from '@mui/material';
import {
  Visibility, People, VideoLibrary, BarChart,
  YouTube, Instagram, OpenInNew, Refresh,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { fmtNum, fmtNumFull, timeAgo } from '../../../utils/formatters';
import { PRIMARY, GREY } from '../../../themes/index';

const CHART_COLORS = [
  PRIMARY.main, '#52c41a', '#fa8c16', '#722ed1',
  '#13c2c2', '#eb2f96', '#2f54eb', '#faad14',
];

const tooltipStyle = {
  backgroundColor: '#fff',
  border: `1px solid ${GREY.A800}`,
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  color: GREY[700],
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

export default function Overview() {
  const { accounts, loading, refreshAll } = useAppContext();
  const navigate = useNavigate();

  const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
  const igAccounts = accounts.filter(a => a.platform === 'instagram');

  const totals = accounts.reduce((acc, a) => {
    if (a.platform === 'instagram') {
      return { ...acc, followers: acc.followers + (a.followersCount || 0), posts: acc.posts + (a.mediaCount || 0) };
    }
    return {
      ...acc,
      subscribers: acc.subscribers + (a.subscriberCount || 0),
      views: acc.views + (a.viewCount || 0),
      videos: acc.videos + (a.videoCount || 0),
    };
  }, { subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0 });

  const totalAudience = totals.subscribers + totals.followers;

  const sorted = {
    byAudience: [...accounts].sort((a, b) =>
      (b.subscriberCount || b.followersCount || 0) - (a.subscriberCount || a.followersCount || 0)),
    byContent: [...accounts].sort((a, b) =>
      (b.viewCount || b.mediaCount || 0) - (a.viewCount || a.mediaCount || 0)),
  };

  const chartData = accounts.map(a => ({
    name: (a.title || '').slice(0, 14) + ((a.title || '').length > 14 ? '…' : ''),
    audience: a.subscriberCount || a.followersCount || 0,
  }));

  const pieData = accounts.map((a, i) => ({
    name: (a.title || '').slice(0, 14) + ((a.title || '').length > 14 ? '…' : ''),
    value: a.subscriberCount || a.followersCount || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const handleViewChannel = (acc) => {
    if (acc.platform === 'instagram') navigate(`/instagram/${acc.id}`);
    else navigate(`/channel/${acc.id}`);
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Dashboard Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            {accounts.length === 0
              ? 'Add your first account to start tracking'
              : `Tracking ${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Refresh sx={{ fontSize: 18 }} />}
          onClick={refreshAll}
          disabled={loading || accounts.length === 0}
          size="medium"
        >
          {loading ? 'Refreshing…' : 'Refresh All'}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 1 }} />}

      {/* KPI cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          {
            icon: <People />,
            label: 'Total Audience',
            value: fmtNum(totalAudience),
            subtitle: `${fmtNum(totals.subscribers)} subs · ${fmtNum(totals.followers)} followers`,
            gradient: 'purple',
          },
          {
            icon: <Visibility />,
            label: 'Total Views',
            value: fmtNum(totals.views),
            subtitle: fmtNumFull(totals.views),
            gradient: 'red',
          },
          {
            icon: <VideoLibrary />,
            label: 'Total Content',
            value: fmtNum(totals.videos + totals.posts),
            subtitle: `${fmtNum(totals.videos)} videos · ${fmtNum(totals.posts)} posts`,
            gradient: 'blue',
          },
          {
            icon: <BarChart />,
            label: 'Accounts',
            value: accounts.length,
            subtitle: `${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`,
            gradient: 'orange',
          },
        ].map((card, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {accounts.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: `${PRIMARY.lighter}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <People sx={{ fontSize: 36, color: PRIMARY.main }} />
            </Box>
            <Typography variant="h5" sx={{ mb: 1 }}>Welcome to Twiligent</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: 2.5 }}>
              Add your first YouTube channel or Instagram account to start tracking analytics
            </Typography>
            <Button variant="contained" onClick={() => navigate('/accounts')}>
              Add Account
            </Button>
          </Box>
        </MainCard>
      ) : (
        <>
          {/* Charts */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <MainCard title="Audience Comparison" contentSX={{ p: 2 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="audGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PRIMARY.main} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={PRIMARY.main} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: GREY[500], fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: GREY[500], fontSize: 12 }}
                      tickFormatter={fmtNum}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <ReTooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [fmtNumFull(v), 'Audience']}
                      cursor={{ stroke: GREY[300], strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="audience"
                      stroke={PRIMARY.main}
                      strokeWidth={2}
                      fill="url(#audGrad)"
                      dot={{ fill: PRIMARY.main, r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: PRIMARY.dark }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </MainCard>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <MainCard title="Audience Share" contentSX={{ p: 2 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="44%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip contentStyle={tooltipStyle} formatter={(v) => fmtNumFull(v)} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: GREY[600], paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </MainCard>
            </Grid>
          </Grid>

          {/* Leaderboards */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {[
              { title: 'Top by Audience', list: sorted.byAudience, metric: a => fmtNum(a.platform === 'instagram' ? a.followersCount : a.subscriberCount), metricLabel: a => a.platform === 'instagram' ? 'followers' : 'subscribers' },
              { title: 'Top by Content',  list: sorted.byContent,  metric: a => a.platform === 'instagram' ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views`, metricLabel: () => '' },
            ].map(({ title, list, metric, metricLabel }) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <MainCard title={title}>
                  {list.map((a, i) => {
                    const isIG = a.platform === 'instagram';
                    const medalColors = ['#faad14', '#8c8c8c', '#d4845a'];
                    return (
                      <Box
                        key={a.id}
                        onClick={() => handleViewChannel(a)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 1,
                          px: 1,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: GREY[50] },
                        }}
                      >
                        <Typography
                          sx={{
                            width: 20,
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            color: i < 3 ? medalColors[i] : GREY[400],
                          }}
                        >
                          {i + 1}
                        </Typography>
                        <Avatar
                          src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default}
                          sx={{ width: 32, height: 32, border: 'none', bgcolor: isIG ? '#E1306C' : '#FF0000' }}
                        >
                          {isIG ? <Instagram sx={{ fontSize: 14 }} /> : <YouTube sx={{ fontSize: 14 }} />}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {a.title}
                          </Typography>
                        </Box>
                        <Chip
                          label={metric(a)}
                          size="small"
                          sx={{
                            bgcolor: isIG ? '#fff0f6' : '#f6ffed',
                            color: isIG ? '#c41d7f' : '#389e0d',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: 22,
                            border: '1px solid',
                            borderColor: isIG ? '#ffadd2' : '#b7eb8f',
                          }}
                        />
                      </Box>
                    );
                  })}
                </MainCard>
              </Grid>
            ))}
          </Grid>

          {/* Full accounts table */}
          <MainCard title="All Accounts" content={false}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }}>#</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell align="center" sx={{ width: 80 }}>Platform</TableCell>
                    <TableCell align="right">Audience</TableCell>
                    <TableCell align="right">Content</TableCell>
                    <TableCell align="right">Updated</TableCell>
                    <TableCell align="center" sx={{ width: 52 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.byAudience.map((a, i) => {
                    const isIG = a.platform === 'instagram';
                    return (
                      <TableRow
                        key={a.id}
                        onClick={() => handleViewChannel(a)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, color: i < 3 ? '#faad14' : 'text.secondary' }}
                          >
                            {i + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default}
                              sx={{ width: 32, height: 32, border: 'none', bgcolor: isIG ? '#E1306C' : '#FF0000' }}
                            >
                              {isIG ? <Instagram sx={{ fontSize: 14 }} /> : <YouTube sx={{ fontSize: 14 }} />}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {isIG ? `@${a.username || ''}` : (a.customUrl || a.channelId || '')}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {isIG
                            ? <Chip label="Instagram" size="small" sx={{ bgcolor: '#fff0f6', color: '#c41d7f', fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
                            : <Chip label="YouTube"   size="small" sx={{ bgcolor: '#fff1f0', color: '#a8071a', fontWeight: 600, fontSize: '0.65rem', height: 20 }} />}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {fmtNum(isIG ? a.followersCount : a.subscriberCount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {isIG ? 'followers' : 'subscribers'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {isIG
                              ? `${fmtNum(a.mediaCount)} posts`
                              : `${fmtNum(a.viewCount)} views · ${fmtNum(a.videoCount)} vids`}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">{timeAgo(a.lastUpdated)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Analytics">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleViewChannel(a); }}
                              sx={{ color: 'text.secondary', '&:hover': { color: PRIMARY.main, bgcolor: PRIMARY.lighter } }}
                            >
                              <OpenInNew sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </MainCard>
        </>
      )}
    </Box>
  );
}
