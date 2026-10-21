import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import CustomerPanel from './pages/CustomerPanel.jsx';
import TechnicianPanel from './pages/TechnicianPanel.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import { ToastContainer } from './components/Common.jsx';

export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/customer/*" element={<CustomerPanel />} />
        <Route path="/technician/*" element={<TechnicianPanel />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
