import { useNavigate } from 'react-router-dom';
import { Tag } from 'lucide-react';
import ListRow from '@/components/ListRow';
import { categoryMeta } from './overviewLabels.ts';

export default function CategoryRow({ stat, trailing }) {
  const navigate = useNavigate();
  return (
    <ListRow
      onClick={() => navigate(`/tracked-content/category/${encodeURIComponent(stat.category)}`)}
      leading={<><span className="w-5 shrink-0" /><span className="flex size-8 items-center justify-center rounded-control bg-surface-sunken text-ink-muted"><Tag className="size-4 stroke-[1.75]" /></span></>}
      title={stat.category}
      meta={categoryMeta(stat)}
      trailing={trailing}
    />
  );
}
