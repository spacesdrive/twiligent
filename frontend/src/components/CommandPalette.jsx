import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import {
  LayoutDashboard, PlaySquare, Scissors, Clapperboard, MessagesSquare, Bookmark, Send,
  Users, Settings, RefreshCw, Sun, Moon, Monitor, LogOut, Tag, Plus,
} from 'lucide-react';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AccountAvatar } from '@/components/platform';
import { filterCommands, groupCommands } from '@/lib/commandSearch';
import { accountName, accountPath, PLATFORM_META, platformOf } from '@/lib/accounts';
import { NAV_GROUPS } from '@/layout/navigation';

const PAGE_ICONS = {
  '/': LayoutDashboard, '/videos': PlaySquare, '/shorts': Scissors, '/reels': Clapperboard,
  '/reddit-posts': MessagesSquare, '/tracked-content': Bookmark, '/upload': Send,
  '/accounts': Users, '/settings': Settings,
};

export default function CommandPalette({ open, onOpenChange, accounts, categories, onRefreshAll, onSignOut }) {
  const navigate = useNavigate();
  const { setTheme } = useSmoothTheme();
  const [query, setQuery] = useState('');

  const handleOpenChange = next => {
    if (!next) setQuery('');
    onOpenChange(next);
  };

  const commands = useMemo(() => [
    ...NAV_GROUPS.flatMap(group => group.items.map(item => ({
      id: `page:${item.path}`, group: 'Pages', label: item.label, keywords: [group.label],
      icon: PAGE_ICONS[item.path], run: () => navigate(item.path),
    }))),
    ...accounts.map(account => ({
      id: `account:${account.id}`, group: 'Accounts', label: accountName(account),
      keywords: [PLATFORM_META[platformOf(account)].label, account.username, account.customUrl].filter(Boolean),
      avatar: account, run: () => navigate(accountPath(account)),
    })),
    ...categories.map(category => ({
      id: `category:${category}`, group: 'Categories', label: category, keywords: ['tracked', 'category'],
      icon: Tag, run: () => navigate(`/tracked-content/category/${encodeURIComponent(category)}`),
    })),
    { id: 'action:add-account', group: 'Actions', label: 'Add an account', keywords: ['connect', 'youtube', 'instagram', 'reddit'], icon: Plus, run: () => navigate('/accounts?add=1') },
    { id: 'action:refresh', group: 'Actions', label: 'Refresh all accounts', keywords: ['sync', 'update'], icon: RefreshCw, run: onRefreshAll },
    { id: 'action:theme-light', group: 'Theme', label: 'Use light theme', keywords: ['appearance', 'paper'], icon: Sun, run: () => setTheme('light') },
    { id: 'action:theme-dark', group: 'Theme', label: 'Use dark theme', keywords: ['appearance', 'dusk'], icon: Moon, run: () => setTheme('dark') },
    { id: 'action:theme-system', group: 'Theme', label: 'Match system theme', keywords: ['appearance', 'auto'], icon: Monitor, run: () => setTheme('system') },
    { id: 'action:sign-out', group: 'Account', label: 'Sign out', keywords: ['log out', 'logout'], icon: LogOut, run: onSignOut },
  ], [accounts, categories, navigate, onRefreshAll, onSignOut, setTheme]);

  const grouped = useMemo(() => groupCommands(filterCommands(commands, query)), [commands, query]);

  const runCommand = command => {
    handleOpenChange(false);
    command.run?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
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
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-caption text-ink-faint">
            <span>Use arrow keys to move, Enter to open</span>
            <kbd className="font-mono">Esc</kbd>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
