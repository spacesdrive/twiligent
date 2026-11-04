import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, LogOut, Tag, Plus, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AccountAvatar } from '@/components/platform';
import { filterCommands, groupCommands } from '@/lib/commandSearch';
import { accountName, accountPath, PLATFORM_META, platformOf } from '@/lib/accounts';
import type { AccountFields } from '@/lib/accounts';
import type { SearchCommand } from '@/lib/commandSearch';
import { NAV_GROUPS } from '@/layout/navigation';
import { APP_SHORTCUTS } from '@/layout/shortcuts';
import { docsUrl } from '@/lib/docs';

export interface PaletteCommand extends SearchCommand {
  id: string;
  group: string;
  keywords: string[];
  icon?: LucideIcon;
  avatar?: AccountFields;
  run?: () => unknown;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountFields[];
  categories: string[];
  onRefreshAll: () => unknown;
  onSignOut: () => unknown;
}

export default function CommandPalette({ open, onOpenChange, accounts, categories, onRefreshAll, onSignOut }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery('');
    onOpenChange(next);
  };

  const commands = useMemo((): PaletteCommand[] => [
    ...NAV_GROUPS.flatMap(group => group.items.map(item => ({
      id: `page:${item.path}`, group: 'Pages', label: item.label, keywords: [group.label],
      icon: item.icon, run: () => navigate(item.path),
    }))),
    ...accounts.map(account => ({
      id: `account:${account.id}`, group: 'Accounts', label: accountName(account),
      keywords: [PLATFORM_META[platformOf(account)].label, account.username, account.customUrl].filter(Boolean) as string[],
      avatar: account, run: () => navigate(accountPath(account)),
    })),
    ...categories.map(category => ({
      id: `category:${category}`, group: 'Categories', label: category, keywords: ['tracked', 'category'],
      icon: Tag, run: () => navigate(`/tracked-content/category/${encodeURIComponent(category)}`),
    })),
    { id: 'action:add-account', group: 'Actions', label: 'Add account', keywords: ['connect', 'youtube', 'instagram', 'reddit'], icon: Plus, run: () => navigate('/accounts?add=1') },
    { id: 'action:docs', group: 'Actions', label: 'Open documentation', keywords: ['help', 'guide', 'docs', 'setup', 'self-host'], icon: BookOpen, run: () => window.open(docsUrl(), '_blank', 'noopener') },
    { id: 'action:refresh', group: 'Actions', label: 'Refresh all accounts', keywords: ['sync', 'update'], icon: RefreshCw, run: onRefreshAll },
    { id: 'action:sign-out', group: 'Account', label: 'Sign out', keywords: ['log out', 'logout'], icon: LogOut, run: onSignOut },
  ], [accounts, categories, navigate, onRefreshAll, onSignOut]);

  const grouped = useMemo(() => groupCommands(filterCommands(commands, query)), [commands, query]);

  const runCommand = (command: PaletteCommand) => {
    handleOpenChange(false);
    command.run?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="inset-x-2 top-2 bottom-auto w-auto gap-0 overflow-hidden rounded-dialog p-0 sm:top-[18%] sm:max-w-xl sm:translate-y-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search pages, accounts and actions</DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search pages, accounts and actions" />
          <CommandList>
            <CommandEmpty>Nothing matches "{query}"</CommandEmpty>
            {grouped.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map(command => {
                  const Icon = command.icon;
                  return (
                    <CommandItem key={command.id} value={command.id} onSelect={() => runCommand(command)}>
                      {command.avatar ? <AccountAvatar account={command.avatar} size="sm" /> : Icon && <Icon />}
                      <span className="truncate">{command.label}</span>
                      {command.group === 'Accounts' && (
                        <CommandShortcut>{PLATFORM_META[platformOf(command.avatar)].label}</CommandShortcut>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-caption text-ink-muted">
            <span>Arrow keys to move, Enter to open, <kbd className="font-mono">Esc</kbd> to close</span>
            {APP_SHORTCUTS.map(shortcut => (
              <span key={shortcut.keys}><kbd className="font-mono">{shortcut.keys}</kbd> {shortcut.action.toLowerCase()}</span>
            ))}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
