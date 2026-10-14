import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './Landing.jsx';
import Dashboard from './Dashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/*" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}