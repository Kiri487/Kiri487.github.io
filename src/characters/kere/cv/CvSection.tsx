import type { ReactNode } from "react";

function CvSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="kere-section">
      <h2 className="kere-section__title">{title}</h2>
      {children}
    </section>
  );
}

export default CvSection;
