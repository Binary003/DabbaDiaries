export function formatINR(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN');
}

export function getFullDayName(date: Date = new Date()): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}