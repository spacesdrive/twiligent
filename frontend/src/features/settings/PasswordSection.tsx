import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { PASSWORD_MIN_LENGTH, newPasswordProblem } from '@/lib/passwords';
import { passwordErrorMessage } from '@/lib/authErrors';
import type { AuthErrorLike } from '@/lib/authErrors';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import SettingsSection from './SettingsSection';

export default function PasswordSection() {
  const { user, updatePassword } = useAuth();
  const { showToast } = useAppContext();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = newPasswordProblem(password, confirmation);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      showToast('Password saved. You can now sign in with your email and this password.');
    } catch (err) {
      showToast(`Couldn't save the password. ${passwordErrorMessage(err as AuthErrorLike)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="password"
      title="Password"
      description="Sign in with your email and a password. If you joined with Google, this adds a password to the same account."
    >
      <SurfaceBox>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* lets password managers save the new password against the right account */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <FieldRow label="New password" htmlFor="new-password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              className="max-w-sm"
            />
          </FieldRow>
          <FieldRow label="Confirm the new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              className="max-w-sm"
            />
          </FieldRow>
          <Button type="submit" variant="outline" className="self-start" disabled={saving || !password || !confirmation}>
            {saving ? <Spinner className="size-4" /> : <KeyRound data-icon="inline-start" />}
            Save password
          </Button>
        </form>
      </SurfaceBox>
    </SettingsSection>
  );
}
