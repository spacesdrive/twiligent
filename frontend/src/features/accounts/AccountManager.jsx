import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, RefreshCw, Search, Users, CheckCircle2, Link2, Info, ExternalLink, Lock, ArrowLeft, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import SectionHeader from '@/components/SectionHeader';
import ChoiceCard from '@/components/ChoiceCard';
import InstagramTesterNotice from '@/components/InstagramTesterNotice';
import { ADMIN_EMAIL } from '@/lib/contact';
import ConfirmDialog from '@/components/ConfirmDialog';
import { FieldRow } from '@/components/DetailPanel';
import { EmptyState } from '@/components/StateViews';
import { AccountAvatar, PlatformIcon } from '@/components/platform';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';
import { PLATFORM_META, accountHandle, accountName, accountPath, groupByPlatform, platformSummary } from '@/lib/accounts';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { fmtNum, timeAgo } from '../../utils/formatters';
import { cn } from '@/lib/utils';

const PLATFORM_CHOICES = [
  { value: 'youtube',   title: 'YouTube channel',   description: 'Paste a channel link, @handle or channel ID.', icon: <YouTubeIcon /> },
  { value: 'instagram', title: 'Instagram account', description: 'Sign in with Instagram. Business or Creator accounts only.', icon: <InstagramIcon /> },
  { value: 'reddit',    title: 'Reddit account',    description: 'Add a username and a session cookie from your browser.', icon: <RedditIcon /> },
];

const TESTER_HINT = `If your account is not an Instagram tester yet, email ${ADMIN_EMAIL} to be added, then accept the invite in Instagram.`;

const IG_ERRORS = {
  already_added: 'This Instagram account is already connected.',
  cancelled: 'Instagram sign-in was cancelled. Try again when you are ready.',
  access_denied: `Instagram did not grant access. Approve every requested permission and try again. ${TESTER_HINT}`,
  invalid_state: 'The Instagram sign-in link expired. Start the connection again.',
};

const METRICS = {
  youtube:   acct => [['Subscribers', acct.subscriberCount], ['Views', acct.viewCount], ['Videos', acct.videoCount]],
  instagram: acct => [['Followers', acct.followersCount], ['Following', acct.followsCount], ['Posts', acct.mediaCount]],
  reddit:    acct => [['Karma', acct.totalKarma], ['Post karma', acct.postKarma], ['Comment karma', acct.commentKarma]],
};

export default function AccountManager() {
  const { accounts, showToast, loadAccounts } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [input, setInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null);
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [redditUsername, setRedditUsername] = useState('');
  const [redditCookie, setRedditCookie] = useState('');
  const [addingReddit, setAddingReddit] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Instagram OAuth returns here with ?ig_connected=true or ?ig_error=...; ?add=1 opens the add flow
  useEffect(() => {
    const connected = searchParams.get('ig_connected');
    const igError = searchParams.get('ig_error');
    const add = searchParams.get('add');
    if (!connected && !igError && !add) return;

    if (connected === 'true') {
      showToast('Instagram account connected');
      loadAccounts();
    } else if (igError) {
      showToast(IG_ERRORS[igError] || `Instagram connection failed: ${igError}. ${TESTER_HINT}`, 'error');
    }
    if (add) setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, showToast, loadAccounts]);

  const closeDialog = () => {
    setDialogOpen(false);
    setPlatform(null);
    setResolved(null);
    setInput('');
    setRedditUsername('');
    setRedditCookie('');
  };

  const handleResolve = async () => {
    if (!input.trim()) return;
    setResolving(true);
    setResolved(null);
    try {
      const res = await api.resolveChannel(input.trim());
      setResolved(res.data || res);
    } catch (err) {
      showToast(`Couldn't find that channel. ${err.message}`, 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      await api.addAccount(input.trim());
      showToast('YouTube channel added');
      closeDialog();
      loadAccounts();
    } catch (err) {
      showToast(`Couldn't add the channel. ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleConnectInstagram = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getInstagramAuthUrl();
      // Same tab: Instagram redirects back to /accounts?ig_connected=true
      window.location.href = url;
    } catch (err) {
      showToast(`Couldn't start Instagram sign-in. ${err.message}`, 'error');
      setConnecting(false);
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
      showToast(`Couldn't add the Reddit account. ${err.message}`, 'error');
    } finally {
      setAddingReddit(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteAccount(pendingDelete.id);
      showToast(`${accountName(pendingDelete)} removed`);
      setPendingDelete(null);
      loadAccounts();
    } catch (err) {
      showToast(`Couldn't remove the account. ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshOne = async id => {
    setRefreshingId(id);
    try {
      await api.refreshAccount(id);
      showToast('Account refreshed');
      loadAccounts();
    } catch (err) {
      showToast(`Refresh failed. ${err.message}`, 'error');
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
      showToast(`Refresh failed. ${err.message}`, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const groups = groupByPlatform(accounts);
  const sections = [
    { key: 'youtube',   title: 'YouTube channels' },
    { key: 'instagram', title: 'Instagram accounts' },
    { key: 'reddit',    title: 'Reddit accounts' },
  ].filter(s => groups[s.key].length > 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Accounts"
        description={accounts.length > 0 ? platformSummary(accounts) : 'No accounts added yet'}
        actions={
          <>
            {accounts.length > 0 && (
              <Button variant="outline" onClick={handleRefreshAll} disabled={refreshingId === 'all'}>
                <RefreshCw data-icon="inline-start" className={cn(refreshingId === 'all' && 'animate-spin')} />
                {refreshingId === 'all' ? 'Refreshing' : 'Refresh all'}
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <div className="flex flex-col gap-4">
          <SectionHeader title="Choose what to connect" />
          <div role="list" className="grid grid-cols-1 gap-x-3 gap-y-5 md:grid-cols-3">
            {PLATFORM_CHOICES.map(choice => (
              <div role="listitem" key={choice.value}>
                <ChoiceCard
                  icon={choice.icon}
                  title={choice.title}
                  description={choice.description}
                  onSelect={() => { setPlatform(choice.value); setDialogOpen(true); }}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        sections.map(section => (
          <section key={section.key} className="flex flex-col gap-3">
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  <PlatformIcon platform={section.key} className="size-4 text-ink-muted" />
                  {section.title}
                  <Badge variant="secondary">{groups[section.key].length}</Badge>
                </span>
              }
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups[section.key].map(acct => (
                <AccountCard
                  key={acct.id}
                  acct={acct}
                  platform={section.key}
                  refreshing={refreshingId === acct.id}
                  onRefresh={() => handleRefreshOne(acct.id)}
                  onDelete={() => setPendingDelete(acct)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{platform ? PLATFORM_CHOICES.find(c => c.value === platform).title : 'Add an account'}</DialogTitle>
            <DialogDescription>
              {platform ? 'Fill in the details, review, then add.' : 'Choose the platform you want to track.'}
            </DialogDescription>
          </DialogHeader>

          {!platform && (
            <div role="radiogroup" aria-label="Platform" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLATFORM_CHOICES.map(choice => (
                <ChoiceCard
                  key={choice.value}
                  icon={choice.icon}
                  title={PLATFORM_META[choice.value].label}
                  description={choice.description}
                  selected={false}
                  onSelect={() => setPlatform(choice.value)}
                />
              ))}
            </div>
          )}

          {platform === 'youtube' && (
            <div className="flex flex-col gap-4">
              <FieldRow label="Channel" hint="A channel URL, an @handle or a channel ID that starts with UC." htmlFor="yt-channel">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
                    <Input
                      id="yt-channel"
                      className="h-(--control-h-lg) pl-9"
                      value={input}
                      onChange={e => { setInput(e.target.value); setResolved(null); }}
                      placeholder="youtube.com/@channel"
                      onKeyDown={e => e.key === 'Enter' && handleResolve()}
                      autoFocus
                    />
                  </div>
                  <Button variant="outline" size="lg" onClick={handleResolve} disabled={resolving || !input.trim()}>
                    {resolving ? <Spinner className="size-4" /> : <Search data-icon="inline-start" />}
                    Find
                  </Button>
                </div>
              </FieldRow>

              {resolved && (
                <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-soft p-3">
                  <AccountAvatar account={{ platform: 'youtube', title: resolved.title, thumbnail: resolved.thumbnails?.medium || resolved.thumbnails?.default }} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <span className="truncate">{resolved.title}</span>
                      <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Channel found" />
                    </p>
                    <p className="text-caption text-ink-muted">{resolved.customUrl}</p>
                    {resolved.subscriberCount != null && (
                      <p className="mt-0.5 text-caption text-ink-muted">
                        {fmtNum(resolved.subscriberCount)} subscribers, {fmtNum(resolved.videoCount)} videos
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {platform === 'instagram' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink-muted">
                We open Instagram so you can sign in and approve access. When you finish, Instagram sends you back here and the account appears in the list. The account must be an Instagram Business or Creator account; personal accounts cannot be connected.
              </p>
              <InstagramTesterNotice />
            </div>
          )}

          {platform === 'reddit' && (
            <div className="flex flex-col gap-4">
              <FieldRow label="Username" htmlFor="reddit-user">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-ink-faint">u/</span>
                  <Input
                    id="reddit-user"
                    className="h-(--control-h-lg) pl-8"
                    value={redditUsername}
                    onChange={e => setRedditUsername(e.target.value)}
                    placeholder="username"
                    onKeyDown={e => e.key === 'Enter' && handleAddReddit()}
                    autoFocus
                  />
                </div>
              </FieldRow>
              <FieldRow label="Session cookie" hint="We store it on the server and never show it again." htmlFor="reddit-cookie">
                <Input
                  id="reddit-cookie"
                  type="password"
                  className="h-(--control-h-lg) font-mono"
                  value={redditCookie}
                  onChange={e => setRedditCookie(e.target.value)}
                  placeholder="reddit_session value"
                  onKeyDown={e => e.key === 'Enter' && handleAddReddit()}
                />
              </FieldRow>
              <Alert>
                <Info />
                <AlertDescription>
                  Sign in to reddit.com in your browser, open DevTools (F12), go to Application, then Cookies, then https://www.reddit.com, and copy the value of <strong className="font-semibold text-ink">reddit_session</strong>.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            {platform ? (
              <Button variant="ghost" onClick={() => { setPlatform(null); setResolved(null); }} className="sm:mr-auto">
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : null}
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            {platform === 'youtube' && (
              <Button onClick={handleAdd} disabled={!input.trim() || adding}>
                {adding && <Spinner className="size-4" />}
                {adding ? 'Adding channel' : 'Add channel'}
              </Button>
            )}
            {platform === 'instagram' && (
              <Button onClick={handleConnectInstagram} disabled={connecting}>
                {connecting ? <Spinner className="size-4" /> : <ExternalLink data-icon="inline-start" />}
                {connecting ? 'Opening Instagram' : 'Continue to Instagram'}
              </Button>
            )}
            {platform === 'reddit' && (
              <Button onClick={handleAddReddit} disabled={!redditUsername.trim() || !redditCookie.trim() || addingReddit}>
                {addingReddit && <Spinner className="size-4" />}
                {addingReddit ? 'Adding account' : 'Add Reddit account'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
        title={pendingDelete ? `Remove ${accountName(pendingDelete)}?` : 'Remove account?'}
        description="Its cached analytics are deleted. Scheduled posts for this account are removed with it. You can add the account again later."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        busy={deleting}
        hold
      />
    </div>
  );
}

function AccountCard({ acct, platform, refreshing, onRefresh, onDelete }) {
  const metrics = METRICS[platform](acct);
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <AccountAvatar account={acct} size="lg" showPlatform />
        <div className="min-w-0 flex-1">
          <Link to={accountPath(acct)} className="block truncate text-sm font-semibold text-ink hover:underline">{accountName(acct)}</Link>
          <p className="truncate text-caption text-ink-faint">{platform === 'reddit' ? `u/${acct.username || ''}` : accountHandle(acct)}</p>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" render={<Link to={accountPath(acct)} aria-label={`Open analytics for ${accountName(acct)}`} />} />}>
            <ArrowUpRight />
          </TooltipTrigger>
          <TooltipContent>Open analytics</TooltipContent>
        </Tooltip>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-divider rounded-control bg-surface-sunken/60 py-2.5">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 px-2 text-center">
            <dt className="text-caption text-ink-faint">{label}</dt>
            <dd className="font-heading text-base font-semibold text-ink tabular-nums">{fmtNum(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-faint">
        {platform === 'reddit' && (
          acct.hasCookie ? (
            <span className="flex items-center gap-1 text-success"><Lock className="size-3" />Session cookie stored</span>
          ) : (
            <span className="flex items-center gap-1 text-danger"><Lock className="size-3" />Error: no session cookie. Remove and add the account again.</span>
          )
        )}
        {acct.lastUpdated && <span>Updated {timeAgo(acct.lastUpdated).toLowerCase()}</span>}
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Remove ${accountName(acct)}`} className="text-ink-muted hover:bg-danger-soft hover:text-danger" />}>
            <Trash2 />
          </TooltipTrigger>
          <TooltipContent>Remove account</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
