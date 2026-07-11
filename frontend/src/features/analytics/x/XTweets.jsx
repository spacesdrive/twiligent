import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtDateShort } from '../../../utils/formatters';
import { ArrowLeft, Search, ExternalLink, Heart, Repeat2, MessageSquare, Eye, FileText } from 'lucide-react';

const TYPE_LABELS = { tweet: 'Original', retweet: 'Retweet', reply: 'Reply', quote: 'Quote' };
const TYPE_BADGE_VARIANT = { tweet: 'secondary', retweet: 'outline', reply: 'outline', quote: 'outline' };

function tweetType(t) {
  if (t.isRetweet) return 'retweet';
  if (t.isReply)   return 'reply';
  if (t.isQuote)   return 'quote';
  return 'tweet';
}

export default function XTweets() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const navigate = useNavigate();
  const account = accounts.find(a => a.id === id);

  const [loading, setLoading] = useState(true);
  const [tweets,  setTweets]  = useState([]);
  const [search,  setSearch]  = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy,  setSortBy]  = useState('date');

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    api.getXTweets(account.id)
      .then(setTweets)
      .catch(err => showToast('Failed to load tweets: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const filtered = useMemo(() => {
    let list = [...tweets];
    if (typeFilter !== 'all') list = list.filter(t => tweetType(t) === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.text?.toLowerCase().includes(q));
    }
    if (sortBy === 'likes')       list.sort((a, b) => b.likeCount - a.likeCount);
    else if (sortBy === 'retweets')  list.sort((a, b) => b.retweetCount - a.retweetCount);
    else if (sortBy === 'impressions') list.sort((a, b) => b.impressionCount - a.impressionCount);
    else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [tweets, search, typeFilter, sortBy]);

  const totalLikes       = filtered.reduce((s, t) => s + t.likeCount, 0);
  const totalImpressions = filtered.reduce((s, t) => s + t.impressionCount, 0);

  if (!account) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-10" />
          <p className="text-sm text-muted-foreground">Loading tweets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => navigate(`/x/${account.id}`)} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {account.title}
        </Button>
        <span className="text-muted-foreground text-sm">/</span>
        <span className="text-sm font-medium">Tweets</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<FileText />}  label="Tweets Shown"       value={fmtNum(filtered.length)}    subtitle={`of ${fmtNum(tweets.length)} fetched`} gradient="blue" />
        <StatCard icon={<Heart />}     label="Combined Likes"     value={fmtNum(totalLikes)}          subtitle="across shown tweets" gradient="red" />
        <StatCard icon={<Eye />}       label="Total Impressions"  value={fmtNum(totalImpressions)}    subtitle="across shown tweets" gradient="purple" />
      </div>

      <MainCard content={false}>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 border-b border-border">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tweets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="tweet">Original</SelectItem>
              <SelectItem value="retweet">Retweets</SelectItem>
              <SelectItem value="reply">Replies</SelectItem>
              <SelectItem value="quote">Quotes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest first</SelectItem>
              <SelectItem value="likes">Most likes</SelectItem>
              <SelectItem value="retweets">Most retweets</SelectItem>
              <SelectItem value="impressions">Most impressions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No tweets match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Tweet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Retweets</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tweet, i) => {
                  const type = tweetType(tweet);
                  return (
                    <TableRow key={tweet.id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <p className="text-sm leading-snug line-clamp-2 max-w-sm">{tweet.text}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_BADGE_VARIANT[type]} className="text-xs whitespace-nowrap">
                          {TYPE_LABELS[type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium text-[#1D9BF0]">{fmtNum(tweet.likeCount)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtNum(tweet.retweetCount)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmtNum(tweet.impressionCount)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(tweet.createdAt)}</TableCell>
                      <TableCell>
                        {tweet.permalink && (
                          <a href={tweet.permalink} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="size-7">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </MainCard>
    </div>
  );
}
