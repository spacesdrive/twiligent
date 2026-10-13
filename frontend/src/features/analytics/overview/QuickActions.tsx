import { Link } from 'react-router-dom';
import { Bookmark, Clapperboard, MessagesSquare, PlaySquare, Plus, Scissors, Send } from 'lucide-react';

const QUICK_ACTIONS = [
  { to: '/upload',          label: 'Publish',         icon: Send },
  { to: '/accounts?add=1',  label: 'Add account',     icon: Plus },
  { to: '/tracked-content', label: 'Track content',   icon: Bookmark },
  { to: '/videos',          label: 'Videos',          icon: PlaySquare },
  { to: '/shorts',          label: 'Shorts',          icon: Scissors },
  { to: '/reels',           label: 'Instagram',       icon: Clapperboard },
  { to: '/reddit-posts',    label: 'Reddit',          icon: MessagesSquare },
];

export default function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-7">
      {QUICK_ACTIONS.map(action => {
        const Icon = action.icon;
        return (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-2 rounded-card py-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-card bg-surface-wash text-ink-muted transition-colors duration-(--duration-base) group-hover:bg-surface-selected group-hover:text-ink">
              <Icon className="size-5 stroke-[1.75]" />
            </span>
            <span className="text-small font-medium text-ink">{action.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
