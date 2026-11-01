/**
 * Stand-in icons, drawn smooth rather than pixelated (pixel art is Koro's look).
 * Each is a plain component, so replacing one with final art only touches this file.
 */
export interface IconProps {
  size: number;
}

export function FolderIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M3 9h13l3 4h18v22H3z" fill="#d9a62e" />
      <path d="M3 15h34v20H3z" fill="#f5cf62" />
      <path d="M3 15h34v3H3z" fill="#fbe39a" />
    </svg>
  );
}

export function ComputerIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="5" y="7" width="30" height="24" rx="3" fill="#59616e" />
      <rect x="8" y="10" width="24" height="17" fill="#c5e3a4" />
      <path d="M8 10h24L8 22z" fill="#dff0ca" />
      <rect x="14" y="31" width="12" height="3" fill="#7d8592" />
      <rect x="10" y="34" width="20" height="2" rx="1" fill="#59616e" />
    </svg>
  );
}

export function RadioIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M12 12L28 3" stroke="#555" strokeWidth="2" />
      <rect x="4" y="12" width="32" height="22" rx="4" fill="#7c5a3c" />
      <rect x="4" y="12" width="32" height="4" rx="2" fill="#9b7650" />
      <circle cx="14" cy="24" r="7" fill="#e5dcc2" />
      <circle cx="14" cy="24" r="3" fill="#a89a78" />
      <rect x="25" y="19" width="7" height="3" fill="#e5dcc2" />
      <rect x="25" y="25" width="7" height="3" fill="#e5dcc2" />
    </svg>
  );
}

export function NotepadIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 4h16l7 7v25H9z" fill="#fff" stroke="#9a9a9a" />
      <path d="M25 4l7 7h-7z" fill="#c9c9c9" />
      <path d="M13 17h15M13 22h15M13 27h10" stroke="#8a8a8a" />
    </svg>
  );
}

export function BinIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M10 12h20l-3 24H13z" fill="#d5dbe0" />
      <path d="M16 15l1 18M24 15l-1 18M20 15v18" stroke="#9ca6ad" />
      <rect x="8" y="8" width="24" height="4" rx="1" fill="#9ca6ad" />
    </svg>
  );
}

/** Kara's mark on the start button. A cat head instead of a certain four-colour flag. */
export function CatMarkIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 2l4 4a7 7 0 0 1 6 0l4-4v10a7 7 0 0 1-14 0z" fill="#fff" />
    </svg>
  );
}

export function SpeakerIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="#fff" />
      <path d="M11 5a4 4 0 0 1 0 6" fill="none" stroke="#fff" />
    </svg>
  );
}

export function PowerIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="4" fill="#c9502c" />
      <path d="M8 7a7 7 0 1 0 8 0" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M12 4v8" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

export function RestartIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="4" fill="#3f8f2f" />
      <path d="M18 12a6 6 0 1 1-2-4.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M17 3v6h-6z" fill="#fff" />
    </svg>
  );
}
