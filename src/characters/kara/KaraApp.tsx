import KaraOs from "./os/KaraOs";
import OsProvider from "./os/OsProvider";
import "./style.css";

function KaraApp() {
  return (
    <>
      <title>Kara's Computer</title>
      <OsProvider>
        <KaraOs />
      </OsProvider>
    </>
  );
}

export default KaraApp;
