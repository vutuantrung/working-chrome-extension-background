export function randomInterval(
  persist: number,
  interval: number,
  direction: string,
) {
  const shouldOffset = Math.random() < 0.5;
  if (!shouldOffset) return persist;

  if (direction === "increase") return persist + interval;
  if (direction === "decrease") return persist - interval;
}

export function randomFromPair(
  input: string | number | undefined | null | any,
): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") return isNaN(input) ? undefined : input;
  if (typeof input === "string") {
    const numbers = input
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
    if (numbers.length === 0) return undefined;
    return numbers[Math.floor(Math.random() * numbers.length)];
  }
  if (Array.isArray(input)) {
    const numbers = input.map(Number).filter((n) => !isNaN(n));
    if (numbers.length === 0) return undefined;
    return numbers[Math.floor(Math.random() * numbers.length)];
  }
  return undefined;
}
