import type { IconType } from "react-icons";
import {
  SiCplusplus, SiPython, SiJavascript, SiTypescript,
  SiPostgresql, SiHtml5, SiCss, SiReact, SiGit, SiLinux,
} from "react-icons/si";
import { DiMsqlServer } from "react-icons/di";
import { TbBrandCSharp } from "react-icons/tb";
import type { Tech } from "../../data/portfolio/tech";

/**
 * The kiri skin's icon for each shared tech key. Because this is a
 * Record<Tech, IconType>, TypeScript will flag a build error if a new
 * Tech key is added without a matching icon here.
 */
export const techIcons: Record<Tech, IconType> = {
  cplusplus: SiCplusplus,
  csharp: TbBrandCSharp,
  python: SiPython,
  javascript: SiJavascript,
  typescript: SiTypescript,
  html5: SiHtml5,
  css: SiCss,
  react: SiReact,
  mssql: DiMsqlServer,
  postgresql: SiPostgresql,
  git: SiGit,
  linux: SiLinux,
};
