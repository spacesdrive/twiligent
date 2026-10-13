import React, { useEffect, useState } from 'react';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { useLocation } from 'react-router-dom';
import {
  RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Copy, Check, Save, Sun, Moon, Monitor, Activity, Clock,
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
import InstagramTesterNotice from '@/components/InstagramTesterNotice';
import { ADMIN_EMAIL, adminMailto } from '@/lib/contact';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';

const WORKFLOW_FILE = '.github/workflows/publish-scheduled.yml';
const SECRET_NAMES = [
  { name: 'SUPABASE_URL', hint: 'Your Supabase project URL. Supabase dashboard, Project Settings, API.' },
  { name: 'SUPABASE_SERVICE_KEY', hint: 'The service_role key from the same page. It can read and write every table, so it goes only into GitHub secrets, never into code or chat.' },
];

function repoLinks(owner, repo) {
  if (!owner || !repo) return null;
  const base = `https://github.com/${owner.trim()}/${repo.trim()}`;
  return {
    newSecret: `${base}/settings/secrets/actions/new`,
    actions: `${base}/actions`,
    workflow: `${base}/actions/workflows/publish-scheduled.yml`,
  };
}

const LINKS = [
  { label: 'Supabase API settings', href: 'https://supabase.com/dashboard/project/_/settings/api' },
  { label: 'Cloudinary console', href: 'https://cloudinary.com/console' },
  { label: 'Google Cloud credentials', href: 'https://console.cloud.google.com/apis/credentials' },
  { label: 'Meta app dashboard', href: 'https://developers.facebook.com/apps' },
  { label: 'Cloudflare dashboard', href: 'https://dash.cloudflare.com' },
];

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

function Steps({ steps }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-mono text-caption font-medium text-ink-muted">{i + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <p className="text-sm font-medium text-ink">{step.title}</p>
            <div className="text-sm text-ink-muted [&_a]:font-medium [&_a]:text-brand-text [&_a]:underline-offset-4 [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-ink">{step.body}</div>
            {step.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SettingsSection({ id, title, description, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-20 grid-cols-1 gap-4 border-t border-line pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-heading text-section font-semibold text-ink">{title}</h2>
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
  const { theme, setTheme } = useSmoothTheme();

  const [serverStatus, setServerStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const [ghRepoOwner, setGhRepoOwner] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
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

  // Links such as /settings#scheduling jump to their section once the page has loaded
  useEffect(() => {
    if (loading || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loading, location.hash]);

  // Only the repository is kept: it fills in the direct links in the setup guide. No token is needed.
  const handleSaveGithub = async e => {
    e.preventDefault();
    setGhSaving(true);
    try {
      await api.saveGithubSettings({ repoOwner: ghRepoOwner.trim(), repoName: ghRepoName.trim(), branch: 'main' });
      showToast('Repository saved. The links in the guide now point to it.');
    } catch (err) {
      showToast(`Couldn't save the repository. ${err.message}`, 'error');
    } finally {
      setGhSaving(false);
    }
  };

  const links = repoLinks(ghRepoOwner, ghRepoName);
  const adminSteps = [
    {
      title: 'Check the server scheduler',
      body: <>The Cloudflare Worker publishes due posts every 15 minutes. It is set up by deploying the backend (the cron is in <code className="font-mono text-small">backend/wrangler.toml</code>). In the Cloudflare dashboard, open Workers and Pages, then the twiligent Worker, then Settings, and confirm the trigger <code className="font-mono text-small">*/15 * * * *</code> is listed. Nothing else is required for scheduling to work.</>,
    },
    {
      title: 'Optional: add the GitHub Actions backup',
      body: <>The repository includes <code className="font-mono text-small">{WORKFLOW_FILE}</code>, which publishes due posts if the Worker cron is paused or failing. It needs your own copy of the repository on GitHub (a fork or a clone you pushed). Enter it below to get direct links.</>,
    },
    {
      title: 'Add two repository secrets',
      body: <>In the repository on GitHub, open Settings, then Secrets and variables, then Actions, then New repository secret. {links && <a href={links.newSecret} target="_blank" rel="noopener noreferrer">Open the new secret page</a>}</>,
      extra: (
        <div className="mt-1.5 flex flex-col gap-2">
          {SECRET_NAMES.map(secret => (
            <div key={secret.name} className="flex flex-col gap-1 rounded-control border border-line bg-surface-sunken px-3 py-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-small text-ink">{secret.name}</code>
                <CopyButton text={secret.name} />
              </div>
              <p className="text-caption text-ink-faint">{secret.hint}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Turn on the workflow',
      body: <>Open the Actions tab. Forks start with workflows switched off: choose the button to enable them. Then open <strong>Instagram Scheduled Publisher</strong> and choose Enable workflow if GitHub shows it as disabled. {links && <a href={links.workflow} target="_blank" rel="noopener noreferrer">Open the workflow</a>}</>,
    },
    {
      title: 'Run it once to test',
      body: 'On the workflow page choose Run workflow. Open the run: the log ends with "No posts due for publishing" or lists the posts it published. A red run with "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY" means a secret name is misspelled.',
    },
    {
      title: 'Mind the free minutes on private repositories',
      body: <>Public repositories run Actions for free. Private ones get 2,000 minutes a month, and a run every 15 minutes uses more than that. For a private repository, change the cron in <code className="font-mono text-small">{WORKFLOW_FILE}</code> to <code className="font-mono text-small">*/30 * * * *</code>. GitHub also pauses scheduled workflows in public repositories after 60 days without commits; re-enable it from the Actions tab if that happens.</>,
    },
  ];

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
          id="scheduling"
          title="Scheduled publishing"
          description="How scheduled Instagram posts go out, and what the person who runs this instance sets up once."
        >
          <SurfaceBox title="How it works for you">
            <Steps steps={[
              { title: 'Schedule a post', body: 'In Publish, choose an account, the content type and the file, write the caption, pick Schedule, then a date and time, and choose Schedule post. The file uploads straight away.' },
              { title: 'The server publishes it', body: 'Within 15 minutes after the time you picked, the server publishes the post. Your browser can be closed and your computer can be off.' },
              { title: 'Keep the account connected', body: 'The post uses the Instagram account you picked. If that account is removed or its access expires before the time, the post fails and shows the reason under Publish, Scheduled posts. Refresh the account in Accounts if Instagram asks you to reconnect.' },
              {
                title: 'If a post stays Pending',
                body: <>A post still Pending 30 minutes after its time means the scheduler on this server is not running. Email the administrator at <a href={adminMailto('Scheduled posts are not publishing on Twiligent')}>{ADMIN_EMAIL}</a> with the time of the post. You can edit or delete a Pending post at any time.</>,
              },
            ]} />
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-control bg-surface-sunken/60 px-3 py-2.5 text-small text-ink-muted">
              <Clock className="size-4 shrink-0 stroke-[1.75] text-ink-faint" />
              Instagram allows up to 100 posts per account in any 24 hours, including scheduled ones.
            </div>
          </SurfaceBox>

          <SurfaceBox title="Set up for administrators" subheader="Only the person who deploys this Twiligent instance does this, once.">
            <form className="mb-6 flex flex-col gap-4" onSubmit={handleSaveGithub}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow label="GitHub repository owner" hint="Your GitHub username or organisation" htmlFor="gh-owner">
                  <Input id="gh-owner" placeholder="your-username" value={ghRepoOwner} onChange={e => setGhRepoOwner(e.target.value)} autoComplete="off" />
                </FieldRow>
                <FieldRow label="Repository name" hint="Your copy of the Twiligent repository" htmlFor="gh-repo">
                  <Input id="gh-repo" placeholder="twiligent" value={ghRepoName} onChange={e => setGhRepoName(e.target.value)} autoComplete="off" />
                </FieldRow>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="outline" disabled={ghSaving || !ghRepoOwner.trim() || !ghRepoName.trim()}>
                  {ghSaving ? <Spinner className="size-4" /> : <Save data-icon="inline-start" />}
                  {ghSaving ? 'Saving' : 'Save repository'}
                </Button>
                {links && (
                  <Button variant="ghost" render={<a href={links.actions} target="_blank" rel="noopener noreferrer" />}>
                    <ExternalLink data-icon="inline-start" />Open Actions
                  </Button>
                )}
              </div>
              <p className="text-caption text-ink-faint">No personal access token is needed. Scheduling never writes to GitHub; the workflow only reads due posts from Supabase.</p>
            </form>
            <Steps steps={adminSteps} />
            <p className="mt-5 text-caption text-ink-faint">The Worker and the workflow can run side by side. Each post is claimed by whichever runs first, so it is never published twice.</p>
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
                <li>Get tester access from the administrator and accept the invite (below).</li>
                <li>In Accounts, choose Add account, then Instagram account, then Continue to Instagram.</li>
                <li>Approve the requested permissions. Instagram sends you back here automatically.</li>
              </ol>
              <InstagramTesterNotice className="mt-2" />
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

        <SettingsSection id="about" title="About Twiligent" description="Analytics and publishing for YouTube, Instagram and Reddit, run on your own infrastructure." />
      </div>
    </div>
  );
}
