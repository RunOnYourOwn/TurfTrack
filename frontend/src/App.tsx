import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Lawns from "@/pages/Lawns";
import Products from "@/pages/Products";
import Applications from "@/pages/Applications";
import Reports from "@/pages/Reports";
import TaskMonitor from "@/pages/TaskMonitor";
import GDD from "@/pages/GDD";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lawns" element={<Lawns />} />
          <Route path="/products" element={<Products />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/tasks" element={<TaskMonitor />} />
          <Route path="/gdd" element={<GDD />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
