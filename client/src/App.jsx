import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import ItemList from "./pages/Items/Items"
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/items" element={<ItemList />} />
    </Routes>
  );
}

export default App;