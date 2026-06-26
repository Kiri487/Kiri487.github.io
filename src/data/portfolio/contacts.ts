/** Social / contact links — shared content, used by any skin. */
export interface Contact {
  /** Stable id; skins map this to their own icon. */
  id: "github" | "linkedin" | "x" | "mail";
  label: string;
  url: string;
}

export const contacts: Contact[] = [
  { id: "github", label: "GitHub", url: "https://github.com/Kiri487" },
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/yi-xuan-wu/" },
  { id: "x", label: "Twitter / X", url: "https://x.com/kiri487_xxx" },
  { id: "mail", label: "Mail", url: "mailto:kiri48787@gmail.com" },
];
