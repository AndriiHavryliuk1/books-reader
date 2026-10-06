export function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) {
    return true;
  }

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (
      !keys2.includes(key) ||
      !isDeepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }

  return true;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again';
}

export function dateNow(): string {
  return new Date().toISOString();
}

export function exportFileName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `books-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.xml`;
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
