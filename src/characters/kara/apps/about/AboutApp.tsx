import { Fragment, useState } from "react";
import { educationData, experienceData, workData } from "../../../../data/portfolio";
import { ComputerIcon } from "../../icons";
import { useWindow } from "../../os/context";
import DeviceTree from "./DeviceTree";
import "./about.css";

const TABS = ["General", "Education", "Work", "Experience", "Skills"] as const;
type Tab = (typeof TABS)[number];

const isCurrent = ({ period }: { period: string }) => period.includes("Present");

function Entry({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="kara-about__entry">
      <div className="kara-about__entry-title">{title}</div>
      <div>{subtitle}</div>
      <div className="kara-about__muted">{meta}</div>
    </div>
  );
}

function General() {
  return (
    <div className="kara-about__general">
      <ComputerIcon size={72} />
      <dl className="kara-about__facts">
        <dt>System</dt>
        <dd>Kara OS, Service Pack ?</dd>
        <dt>Registered to</dt>
        <dd>Kiri</dd>
        <dt>Currently used by</dt>
        <dd>Kara</dd>
        {educationData.filter(isCurrent).map((school) => (
          <Fragment key={school.school}>
            <dt>Studying at</dt>
            <dd>
              {school.school}
              <br />
              {school.department}
            </dd>
          </Fragment>
        ))}
        {workData.filter(isCurrent).map((job) => (
          <Fragment key={job.company}>
            <dt>Working at</dt>
            <dd>
              {job.company}
              <br />
              {job.position}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function AboutApp() {
  const { close } = useWindow();
  const [tab, setTab] = useState<Tab>("General");

  return (
    <div className="kara-about">
      <div className="kara-about__tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`kara-about__tab${tab === name ? " kara-about__tab--active" : ""}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="kara-about__panel" role="tabpanel">
        {tab === "General" && <General />}
        {tab === "Education" &&
          educationData.map((item) => (
            <Entry
              key={item.school}
              title={item.school}
              subtitle={item.department}
              meta={[item.period, item.location].filter(Boolean).join(" · ")}
            />
          ))}
        {tab === "Work" &&
          workData.map((item) => (
            <Entry
              key={item.company}
              title={item.company}
              subtitle={item.position}
              meta={[item.period, item.location].filter(Boolean).join(" · ")}
            />
          ))}
        {tab === "Experience" &&
          experienceData.map(({ category, items }) => (
            <section key={category} className="kara-about__group">
              <h3 className="kara-about__group-title">{category}</h3>
              <ul className="kara-about__list">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        {tab === "Skills" && <DeviceTree />}
      </div>

      <div className="kara-about__actions">
        <button type="button" className="kara-about__button" onClick={close}>
          OK
        </button>
        <button type="button" className="kara-about__button" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AboutApp;
