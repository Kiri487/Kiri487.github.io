import type { ReactNode } from "react";

interface CvEntryProps {
  id?: string;
  title: ReactNode;
  date: string;
  subtitle?: ReactNode;
  location?: string;
  children?: ReactNode;
}

/** Classic two-row CV entry: bold title / date, then italic subtitle / location. */
function CvEntry({ id, title, date, subtitle, location, children }: CvEntryProps) {
  return (
    <div id={id} className="kere-entry">
      <div className="kere-entry__row">
        <span className="kere-entry__title">{title}</span>
        <span className="kere-entry__date">{date}</span>
      </div>
      {/* Phones only: date and location share one line under the title. */}
      <div className="kere-entry__meta">
        {date}
        {location && ` · ${location}`}
      </div>
      {(subtitle || location) && (
        <div className="kere-entry__row kere-entry__row--sub">
          <span className="kere-entry__subtitle">{subtitle}</span>
          {location && <span className="kere-entry__location">{location}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export default CvEntry;
