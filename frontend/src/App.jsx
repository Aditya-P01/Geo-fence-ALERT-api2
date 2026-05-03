import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import PersonalDashboard from './pages/PersonalDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DeviceDashboard from './pages/DeviceDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"       element={<PersonalDashboard />} />
        <Route path="/admin"  element={<AdminDashboard />} />
        <Route path="/device" element={<DeviceDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
