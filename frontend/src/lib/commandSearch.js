// Ranking for the command palette. Pure so it can be unit tested without a DOM.

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

// Higher is better; 0 means no match. Every query word must appear in the label or keywords.
export function scoreCommand(command, query) {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(command.label);
  const haystack = `${label} ${normalize(command.group)} ${(command.keywords || []).map(normalize).join(' ')}`;
  const words = q.split(/\s+/);
  if (!words.every(w => haystack.includes(w))) return 0;
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/\s+/).some(part => part.startsWith(words[0]))) return 60;
  if (label.includes(q)) return 40;
  return 20;
}

export function filterCommands(commands, query, limit = 50) {
  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(entry => entry.command);
}

// Groups in first-seen order so the palette keeps a stable layout while typing
export function groupCommands(commands) {
  const groups = new Map();
  for (const command of commands) {
    const key = command.group || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(command);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}
