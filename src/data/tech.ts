/**
 * Technology keys shared across skill / project-tag data.
 *
 * Data only stores these keys — each skin decides how to render them
 * (icon, label, colour…) via its own lookup table. Add a new key here
 * when a new technology is needed; every skin's map will then be
 * type-checked to cover it.
 */
export type Tech =
  | "cplusplus"
  | "csharp"
  | "python"
  | "javascript"
  | "typescript"
  | "html5"
  | "css"
  | "react"
  | "mssql"
  | "postgresql"
  | "git"
  | "linux";
