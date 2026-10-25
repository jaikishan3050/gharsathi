import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import CustomerPanel from './pages/CustomerPanel.jsx';
import TechnicianPanel from './pages/TechnicianPanel.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import { ToastContainer } from './components/Common.jsx';

export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/customer/*" element={<CustomerPanel />} />
        <Route path="/technician/*" element={<TechnicianPanel />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
