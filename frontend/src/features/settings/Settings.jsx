import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  RefreshCw, CheckCircle2, Info, AlertTriangle, ExternalLink, Copy, Check, Save, Sun, Moon, Monitor, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';

const PAT_STEPS = [
  { title: 'Open GitHub settings', body: <>On github.com, open your profile menu (top right) and choose <strong>Settings</strong>.</> },
  { title: 'Open developer settings', body: <>At the bottom of the left sidebar, choose <strong>Developer settings</strong>.</> },
  { title: 'Create a fine-grained token', body: <>Choose <strong>Personal access tokens</strong>, then <strong>Fine-grained tokens</strong>, then <strong>Generate new token</strong>. Fine-grained tokens let you pick exact permissions.</> },
  { title: 'Name the token and pick the repository', body: <>Use a clear name such as <em>twiligent-actions</em>, an expiry of 90 days or less, and <em>Only select repositories</em> with this project selected.</> },
  { title: 'Set permissions', body: <>Under Repository permissions, enable <Badge variant="secondary">Actions: read and write</Badge> <Badge variant="secondary">Secrets: read and write</Badge> <Badge variant="secondary">Contents: read-only</Badge></> },
  { title: 'Copy the token now', body: <>Choose <strong>Generate token</strong>. GitHub shows it once, so copy it into a password manager straight away. A lost token has to be generated again.</> },
  { title: 'Add it as an Actions secret', body: 'In the repository, open Settings, then Secrets and variables, then Actions, then New repository secret. Name it exactly:', code: 'GITHUB_PAT' },
];

const LINKS = [
  { label: 'GitHub settings', href: 'https://github.com/settings/profile' },
  { label: 'GitHub fine-grained tokens', href: 'https://github.com/settings/tokens?type=beta' },
  { label: 'Cloudinary console', href: 'https://cloudinary.com/console' },
  { label: 'Google Cloud credentials', href: 'https://console.cloud.google.com/apis/credentials' },
  { label: 'Meta app dashboard', href: 'https://developers.facebook.com/apps' },
  { label: 'Cloudflare dashboard', href: 'https://dash.cloudflare.com' },
];

const STACK = ['React', 'shadcn/ui', 'Tailwind CSS', 'Hono', 'Supabase', 'Cloudflare', 'YouTube Data API', 'Instagram Graph API'];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button variant="ghost" size="xs" onClick={handleCopy} aria-label={copied ? 'Copied' : `Copy ${text}`}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function SettingsSection({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="grid grid-cols-1 gap-4 border-t border-line pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-heading text-section font-semibold text-ink">{title}</h2>
        {description && <p className="text-small text-ink-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function StatusRow({ label, ok, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-caption text-ink-faint">{hint}</p>}
      </div>
      {ok ? (
        <Badge variant="success"><CheckCircle2 />Configured</Badge>
      ) : (
        <Badge variant="warning"><AlertTriangle />Not set</Badge>
      )}
    </div>
  );
}

export default function Settings() {
  const { showToast, refreshAll, loading: refreshingAll } = useAppContext();
  const { theme, setTheme } = useTheme();

  const [serverStatus, setServerStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const [ghPat, setGhPat] = useState('');
  const [ghRepoOwner, setGhRepoOwner] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghPatSet, setGhPatSet] = useState(false);
  const [ghSaving, setGhSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [keys, gh] = await Promise.all([api.getKeys(), api.getGithubSettings()]);
        if (cancelled) return;
        setServerStatus(keys);
        setGhRepoOwner(gh.repoOwner || '');
        setGhRepoName(gh.repoName || '');
        setGhBranch(gh.branch || 'main');
        setGhPatSet(gh.patSet || false);
      } catch {
        try {
          const keys = await api.getKeys();
          if (!cancelled) setServerStatus(keys);
        } catch { /* status is informational; the page still renders */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveGithub = async e => {
    e.preventDefault();
    setGhSaving(true);
    try {
      await api.saveGithubSettings({ pat: ghPat || undefined, repoOwner: ghRepoOwner, repoName: ghRepoName, branch: ghBranch });
      showToast('GitHub settings saved');
      if (ghPat) setGhPatSet(true);
      setGhPat('');
    } catch (err) {
      showToast(`Couldn't save GitHub settings. ${err.message}`, 'error');
    } finally {
      setGhSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.health();
      setTestResult(res.status === 'ok'
        ? { success: true, message: 'The API is reachable and healthy.' }
        : { success: false, message: `The API answered with status "${res.status}". Check the Worker logs.` });
    } catch (err) {
      setTestResult({ success: false, message: `The API could not be reached: ${err.message}. Check VITE_API_URL and that the Worker is deployed.` });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Settings" description="Appearance, connections and setup guides" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-card" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" description="Appearance, connections and setup guides" />

      <div className="flex flex-col gap-8">
        <SettingsSection id="appearance" title="Appearance" description="Choose a theme or follow your system setting.">
          <SurfaceBox>
            <FieldRow label="Theme" hint="Dusk is the dark theme, Paper the light one.">
              <Tabs value={theme ?? 'system'} onValueChange={setTheme}>
                <TabsList variant="segmented" className="w-full sm:w-fit">
                  <TabsTrigger value="light"><Sun />Light</TabsTrigger>
                  <TabsTrigger value="dark"><Moon />Dark</TabsTrigger>
                  <TabsTrigger value="system"><Monitor />System</TabsTrigger>
                </TabsList>
              </Tabs>
            </FieldRow>
          </SurfaceBox>
        </SettingsSection>

        <SettingsSection
          id="server-keys"
          title="Server API keys"
          description="YouTube, Instagram and Cloudinary credentials are environment variables on the server, shared by everyone on this instance."
        >
          <SurfaceBox content={false} className="divide-y divide-divider">
            <StatusRow label="YouTube" hint="Channel and video analytics" ok={serverStatus?.youtube?.configured} />
            <StatusRow label="Instagram" hint="Account connection and publishing" ok={serverStatus?.instagram?.configured} />
            <StatusRow label="Cloudinary" hint="Media hosting for publishing" ok={serverStatus?.cloudinary?.configured} />
          </SurfaceBox>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Spinner className="size-4" /> : <Activity data-icon="inline-start" />}
              {testing ? 'Checking API' : 'Check API health'}
            </Button>
            <Button variant="outline" onClick={refreshAll} disabled={refreshingAll}>
              <RefreshCw data-icon="inline-start" className={cn(refreshingAll && 'animate-spin')} />
              {refreshingAll ? 'Refreshing accounts' : 'Refresh all accounts'}
            </Button>
          </div>
          {testResult && (
            <Alert variant={testResult.success ? 'success' : 'destructive'}>
              {testResult.success ? <CheckCircle2 /> : <AlertTriangle />}
              <AlertDescription>{testResult.success ? '' : 'Error: '}{testResult.message}</AlertDescription>
            </Alert>
          )}
        </SettingsSection>

        <SettingsSection
          id="github"
          title="GitHub"
          description="Used for scheduled publishing through GitHub Actions. The token lets the scheduler trigger workflows in your repository."
        >
          <SurfaceBox>
            <form className="flex flex-col gap-5" onSubmit={handleSaveGithub}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FieldRow label="Repository owner" htmlFor="gh-owner">
                  <Input id="gh-owner" placeholder="owner" value={ghRepoOwner} onChange={e => setGhRepoOwner(e.target.value)} autoComplete="off" />
                </FieldRow>
                <FieldRow label="Repository name" htmlFor="gh-repo">
                  <Input id="gh-repo" placeholder="twiligent" value={ghRepoName} onChange={e => setGhRepoName(e.target.value)} autoComplete="off" />
                </FieldRow>
              </div>
              <FieldRow label="Branch" htmlFor="gh-branch">
                <Input id="gh-branch" placeholder="main" value={ghBranch} onChange={e => setGhBranch(e.target.value)} autoComplete="off" className="sm:max-w-xs" />
              </FieldRow>
              <FieldRow
                label={<span className="flex items-center gap-2">Personal access token{ghPatSet && <Badge variant="success"><CheckCircle2 />Saved</Badge>}</span>}
                hint="Leave blank to keep the saved token. The guide below explains how to create one."
                htmlFor="gh-pat"
              >
                <Input
                  id="gh-pat"
                  type="password"
                  placeholder={ghPatSet ? 'Enter a new token to replace the saved one' : 'github_pat_...'}
                  value={ghPat}
                  onChange={e => setGhPat(e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                />
              </FieldRow>
              <div>
                <Button type="submit" disabled={ghSaving}>
                  {ghSaving ? <Spinner className="size-4" /> : <Save data-icon="inline-start" />}
                  {ghSaving ? 'Saving' : 'Save GitHub settings'}
                </Button>
              </div>
            </form>
          </SurfaceBox>

          <SurfaceBox title="Create a GitHub personal access token" subheader="A token lets this app and its workflow act on your repository on your behalf.">
            <ol className="flex flex-col gap-4">
              {PAT_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-mono text-caption font-medium text-ink-muted">{i + 1}</span>
                  <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                    <p className="text-sm font-medium text-ink">{step.title}</p>
                    <div className="text-sm text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">{step.body}</div>
                    {step.code && (
                      <div className="mt-1.5 flex items-center gap-2 rounded-control border border-line bg-surface-sunken px-3 py-1.5">
                        <code className="flex-1 font-mono text-small text-ink">{step.code}</code>
                        <CopyButton text={step.code} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <Alert variant="warning" className="mt-5">
              <AlertTriangle />
              <AlertDescription>
                Never put a token in code, a commit or a public place. If one is exposed, delete it on GitHub straight away and generate a new one.
              </AlertDescription>
            </Alert>
          </SurfaceBox>
        </SettingsSection>

        <SettingsSection id="platforms" title="Platform requirements" description="What each platform needs before it can be added.">
          <SurfaceBox content={false} className="divide-y divide-divider">
            <div className="flex flex-col gap-1 px-5 py-4">
              <p className="text-sm font-medium text-ink">YouTube</p>
              <p className="text-sm text-ink-muted">Add a channel link or @handle in Accounts. The API key is already set on the server.</p>
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              <p className="text-sm font-medium text-ink">Instagram</p>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-muted marker:text-ink-faint">
                <li>The account must be an Instagram Business or Creator account.</li>
                <li>In Accounts, choose Add account, then Instagram account.</li>
                <li>Continue to Instagram and sign in there.</li>
                <li>Approve the requested permissions. Instagram sends you back here automatically.</li>
              </ol>
              <Alert variant="info" className="mt-2">
                <Info />
                <AlertDescription>
                  While the Meta app is in development mode, only test users added in the Meta app dashboard can connect. Add your Instagram account as a tester first.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex flex-col gap-1 px-5 py-4">
              <p className="text-sm font-medium text-ink">Cloudinary</p>
              <p className="text-sm text-ink-muted">Instagram needs every file at a public URL before publishing. Cloudinary hosts uploads for that; its cloud name and upload preset are set on the server.</p>
            </div>
          </SurfaceBox>
        </SettingsSection>

        <SettingsSection id="links" title="Useful links">
          <SurfaceBox content={false} className="divide-y divide-divider">
            {LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-ink transition-colors duration-(--duration-fast) hover:bg-surface-hover"
              >
                {label}
                <ExternalLink className="size-4 shrink-0 text-ink-faint" />
              </a>
            ))}
          </SurfaceBox>
        </SettingsSection>

        <SettingsSection id="about" title="About Twiligent" description="Analytics and publishing for YouTube, Instagram and Reddit, run on your own infrastructure.">
          <div className="flex flex-wrap gap-1.5">
            {STACK.map(item => <Badge key={item} variant="outline">{item}</Badge>)}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
