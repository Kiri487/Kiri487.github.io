import type { ComponentType } from "react";
import type { IconProps } from "../../icons";

export interface ExplorerFile {
  id: string;
  name: string;
  /** Shown in the Details view and the status bar, such as "JPEG Image". */
  typeName: string;
  /** Sortable as text, such as "2026.10.31". */
  date: string;
  icon: ComponentType<IconProps>;
  thumbnail?: string;
}

export type ExplorerView = "thumbnails" | "icons" | "details";
export type ExplorerSortKey = "name" | "type" | "date";

export interface ExplorerSort {
  key: ExplorerSortKey;
  descending: boolean;
}

export interface ExplorerTask {
  label: string;
  /** Shown in an error box: most tasks in Kara's computer don't work, and say so. */
  message: string;
}

export interface ExplorerTaskGroup {
  title: string;
  tasks: ExplorerTask[];
}
