export function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

export function parseMeetingCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // If it's a URL, extract path
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1].toLowerCase();
      }
    }
  } catch {
    // fallback
  }

  // Remove spaces and special characters except hyphens
  return trimmed.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Violet
  '#D97706', // Amber
  '#DC2626', // Red
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#0284C7', // Sky
  '#E11D48', // Rose
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);

  if (hrs > 0) {
    const remainMins = mins % 60;
    return `${hrs.toString().padStart(2, '0')}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy', err);
    return false;
  }
}
