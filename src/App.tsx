import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";

function App() {
  return (
    <Router basename="/">
      <Header />
      <div className="App">  
        <div className="routes-container">
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </div>
      <Footer />
    </Router>
  );
}

export default App;