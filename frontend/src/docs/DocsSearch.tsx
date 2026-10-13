import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { filterCommands, groupCommands } from '@/lib/commandSearch';
import { ALL_DOC_PAGES } from './nav';

export default function DocsSearch({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const commands = useMemo(() => ALL_DOC_PAGES.map(page => ({ id: page.path, label: page.title, group: page.tabLabel, keywords: page.keywords, path: page.path })), []);
  const grouped = useMemo(() => groupCommands(filterCommands(commands, query)), [commands, query]);
  const close = next => { if (!next) setQuery(''); onOpenChange(next); };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search the documentation</DialogTitle>
        <DialogDescription className="sr-only">Find a page by title or topic</DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search the docs, for example Instagram tester" />
          <CommandList>
            <CommandEmpty>No pages match "{query}"</CommandEmpty>
            {grouped.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map(item => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => { close(false); navigate(item.path); }}>
                    <FileText />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
