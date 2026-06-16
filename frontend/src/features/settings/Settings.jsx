import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  KeyRound, Save, Eye, EyeOff, CheckCircle2, RefreshCw,
  Info, GitBranch, Code2, Camera, Cloud, RotateCcw, AlertTriangle,
} from 'lucide-react';
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';

function SecretInput({ value, onChange, placeholder, showByDefault = false, icon: Icon = KeyRound, ...props }) {
  const [show, setShow] = useState(showByDefault);
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />}
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn('pr-10', Icon && 'pl-9')}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SettingSection({ title, icon: Icon, children, action }) {
  return (
    <MainCard
      title={title}
      secondary={action}
      className="mb-4"
    >
      <div className="space-y-4">{children}</div>
    </MainCard>
  );
}

export default function Settings() {
  const { showToast, refreshAll } = useAppContext();

  const [apiKey,           setApiKey]           = useState('');
  const [igAppId,          setIgAppId]          = useState('');
  const [igAppSecret,      setIgAppSecret]      = useState('');
  const [cloudinaryName,   setCloudinaryName]   = useState('');
  const [cloudinaryPreset, setCloudinaryPreset] = useState('');
  const [githubToken,      setGithubToken]      = useState('');
  const [githubRepo,       setGithubRepo]       = useState('');
  const [githubBranch,     setGithubBranch]     = useState('main');
  const [saving,           setSaving]           = useState(false);
  const [savingIg,         setSavingIg]         = useState(false);
  const [savingCloud,      setSavingCloud]       = useState(false);
  const [savingGh,         setSavingGh]         = useState(false);
  const [syncingGh,        setSyncingGh]        = useState(false);
  const [testing,          setTesting]          = useState(false);
  const [testResult,       setTestResult]       = useState(null);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => { loadKeys(); }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res = await api.getKeys();
      setApiKey(res.youtube || '');
      if (res.instagram) { setIgAppId(res.instagram.appId || ''); setIgAppSecret(res.instagram.appSecret || ''); }
      if (res.cloudinary) { setCloudinaryName(res.cloudinary.cloudName || ''); setCloudinaryPreset(res.cloudinary.uploadPreset || ''); }
      if (res.github) { setGithubToken(res.github.token || ''); setGithubRepo(res.github.repo || ''); setGithubBranch(res.github.branch || 'main'); }
    } catch (err) {
      showToast('Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await api.saveKey(apiKey); showToast('API key saved successfully'); }
    catch (err) { showToast('Failed to save API key: ' + err.message, 'error'); }
    finally { setSaving(false); }
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

  const handleSaveInstagram = async () => {
    setSavingIg(true);
    try { await api.saveKeys({ instagram: { appId: igAppId, appSecret: igAppSecret } }); showToast('Instagram credentials saved'); }
    catch (err) { showToast('Failed to save: ' + err.message, 'error'); }
    finally { setSavingIg(false); }
  };

  const handleSaveCloudinary = async () => {
    setSavingCloud(true);
    try { await api.saveKeys({ cloudinary: { cloudName: cloudinaryName, uploadPreset: cloudinaryPreset } }); showToast('Cloudinary settings saved'); }
    catch (err) { showToast('Failed to save: ' + err.message, 'error'); }
    finally { setSavingCloud(false); }
  };

  const handleSaveGitHub = async () => {
    setSavingGh(true);
    try { await api.saveKeys({ github: { token: githubToken, repo: githubRepo, branch: githubBranch } }); showToast('GitHub settings saved'); }
    catch (err) { showToast('Failed to save: ' + err.message, 'error'); }
    finally { setSavingGh(false); }
  };

  const handleSyncGitHub = async () => {
    setSyncingGh(true);
    try { await api.syncToGitHub(); showToast('Scheduled posts synced to GitHub'); }
    catch (err) { showToast('Sync failed: ' + err.message, 'error'); }
    finally { setSyncingGh(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure API keys and integrations</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-4">

          {/* YouTube API Key */}
          <MainCard title="YouTube Data API Key">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Required to fetch YouTube channel and video data. Get your key from the{' '}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline font-medium">
                  Google Cloud Console
                </a>.
              </p>
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <SecretInput value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIzaSy…" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSave} disabled={saving || !apiKey.trim()} className="gap-2" size="sm">
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Key
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing} size="sm" className="gap-2">
                  {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Test Connection
                </Button>
              </div>
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </MainCard>

          {/* Instagram */}
          <MainCard title="Instagram App Credentials">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Optional — enables long-lived token exchange. Get these from{' '}
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-pink-600 underline-offset-4 hover:underline font-medium">
                  App Dashboard → Instagram → API setup
                </a>.
              </p>
              <div className="space-y-1.5">
                <Label>Instagram App ID</Label>
                <div className="relative">
                  <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" value={igAppId} onChange={e => setIgAppId(e.target.value)} placeholder="Instagram App ID" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Instagram App Secret</Label>
                <SecretInput value={igAppSecret} onChange={e => setIgAppSecret(e.target.value)} placeholder="Instagram App Secret" />
              </div>
              <Button onClick={handleSaveInstagram} disabled={savingIg || (!igAppId.trim() && !igAppSecret.trim())} size="sm" className="gap-2">
                {savingIg ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Instagram Credentials
              </Button>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Only the <strong>App Secret</strong> is needed for token exchange. Tokens from the App Dashboard are already long-lived (60 days).
                </AlertDescription>
              </Alert>
            </div>
          </MainCard>

          {/* Cloudinary */}
          <MainCard title="Cloudinary CDN (Instagram Uploads)">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instagram API requires media at a public URL. Cloudinary hosts your files before publishing.
                Get a free account at{' '}
                <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noreferrer" className="text-blue-600 underline-offset-4 hover:underline font-medium">
                  cloudinary.com
                </a>.
              </p>
              <div className="space-y-1.5">
                <Label>Cloud Name</Label>
                <div className="relative">
                  <Cloud className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" value={cloudinaryName} onChange={e => setCloudinaryName(e.target.value)} placeholder="my-cloud-name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Upload Preset (unsigned)</Label>
                <div className="relative">
                  <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" value={cloudinaryPreset} onChange={e => setCloudinaryPreset(e.target.value)} placeholder="ml_default" />
                </div>
              </div>
              <Button onClick={handleSaveCloudinary} disabled={savingCloud || !cloudinaryName.trim()} size="sm" className="gap-2">
                {savingCloud ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Cloudinary Settings
              </Button>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Create an <strong>unsigned upload preset</strong> in Cloudinary → Settings → Upload → Upload presets → Add.
                </AlertDescription>
              </Alert>
            </div>
          </MainCard>

          {/* GitHub Actions */}
          <MainCard title="GitHub Actions (Cloud Scheduling)">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Publish scheduled posts from the cloud — even when your PC is off. Runs every 15 min via GitHub Actions (free).
                Create a{' '}
                <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline font-medium">
                  Fine-grained Personal Access Token
                </a>{' '}
                with <strong>Contents: Read & Write</strong> permission. For automatic account sync, also add <strong>Secrets: Read & Write</strong>.
              </p>
              <div className="space-y-1.5">
                <Label>GitHub Personal Access Token</Label>
                <SecretInput value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Repository (owner/repo)</Label>
                <div className="relative">
                  <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="username/repo-name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <div className="relative">
                  <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" value={githubBranch} onChange={e => setGithubBranch(e.target.value)} placeholder="main" />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSaveGitHub} disabled={savingGh || !githubToken.trim() || !githubRepo.trim()} size="sm" className="gap-2">
                  {savingGh ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save GitHub Settings
                </Button>
                <Button variant="outline" onClick={handleSyncGitHub} disabled={syncingGh || !githubToken.trim() || !githubRepo.trim()} size="sm" className="gap-2">
                  {syncingGh ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Sync Now
                </Button>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  <strong>Setup:</strong> Push this project to GitHub → Settings → Secrets → Add <code className="bg-muted px-1 rounded text-xs">ACCOUNTS_JSON</code> (Base64 of accounts.json). Workflow runs every 15 min automatically.
                </AlertDescription>
              </Alert>
            </div>
          </MainCard>

          {/* How to get keys */}
          <MainCard title="How to Get a YouTube API Key">
            <div className="space-y-4">
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline">Google Cloud Console</a></li>
                <li>Create a new project or select an existing one</li>
                <li>Enable the <strong className="text-foreground">YouTube Data API v3</strong> from the API Library</li>
                <li>Go to <strong className="text-foreground">Credentials → Create Credentials → API Key</strong></li>
                <li>Copy the API key and paste it above</li>
                <li>Optional: Restrict the key to YouTube Data API v3 only</li>
              </ol>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  The free quota allows ~10,000 units/day. Fetching a channel uses ~5 units, video details ~3 units per batch.
                </AlertDescription>
              </Alert>
              <Separator />
              <p className="text-sm font-semibold">How to Get Instagram Access</p>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-pink-600 font-medium hover:underline">Meta for Developers</a> and create a new app (type: <strong className="text-foreground">Business</strong>)</li>
                <li>Add the <strong className="text-foreground">Instagram</strong> product and set up <strong className="text-foreground">API setup with Instagram business login</strong></li>
                <li>Your account must be a <strong className="text-foreground">Business</strong> or <strong className="text-foreground">Creator</strong> professional account</li>
                <li>Find your App ID and App Secret under Business login settings</li>
                <li>Add your account as a <strong className="text-foreground">Tester</strong> under App Roles</li>
                <li>Click <strong className="text-foreground">Generate Token</strong> next to your Instagram account</li>
                <li>Required permission: <code className="bg-muted px-1 rounded text-xs">instagram_business_basic</code></li>
              </ol>
              <Alert variant="destructive" className="border-yellow-200 bg-yellow-50 text-yellow-800 [&>svg]:text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs text-yellow-800">
                  In development mode, only test users / Instagram Testers can use the app. Tokens from the App Dashboard are long-lived (~60 days).
                </AlertDescription>
              </Alert>
            </div>
          </MainCard>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4">
          <div className="sticky top-20 space-y-4">
            <MainCard title="Quick Actions">
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={refreshAll}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh All Accounts
                </Button>
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={handleTest}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Test API Health
                </Button>
              </div>
            </MainCard>

            <MainCard title="About">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Twiligent — a comprehensive analytics tool for tracking YouTube and Instagram performance.
                </p>
                <Separator />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'React', color: 'bg-sky-100 text-sky-700 border-sky-200' },
                    { label: 'shadcn/ui', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
                    { label: 'Tailwind v4', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
                    { label: 'Recharts', color: 'bg-green-100 text-green-700 border-green-200' },
                    { label: 'Node.js', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    { label: 'YouTube API', color: 'bg-red-100 text-red-700 border-red-200' },
                    { label: 'Instagram API', color: 'bg-pink-100 text-pink-700 border-pink-200' },
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
