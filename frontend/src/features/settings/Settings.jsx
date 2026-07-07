import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, CheckCircle2, Info, AlertTriangle, ShieldCheck, GitBranch,
  Key, ExternalLink, Copy, Check, Save,
} from 'lucide-react';
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted hover:bg-muted/70 border border-border transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StepBadge({ n }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
      {n}
    </span>
  );
}

export default function Settings() {
  const { showToast, refreshAll } = useAppContext();

  const [serverStatus, setServerStatus]   = useState(null);
  const [testing,      setTesting]        = useState(false);
  const [testResult,   setTestResult]     = useState(null);
  const [loading,      setLoading]        = useState(true);

  const [ghPat,        setGhPat]          = useState('');
  const [ghRepoOwner,  setGhRepoOwner]    = useState('');
  const [ghRepoName,   setGhRepoName]     = useState('');
  const [ghBranch,     setGhBranch]       = useState('main');
  const [ghPatSet,     setGhPatSet]       = useState(false);
  const [ghSaving,     setGhSaving]       = useState(false);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [keys, gh] = await Promise.all([api.getKeys(), api.getGithubSettings()]);
      setServerStatus(keys);
      setGhRepoOwner(gh.repoOwner || '');
      setGhRepoName(gh.repoName || '');
      setGhBranch(gh.branch || 'main');
      setGhPatSet(gh.patSet || false);
    } catch {
      try {
        const keys = await api.getKeys();
        setServerStatus(keys);
      } catch { /* non-critical */ }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGithub = async () => {
    setGhSaving(true);
    try {
      await api.saveGithubSettings({ pat: ghPat || undefined, repoOwner: ghRepoOwner, repoName: ghRepoName, branch: ghBranch });
      showToast('GitHub settings saved');
      if (ghPat) setGhPatSet(true);
      setGhPat('');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setGhSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await api.health();
      setTestResult({ success: res.status === 'ok', message: res.status === 'ok' ? 'API connection successful!' : 'Unexpected status.' });
    } catch (err) {
      setTestResult({ success: false, message: 'Connection failed: ' + err.message });
    } finally { setTesting(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform configuration and guides</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">

          {/* Server-managed keys status */}
          <MainCard title="Server API Keys">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">All API keys are managed by the server</p>
                  <p className="text-sm text-muted-foreground">
                    YouTube, Instagram, and Cloudinary credentials are set as environment variables by the administrator and shared across all users.
                  </p>
                </div>
              </div>
              {serverStatus && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'YouTube',    ok: serverStatus.youtube?.configured },
                    { label: 'Instagram',  ok: serverStatus.instagram?.configured },
                    { label: 'Cloudinary', ok: serverStatus.cloudinary?.configured },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                      {ok
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                      <div>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{ok ? 'Configured' : 'Not set'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </MainCard>

          {/* GitHub credentials */}
          <MainCard title="GitHub Integration">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <GitBranch className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Connect your GitHub repository</p>
                  <p className="text-sm text-muted-foreground">
                    Used for GitHub Actions-based scheduled publishing. The PAT lets the scheduler
                    trigger workflows in your repository.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gh-owner" className="text-xs">Repository owner</Label>
                  <Input
                    id="gh-owner"
                    placeholder="spacesdrive"
                    value={ghRepoOwner}
                    onChange={e => setGhRepoOwner(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gh-repo" className="text-xs">Repository name</Label>
                  <Input
                    id="gh-repo"
                    placeholder="twiligent"
                    value={ghRepoName}
                    onChange={e => setGhRepoName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gh-branch" className="text-xs">Branch</Label>
                <Input
                  id="gh-branch"
                  placeholder="main"
                  value={ghBranch}
                  onChange={e => setGhBranch(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gh-pat" className="text-xs">
                  Personal Access Token
                  {ghPatSet && (
                    <Badge variant="secondary" className="ml-2 text-xs font-normal">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />saved
                    </Badge>
                  )}
                </Label>
                <Input
                  id="gh-pat"
                  type="password"
                  placeholder={ghPatSet ? 'Enter new token to replace saved one' : 'github_pat_...'}
                  value={ghPat}
                  onChange={e => setGhPat(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">Leave blank to keep the existing token. See the guide below for how to create one.</p>
              </div>

              <Button size="sm" className="gap-2" onClick={handleSaveGithub} disabled={ghSaving}>
                {ghSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save GitHub Settings
              </Button>
            </div>
          </MainCard>

          {/* GitHub guide */}
          <MainCard title="GitHub Personal Access Token">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <GitBranch className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">What is a GitHub PAT and why do you need it?</p>
                  <p className="text-sm text-muted-foreground">
                    A Personal Access Token lets external services (like this app or a CI workflow) interact with
                    your GitHub repositories on your behalf. In Twiligent it is used for GitHub Actions-based
                    scheduled publishing when deploying via Cloudflare Workers.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">How to create a GitHub PAT (step-by-step)</p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <StepBadge n={1} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Open GitHub Settings</p>
                      <p className="text-sm text-muted-foreground">
                        Go to <strong>github.com</strong>, click your profile photo (top-right), then click{' '}
                        <strong>Settings</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={2} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Go to Developer Settings</p>
                      <p className="text-sm text-muted-foreground">
                        Scroll to the very bottom of the left sidebar and click{' '}
                        <strong>Developer settings</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={3} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Create a Fine-grained token</p>
                      <p className="text-sm text-muted-foreground">
                        Click <strong>Personal access tokens</strong> then{' '}
                        <strong>Fine-grained tokens</strong> then{' '}
                        <strong>Generate new token</strong>.
                        Fine-grained tokens are safer than classic tokens because you choose exact permissions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={4} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Set token details</p>
                      <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                        <li><strong className="text-foreground">Token name:</strong> give it a clear name like <em>twiligent-actions</em></li>
                        <li><strong className="text-foreground">Expiration:</strong> pick 90 days or custom (you can always regenerate)</li>
                        <li><strong className="text-foreground">Repository access:</strong> select <em>Only select repositories</em>, then choose the repo</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={5} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Set permissions</p>
                      <p className="text-sm text-muted-foreground">
                        Under <strong>Repository permissions</strong>, enable:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {['Actions: Read and write', 'Secrets: Read and write', 'Contents: Read-only'].map(p => (
                          <Badge key={p} variant="secondary" className="text-xs font-normal">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={6} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Copy the token immediately</p>
                      <p className="text-sm text-muted-foreground">
                        Click <strong>Generate token</strong>. GitHub shows the token once only.
                        Copy it right away and store it somewhere safe (like a password manager).
                        If you lose it you must generate a new one.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <StepBadge n={7} />
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm font-medium">Add it as a GitHub Actions secret</p>
                      <p className="text-sm text-muted-foreground">
                        In your repository, go to <strong>Settings</strong> then <strong>Secrets and variables</strong>{' '}
                        then <strong>Actions</strong> then <strong>New repository secret</strong>.
                        Name it exactly:
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 font-mono text-xs bg-muted px-3 py-2 rounded-md border border-border">
                        <Key className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1">GITHUB_PAT</span>
                        <CopyButton text="GITHUB_PAT" />
                      </div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Never share your token in code, commit it to git, or paste it in a public place.
                    If a token is accidentally exposed, go to GitHub and delete it immediately, then generate a new one.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </MainCard>

          {/* Platform requirements */}
          <MainCard title="Platform Requirements">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">YouTube</p>
                <p className="text-sm text-muted-foreground">
                  Just add a channel URL or @handle in <strong>Manage Accounts</strong>. The API key is already configured by the server.
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Instagram</p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Your account must be a <strong className="text-foreground">Business</strong> or <strong className="text-foreground">Creator</strong> professional account</li>
                  <li>Go to <strong className="text-foreground">Manage Accounts</strong> then Add Account then Instagram</li>
                  <li>Click <strong className="text-foreground">Connect with Instagram</strong> and you will log in directly on Instagram</li>
                  <li>Grant the requested permissions and you will be redirected back automatically</li>
                </ol>
                <Alert className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    In development mode, only <strong>test users</strong> added in the Facebook App Dashboard can connect. Your Instagram account must be added as a tester there first.
                  </AlertDescription>
                </Alert>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Cloudinary (Instagram uploads)</p>
                <p className="text-sm text-muted-foreground">
                  Instagram requires all media to be hosted at a public URL before publishing. Cloudinary handles this automatically.
                  The cloud name and upload preset are configured server-side. No action needed from you.
                </p>
              </div>
            </div>
          </MainCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="sticky top-20 space-y-4">
            <MainCard title="Quick Actions">
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={refreshAll}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh All Accounts
                </Button>
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={handleTest} disabled={testing}>
                  {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Test API Health
                </Button>
              </div>
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'} className="mt-3">
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertDescription className="text-xs">{testResult.message}</AlertDescription>
                </Alert>
              )}
            </MainCard>

            <MainCard title="Useful Links">
              <div className="space-y-2">
                {[
                  { label: 'GitHub Settings', href: 'https://github.com/settings/profile' },
                  { label: 'GitHub Fine-grained tokens', href: 'https://github.com/settings/tokens?type=beta' },
                  { label: 'Cloudinary Dashboard', href: 'https://cloudinary.com/console' },
                  { label: 'Google Cloud Console', href: 'https://console.cloud.google.com/apis/credentials' },
                  { label: 'Facebook App Dashboard', href: 'https://developers.facebook.com/apps' },
                  { label: 'Cloudflare Dashboard', href: 'https://dash.cloudflare.com' },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {label}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </MainCard>

            <MainCard title="About">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Twiligent is a comprehensive analytics tool for tracking YouTube and Instagram performance.
                </p>
                <Separator />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'React',          color: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' },
                    { label: 'shadcn/ui',      color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' },
                    { label: 'Tailwind v4',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' },
                    { label: 'Hono',           color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
                    { label: 'Supabase',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
                    { label: 'Cloudflare',     color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
                    { label: 'YouTube API',    color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
                    { label: 'Instagram API',  color: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800' },
                  ].map(c => (
                    <span key={c.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </MainCard>
          </div>
        </div>
      </div>
    </div>
  );
}
