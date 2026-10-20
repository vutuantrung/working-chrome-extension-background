export function formatTimeFromISO(isoString: string): string {
  const date = new Date(isoString);

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function toISOTimeToday(time: string): string {
  const [h, m, s] = time.split(":").map(Number);

  const d = new Date();
  d.setUTCHours(h, m, s, 0); // NO timezone shift

  return d.toISOString();
}

export function isTimeValid(time: string): boolean {
    // matches 00:00:00 to 23:59:59
    const regex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    return regex.test(time);
}