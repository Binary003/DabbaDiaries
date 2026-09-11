export function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export function generateHandoverCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDayName(date: Date = new Date()): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export function getFullDayName(date: Date = new Date()): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[date.getDay()];
}
