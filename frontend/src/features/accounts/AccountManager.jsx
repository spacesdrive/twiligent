import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, RefreshCw, Search, Users, CheckCircle2,
  Tv, Camera, Link2, Info, ExternalLink, MessageSquare, Lock,
} from 'lucide-react';

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { fmtNum, timeAgo } from '../../utils/formatters';
import { cn } from '@/lib/utils';

export default function AccountManager() {
  const { accounts, showToast, loadAccounts } = useAppContext();
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [dialogTab,    setDialogTab]    = useState('youtube');
  const [input,        setInput]        = useState('');
  const [resolving,    setResolving]    = useState(false);
  const [resolved,     setResolved]     = useState(null);
  const [adding,       setAdding]       = useState(false);
  const [connecting,      setConnecting]      = useState(false);
  const [redditUsername, setRedditUsername] = useState('');
  const [redditCookie,   setRedditCookie]   = useState('');
  const [addingReddit,   setAddingReddit]   = useState(false);
  const [xUsername,  setXUsername]  = useState('');
  const [xAuthToken, setXAuthToken] = useState('');
  const [xCt0,       setXCt0]       = useState('');
  const [addingX,    setAddingX]    = useState(false);
  const [refreshingId,    setRefreshingId]    = useState(null);

  // Handle Instagram OAuth redirect result (?ig_connected=true or ?ig_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('ig_connected');
    const igError   = params.get('ig_error');

    if (connected === 'true') {
      showToast('Instagram account connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
      loadAccounts();
    } else if (igError) {
      const msg =
        igError === 'already_added'   ? 'This Instagram account is already connected' :
        igError === 'cancelled'        ? 'Instagram authorization was cancelled' :
        igError === 'access_denied'    ? 'Instagram authorization was denied' :
        igError === 'invalid_state'    ? 'Authorization expired - please try again' :
        'Instagram connection failed: ' + igError;
      showToast(msg, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleResolve = async () => {
    if (!input.trim()) return;
    setResolving(true);
    setResolved(null);
    try {
      const res = await api.resolveChannel(input.trim());
      setResolved(res.data || res);
    } catch (err) {
      showToast('Could not resolve channel: ' + err.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      await api.addAccount(input.trim());
      showToast('Channel added successfully!');
      closeDialog();
      loadAccounts();
    } catch (err) {
      showToast('Failed to add account: ' + err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleConnectInstagram = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getInstagramAuthUrl();
      // Navigate the same tab - Instagram will redirect back to /accounts?ig_connected=true
      window.location.href = url;
    } catch (err) {
      showToast('Failed to start Instagram login: ' + err.message, 'error');
      setConnecting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteAccount(id);
      showToast('Account removed');
      loadAccounts();
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleRefreshOne = async (id) => {
    setRefreshingId(id);
    try {
      await api.refreshAccount(id);
      showToast('Account refreshed');
      loadAccounts();
    } catch (err) {
      showToast('Refresh failed: ' + err.message, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingId('all');
    try {
      await api.refreshAll();
      showToast('All accounts refreshed');
      loadAccounts();
    } catch (err) {
      showToast('Refresh all failed: ' + err.message, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleAddReddit = async () => {
    if (!redditUsername.trim() || !redditCookie.trim()) return;
    setAddingReddit(true);
    try {
      await api.addRedditAccount(redditUsername.trim(), redditCookie.trim());
      showToast('Reddit account added');
      closeDialog();
      loadAccounts();
    } catch (err) {
      showToast('Failed to add Reddit account: ' + err.message, 'error');
    } finally {
      setAddingReddit(false);
    }
  };

  const handleAddX = async () => {
    if (!xUsername.trim() || !xAuthToken.trim() || !xCt0.trim()) return;
    setAddingX(true);
    try {
      await api.addXAccount(xUsername.trim(), xAuthToken.trim(), xCt0.trim());
      showToast('X account added');
      closeDialog();
      loadAccounts();
    } catch (err) {
      showToast('Failed to add X account: ' + err.message, 'error');
    } finally {
      setAddingX(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setResolved(null);
    setInput('');
    setRedditUsername('');
    setRedditCookie('');
    setXUsername('');
    setXAuthToken('');
    setXCt0('');
  };

  const ytAccounts     = accounts.filter(a => !['instagram', 'reddit', 'x'].includes(a.platform));
  const igAccounts     = accounts.filter(a => a.platform === 'instagram');
  const redditAccounts = accounts.filter(a => a.platform === 'reddit');
  const xAccounts      = accounts.filter(a => a.platform === 'x');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[
              ytAccounts.length     ? `${ytAccounts.length} YouTube`     : null,
              igAccounts.length     ? `${igAccounts.length} Instagram`   : null,
              redditAccounts.length ? `${redditAccounts.length} Reddit`  : null,
              xAccounts.length      ? `${xAccounts.length} X`           : null,
            ].filter(Boolean).join(' · ') || 'No accounts added yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshingId === 'all'} className="gap-2">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshingId === 'all' && 'animate-spin')} />
            {refreshingId === 'all' ? 'Refreshing…' : 'Refresh All'}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <MainCard>
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Accounts Added</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Add a YouTube channel or connect an Instagram account to start tracking analytics.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Your First Account
            </Button>
          </div>
        </MainCard>
      ) : (
        <div className="space-y-8">
          {/* YouTube */}
          {ytAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tv className="h-5 w-5 text-red-500" />
                <h2 className="text-base font-semibold">YouTube Channels</h2>
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600 text-xs">{ytAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {ytAccounts.map(acct => (
                  <AccountCard
                    key={acct.id}
                    acct={acct}
                    platform="youtube"
                    metrics={[
                      { label: 'Subscribers', value: fmtNum(acct.subscriberCount), className: 'bg-red-50 text-red-700' },
                      { label: 'Views',        value: fmtNum(acct.viewCount),       className: 'bg-blue-50 text-blue-700' },
                      { label: 'Videos',       value: fmtNum(acct.videoCount),      className: 'bg-green-50 text-green-700' },
                    ]}
                    refreshingId={refreshingId}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Instagram */}
          {igAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="h-5 w-5 text-pink-500" />
                <h2 className="text-base font-semibold">Instagram Accounts</h2>
                <Badge variant="outline" className="border-pink-200 bg-pink-50 text-pink-600 text-xs">{igAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {igAccounts.map(acct => (
                  <AccountCard
                    key={acct.id}
                    acct={acct}
                    platform="instagram"
                    metrics={[
                      { label: 'Followers',  value: fmtNum(acct.followersCount), className: 'bg-pink-50 text-pink-700' },
                      { label: 'Following',  value: fmtNum(acct.followsCount),   className: 'bg-purple-50 text-purple-700' },
                      { label: 'Posts',      value: fmtNum(acct.mediaCount),     className: 'bg-green-50 text-green-700' },
                    ]}
                    refreshingId={refreshingId}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reddit */}
          {redditAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-orange-500" />
                <h2 className="text-base font-semibold">Reddit Accounts</h2>
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 text-xs">{redditAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {redditAccounts.map(acct => (
                  <AccountCard
                    key={acct.id}
                    acct={acct}
                    platform="reddit"
                    metrics={[
                      { label: 'Total Karma',   value: fmtNum(acct.totalKarma),   className: 'bg-orange-50 text-orange-700' },
                      { label: 'Post Karma',    value: fmtNum(acct.postKarma),    className: 'bg-red-50 text-red-700' },
                      { label: 'Comment Karma', value: fmtNum(acct.commentKarma), className: 'bg-amber-50 text-amber-700' },
                    ]}
                    refreshingId={refreshingId}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* X */}
          {xAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XIcon className="h-5 w-5 text-sky-500" />
                <h2 className="text-base font-semibold">X Accounts</h2>
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-600 text-xs">{xAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {xAccounts.map(acct => (
                  <AccountCard
                    key={acct.id}
                    acct={acct}
                    platform="x"
                    metrics={[
                      { label: 'Followers',  value: fmtNum(acct.followersCount), className: 'bg-sky-50 text-sky-700' },
                      { label: 'Following',  value: fmtNum(acct.followingCount), className: 'bg-blue-50 text-blue-700' },
                      { label: 'Tweets',     value: fmtNum(acct.tweetCount),     className: 'bg-slate-50 text-slate-700' },
                    ]}
                    refreshingId={refreshingId}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>Connect a YouTube channel or Instagram account.</DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="w-full">
              <TabsTrigger value="youtube" className="flex-1 gap-1.5">
                <Tv className="h-3.5 w-3.5" /> YouTube
              </TabsTrigger>
              <TabsTrigger value="instagram" className="flex-1 gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Instagram
              </TabsTrigger>
              <TabsTrigger value="reddit" className="flex-1 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Reddit
              </TabsTrigger>
              <TabsTrigger value="x" className="flex-1 gap-1.5">
                <XIcon className="h-3.5 w-3.5" /> X
              </TabsTrigger>
            </TabsList>

            <TabsContent value="youtube" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Enter a YouTube channel URL, @handle, or channel ID.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="@MrBeast, https://youtube.com/@MrBeast, UCX6…"
                    onKeyDown={e => e.key === 'Enter' && handleResolve()}
                  />
                </div>
                <Button onClick={handleResolve} disabled={resolving || !input.trim()} className="gap-1.5">
                  {resolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {resolved && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={resolved.thumbnails?.medium || resolved.thumbnails?.default} />
                    <AvatarFallback className="bg-green-200 text-green-700 text-xs font-bold">
                      {(resolved.title || 'YT').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{resolved.title}</p>
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground">{resolved.customUrl}</p>
                    {resolved.subscriberCount != null && (
                      <div className="flex gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-xs h-5">{fmtNum(resolved.subscriberCount)} subs</Badge>
                        <Badge variant="secondary" className="text-xs h-5">{fmtNum(resolved.videoCount)} videos</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="instagram" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                You'll be taken to Instagram to log in and grant access. After approval, you'll be redirected back automatically.
              </p>
              <Button
                onClick={handleConnectInstagram}
                disabled={connecting}
                className="w-full gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white border-0"
              >
                {connecting
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <ExternalLink className="h-4 w-4" />}
                {connecting ? 'Opening Instagram...' : 'Connect with Instagram'}
              </Button>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Your account must be a <strong>Business</strong> or <strong>Creator</strong> professional account. Personal accounts are not supported by the Instagram API.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="reddit" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                A session cookie is required to fetch Reddit analytics from the server.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">u/</span>
                  <Input
                    className="pl-8"
                    value={redditUsername}
                    onChange={e => setRedditUsername(e.target.value)}
                    placeholder="your_username"
                    onKeyDown={e => e.key === 'Enter' && handleAddReddit()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Session cookie</label>
                  <Input
                    type="password"
                    value={redditCookie}
                    onChange={e => setRedditCookie(e.target.value)}
                    placeholder="reddit_session value"
                    onKeyDown={e => e.key === 'Enter' && handleAddReddit()}
                  />
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Log in to reddit.com in your browser. Open DevTools (F12), go to <strong>Application &gt; Cookies &gt; https://www.reddit.com</strong>, find the cookie named <strong>reddit_session</strong>, and copy its value.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="x" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Session cookies are required to fetch your X analytics from the server.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">@</span>
                  <Input
                    className="pl-8"
                    value={xUsername}
                    onChange={e => setXUsername(e.target.value)}
                    placeholder="your_username"
                    onKeyDown={e => e.key === 'Enter' && handleAddX()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">auth_token</label>
                  <Input
                    type="password"
                    value={xAuthToken}
                    onChange={e => setXAuthToken(e.target.value)}
                    placeholder="auth_token cookie value"
                    onKeyDown={e => e.key === 'Enter' && handleAddX()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">ct0</label>
                  <Input
                    type="password"
                    value={xCt0}
                    onChange={e => setXCt0(e.target.value)}
                    placeholder="ct0 cookie value"
                    onKeyDown={e => e.key === 'Enter' && handleAddX()}
                  />
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Log in to x.com in your browser. Open DevTools (F12), go to <strong>Application &gt; Cookies &gt; https://x.com</strong>. Copy the values of <strong>auth_token</strong> and <strong>ct0</strong> and paste them above.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            {dialogTab === 'youtube' && (
              <Button onClick={handleAdd} disabled={!input.trim() || adding} className="gap-1.5">
                {adding && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Add Channel
              </Button>
            )}
            {dialogTab === 'reddit' && (
              <Button onClick={handleAddReddit} disabled={!redditUsername.trim() || !redditCookie.trim() || addingReddit} className="gap-1.5">
                {addingReddit && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Add Reddit Account
              </Button>
            )}
            {dialogTab === 'x' && (
              <Button onClick={handleAddX} disabled={!xUsername.trim() || !xAuthToken.trim() || !xCt0.trim() || addingX} className="gap-1.5">
                {addingX && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Add X Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCard({ acct, platform, metrics, refreshingId, onRefresh, onDelete }) {
  const isIG     = platform === 'instagram';
  const isReddit = platform === 'reddit';
  const isX      = platform === 'x';
  const initials = (acct.title || '?').slice(0, 2).toUpperCase();
  const fallbackBg = isIG ? 'bg-pink-500' : isReddit ? 'bg-orange-500' : isX ? 'bg-sky-500' : 'bg-red-500';
  const subtitle = isIG
    ? `@${acct.username || acct.igUsername || ''}`
    : isReddit
    ? `u/${acct.username || ''}`
    : isX
    ? `@${acct.username || ''}`
    : (acct.customUrl || '');

  return (
    <div className="border border-border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11">
          <AvatarImage src={acct.thumbnail || acct.profilePictureUrl || acct.thumbnails?.default} />
          <AvatarFallback className={`text-xs font-bold text-white ${fallbackBg}`}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{acct.title || acct.channelId}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {metrics.map(m => (
          <div key={m.label} className={cn('text-center p-2 rounded-lg', m.className, 'bg-opacity-60')}>
            <p className="text-[0.6rem] uppercase tracking-wide font-medium opacity-70">{m.label}</p>
            <p className="text-sm font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {(isReddit || isX) && (
        <div className="flex items-center gap-1.5 text-xs">
          {acct.hasCookie ? (
            <>
              <Lock className="h-3 w-3 text-green-500" />
              <span className="text-green-600">Session cookies stored</span>
            </>
          ) : (
            <>
              <Lock className="h-3 w-3 text-destructive" />
              <span className="text-destructive">No cookies - re-add account</span>
            </>
          )}
        </div>
      )}
      {acct.lastUpdated && (
        <p className="text-xs text-muted-foreground">Updated {timeAgo(acct.lastUpdated)}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => onRefresh(acct.id)}
          disabled={refreshingId === acct.id}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshingId === acct.id && 'animate-spin')} />
          {refreshingId === acct.id ? 'Refreshing…' : 'Refresh'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => onDelete(acct.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
