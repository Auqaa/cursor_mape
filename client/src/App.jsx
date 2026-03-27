import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import RoutesListPage from './pages/RoutesListPage';
import RouteDetailsPage from './pages/RouteDetailsPage';
import AuthPlaceholderPage from './pages/AuthPlaceholderPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <main className="app">
      <Navbar />
      <Routes>
        <Route path="/" element={<RoutesListPage />} />
        <Route path="/routes/:id" element={<RouteDetailsPage />} />
        <Route path="/auth-placeholder" element={<AuthPlaceholderPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </main>
  );
}

export default App;
