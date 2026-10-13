export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// first part of the email's local name, so "jane.doe@x.com" greets "Jane"
export function greetingName(email) {
  const firstName = (email || '').split('@')[0].split(/[._-]/)[0];
  if (!firstName) return '';
  return firstName[0].toUpperCase() + firstName.slice(1);
}

export function greetingTitle(email, date = new Date()) {
  const name = greetingName(email);
  if (!name) return greeting(date);
  return `${greeting(date)}, ${name}`;
}
