import { cn } from '@/lib/cn';
import { CalendarMark, DocumentText, Gallery, Videocamera } from '@/components/icons';
import { Bar, PlatformMark, Window } from '@/components/mockups/kit';

// the scattered places a creator's numbers live today, one window each; sample data for the picture only

const BOX = 'w-[40rem]';

export function YouTubeStudioWindow() {
  const bars = [38, 52, 47, 60, 66, 58, 74, 81, 77, 90];
  return (
    <Window url="studio.youtube.com" className={BOX} bodyClassName="p-5">
      <div className="flex items-center gap-2">
        <PlatformMark platform="youtube" className="size-5" />
        <p className="font-display text-base font-semibold text-ink">Channel analytics</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Subscribers', '84,213'],
          ['Views', '1.2M'],
          ['Watch time', '41.8K h'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line p-3">
            <p className="text-[11px] text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-36 items-end gap-2 rounded-md border border-line p-3">
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-t-sm', i === bars.length - 1 ? 'bg-accent/70' : 'bg-line-strong/40')}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        <Bar className="w-3/4" />
        <Bar className="w-1/2" />
      </div>
    </Window>
  );
}

export function InstagramWindow() {
  return (
    <Window url="instagram.com/northwind.kitchen" className={BOX} bodyClassName="p-5">
      <div className="flex items-center gap-4">
        <span className="size-14 rounded-full bg-fold" />
        <div className="flex gap-6 text-center">
          {[
            ['Posts', '312'],
            ['Followers', '31.7K'],
            ['Following', '208'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="font-display text-base font-semibold text-ink">{value}</p>
              <p className="text-[11px] text-ink-muted">{label}</p>
            </div>
          ))}
        </div>
        <PlatformMark platform="instagram" className="ml-auto size-5" />
      </div>
      <div className="mt-5 grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'aspect-square rounded-sm',
              i % 3 === 0 ? 'bg-accent/25' : i % 3 === 1 ? 'bg-afterglow/30' : 'bg-surface-sunken',
            )}
          />
        ))}
      </div>
    </Window>
  );
}

export function RedditWindow() {
  return (
    <Window url="reddit.com/user/northwind_cooks" className={BOX} bodyClassName="p-5">
      <div className="flex items-center gap-3">
        <PlatformMark platform="reddit" className="size-6" />
        <p className="font-display text-base font-semibold text-ink">u/northwind_cooks</p>
        <span className="ml-auto rounded-full bg-surface-sunken px-2.5 py-1 font-mono text-[11px] text-ink">
          12,410 karma
        </span>
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {[
          'One-pan lemon orzo, 20 minutes',
          'I baked bread every day for a month',
          'Cast iron care, the short version',
        ].map((title, i) => (
          <li key={title} className="flex items-center gap-3 rounded-md border border-line p-3">
            <span className="flex w-10 flex-col items-center font-mono text-[11px] text-ink">
              {[2400, 1100, 870][i]}
              <span className="text-ink-muted">up</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
              <Bar className="mt-2 w-1/3" />
            </span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

export function SheetWindow() {
  const rows = [
    ['Week 1', '81,960', '30,120', '11,880'],
    ['Week 2', '82,700', '30,640', '12,010'],
    ['Week 3', '83,310', '31,050', '12,190'],
    ['Week 4', '84,213', '31,702', '12,410'],
  ];
  return (
    <Window url="sheets: weekly numbers" className={BOX} bodyClassName="p-0">
      <table className="w-full text-left font-mono text-[12px]">
        <thead className="bg-surface-sunken text-ink-muted">
          <tr>
            {['', 'YouTube', 'Instagram', 'Reddit'].map(h => (
              <th key={h} className="border-r border-b border-line px-3 py-2 font-medium last:border-r-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    'border-r border-b border-line px-3 py-2.5 last:border-r-0',
                    i === 0 ? 'text-ink-muted' : 'text-ink',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: 4 }, (_, j) => (
                <td key={j} className="h-9 border-r border-b border-line last:border-r-0" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Window>
  );
}

export function CalendarWindow() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return (
    <Window url="calendar: posting plan" className={BOX} bodyClassName="p-5">
      <div className="flex items-center gap-2">
        <CalendarMark className="size-5 text-ink-muted" />
        <p className="font-display text-base font-semibold text-ink">This week</p>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {days.map((day, i) => (
          <div key={day} className="flex h-40 flex-col gap-1.5 rounded-md border border-line p-2">
            <span className="text-[11px] font-medium text-ink-muted">{day}</span>
            {i % 2 === 0 && (
              <span className="rounded-sm bg-accent-soft px-1.5 py-1 text-[10px] font-medium text-accent-text">
                Reel 18:00
              </span>
            )}
            {i === 1 && (
              <span className="rounded-sm bg-afterglow-soft px-1.5 py-1 text-[10px] font-medium text-afterglow-text">
                Story 12:30
              </span>
            )}
            {i === 3 && (
              <span className="rounded-sm bg-surface-sunken px-1.5 py-1 text-[10px] font-medium text-ink">
                Video 16:00
              </span>
            )}
          </div>
        ))}
      </div>
    </Window>
  );
}

export function FilesWindow() {
  const files = [
    'lemon-orzo-reel.mp4',
    'bread-day-30.mp4',
    'cast-iron-story.jpg',
    'pantry-tour.mp4',
    'knife-skills-reel.mp4',
  ];
  return (
    <Window url="files: reels to post" className={BOX} bodyClassName="p-3">
      <ul className="flex flex-col">
        {files.map((file, i) => (
          <li
            key={file}
            className={cn('flex items-center gap-3 rounded-md px-3 py-2.5', i === 1 && 'bg-surface-sunken')}
          >
            {file.endsWith('.jpg') ? (
              <Gallery className="size-5 text-ink-muted" />
            ) : (
              <Videocamera className="size-5 text-ink-muted" />
            )}
            <span className="flex-1 font-mono text-[12px] text-ink">{file}</span>
            <span className="font-mono text-[11px] text-ink-muted">{[48, 61, 2, 37, 55][i]} MB</span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

export function NotesWindow() {
  return (
    <Window url="notes: what is working" className={BOX} bodyClassName="p-5">
      <div className="flex items-center gap-2">
        <DocumentText className="size-5 text-ink-muted" />
        <p className="font-display text-base font-semibold text-ink">What is working?</p>
      </div>
      <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[13px] text-ink">
        <li>Reels after 6 pm do better? Check again</li>
        <li>Shorts views up, long videos flat</li>
        <li>Which Reddit post brought the new subscribers?</li>
      </ul>
      <div className="mt-4 space-y-2.5">
        <Bar className="w-2/3" />
        <Bar className="w-1/2" />
        <Bar className="w-3/5" />
      </div>
    </Window>
  );
}
