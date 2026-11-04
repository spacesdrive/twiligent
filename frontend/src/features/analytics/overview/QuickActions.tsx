import { Link } from 'react-router-dom';
import { Bookmark, Plus, Send } from 'lucide-react';

// only actions start here; the library pages are already one click away in the sidebar
const QUICK_ACTIONS = [
  { to: '/publish',         label: 'Publish',       icon: Send },
  { to: '/accounts?add=1',  label: 'Add account',   icon: Plus },
  { to: '/tracked-content', label: 'Track content', icon: Bookmark },
];

export default function QuickActions() {
  return (
    <nav aria-label="Quick actions">
      <ul className="flex flex-wrap gap-3">
        {QUICK_ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <li key={action.to}>
              <Link
                to={action.to}
                className="group flex items-center gap-3 rounded-card border border-line bg-surface-raised py-2.5 pr-4 pl-2.5 transition-colors duration-(--duration-base) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-9 items-center justify-center rounded-control bg-surface-wash text-ink-muted transition-colors duration-(--duration-base) group-hover:text-ink">
                  <Icon className="size-5 stroke-[1.75]" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-ink">{action.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
