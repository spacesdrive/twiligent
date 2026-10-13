import React from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldRow } from '@/components/DetailPanel';

export default function RedditAccountFields({ username, cookie, onUsernameChange, onCookieChange, onSubmit }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Username" htmlFor="reddit-user">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-ink-faint">u/</span>
          <Input
            id="reddit-user"
            className="h-(--control-h-lg) pl-8"
            value={username}
            onChange={e => onUsernameChange(e.target.value)}
            placeholder="username"
            onKeyDown={e => e.key === 'Enter' && onSubmit()}
            autoFocus
          />
        </div>
      </FieldRow>
      <FieldRow label="Session cookie" hint="We store it on the server and never show it again." htmlFor="reddit-cookie">
        <Input
          id="reddit-cookie"
          type="password"
          className="h-(--control-h-lg) font-mono"
          value={cookie}
          onChange={e => onCookieChange(e.target.value)}
          placeholder="reddit_session value"
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
        />
      </FieldRow>
      <Alert>
        <Info />
        <AlertDescription>
          {'Sign in to reddit.com in your browser, open DevTools (F12), go to Application, then Cookies, then https://www.reddit.com, and copy the value of '}
          <strong className="font-semibold text-ink">reddit_session</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
