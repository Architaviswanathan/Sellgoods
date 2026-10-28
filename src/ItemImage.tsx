import { useState } from 'react';

/**
 * Returns a graphics card shaped placeholder that is generated from the
 * product's own title and category. It is only used when a seller has not
 * uploaded a photo, so a listing never shows a photo of the wrong item.
 */
export function generatedImage(title: string, category: string): string {
  const palettes: Record<string, { bg: string; ink: string; accent: string }> = {
    Cycles: { bg: '#e7ece2', ink: '#2f3a2a', accent: '#6c8b52' },
    Electronics: { bg: '#e4e9ec', ink: '#26323a', accent: '#5d8096' },
    Books: { bg: '#f1e9dc', ink: '#3d332a', accent: '#b08a55' },
    Other: { bg: '#ece7ef', ink: '#332c3a', accent: '#8a6f9c' },
  };
  const palette = palettes[category] ?? palettes.Other;
  const cleanTitle = (title || 'Campus item').trim();
  const words = cleanTitle.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 20 && current) {
      lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 3) lines.push(current);
  const truncated = words.join(' ').length > lines.join(' ').length;
  if (truncated && lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, 20) + '…';

  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const titleLines = lines.map((line, index) =>
    `<text x="64" y="${372 + index * 74}" font-family="Georgia, 'Times New Roman', serif" font-size="62" fill="${palette.ink}">${escape(line)}</text>`,
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" width="960" height="720">
  <rect width="960" height="720" fill="${palette.bg}"/>
  <circle cx="820" cy="128" r="150" fill="${palette.accent}" opacity="0.14"/>
  <rect x="0" y="646" width="960" height="74" fill="${palette.ink}" opacity="0.06"/>
  <text x="64" y="132" font-family="'Courier New', monospace" font-size="26" letter-spacing="6" fill="${palette.accent}">${escape((category || 'OTHER').toUpperCase())}</text>
  <line x1="64" y1="168" x2="250" y2="168" stroke="${palette.accent}" stroke-width="3"/>
  ${titleLines}
  <text x="64" y="686" font-family="'Courier New', monospace" font-size="22" letter-spacing="4" fill="${palette.ink}" opacity="0.55">SELLGOODS · CAMPUS EXCHANGE</text>
  <text x="676" y="686" font-family="'Courier New', monospace" font-size="22" letter-spacing="3" fill="${palette.ink}" opacity="0.4">NO PHOTO YET</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type ItemImageProps = {
  src?: string | null;
  title: string;
  category: string;
  alt?: string;
  className?: string;
};

export default function ItemImage({ src, title, category, alt, className }: ItemImageProps) {
  const fallback = generatedImage(title, category);
  const [failed, setFailed] = useState(false);
  // The old generic stock photo was not the item at all, so ignore it.
  const usable = src && !src.includes('photo-1494438639946-1ebd1d20bf85') ? src : '';
  const resolved = !failed && usable ? usable : fallback;
  return (
    <img
      src={resolved}
      alt={alt ?? title}
      className={className}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
