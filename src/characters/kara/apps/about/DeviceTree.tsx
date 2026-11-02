import { useState } from "react";
import { skillsData } from "../../../../data/portfolio";
import { ComputerIcon, FolderIcon } from "../../icons";

/** Skills as the hardware of Kiri, laid out like XP's Device Manager. */
function DeviceTree() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (category: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(category)) next.add(category);
      return next;
    });
  };

  return (
    <div className="kara-tree">
      <div className="kara-tree__root">
        <ComputerIcon size={16} />
        KARA-PC
      </div>
      {skillsData.map(({ category, skills }) => {
        const open = !collapsed.has(category);
        return (
          <div key={category} className="kara-tree__group">
            <button type="button" className="kara-tree__category" aria-expanded={open} onClick={() => toggle(category)}>
              <span className="kara-tree__box">{open ? "−" : "+"}</span>
              <FolderIcon size={16} />
              {category}
            </button>
            {open && (
              <ul className="kara-tree__items">
                {skills.map((skill) => (
                  <li key={skill.name}>{skill.name}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DeviceTree;
