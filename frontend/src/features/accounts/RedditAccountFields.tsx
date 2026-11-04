import React from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldRow } from '@/components/DetailPanel';

export interface RedditAccountFieldsProps {
  username: string;
  cookie: string;
  onUsernameChange: (value: string) => void;
  onUsernameBlur: () => void;
  onCookieChange: (value: string) => void;
  onSubmit: () => void;
  usernameError?: string;
  cookieError?: string;
}

// a real form, so Enter submits once and the busy guard in the add step stops a second request
export default function RedditAccountFields({
  username, cookie, onUsernameChange, onUsernameBlur, onCookieChange, onSubmit, usernameError, cookieError,
}: RedditAccountFieldsProps) {
  return (
    <form
      id="add-account-form"
      noValidate
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
      className="flex flex-col gap-4"
    >
      <FieldRow label="Username" htmlFor="reddit-user" hint="The name, u/name or the address of the profile." error={usernameError}>
        <Input
          id="reddit-user"
          className="h-(--control-h-lg)"
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
          onBlur={onUsernameBlur}
          placeholder="u/username"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </FieldRow>
      <FieldRow label="Session cookie" hint="Stored on the server and never shown again." htmlFor="reddit-cookie" error={cookieError}>
        <Input
          id="reddit-cookie"
          type="password"
          className="h-(--control-h-lg) font-mono"
          value={cookie}
          onChange={e => onCookieChange(e.target.value)}
          placeholder="reddit_session value"
          autoComplete="off"
        />
      </FieldRow>
      <Alert>
        <Info />
        <AlertDescription>
          {'Sign in to reddit.com in your browser, open DevTools (F12), go to Application, then Cookies, then https://www.reddit.com, and copy the value of '}
          <strong className="font-semibold text-ink">reddit_session</strong>.
        </AlertDescription>
      </Alert>
      {/* lets Enter in either field submit the form */}
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
  );
}
