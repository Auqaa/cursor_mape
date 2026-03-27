import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Туристическая Рязань
      </Link>
      <nav>
        <Link to="/">Маршруты</Link>
        <Link to="/auth-placeholder">Войти</Link>
        <Link to="/auth-placeholder">Регистрация</Link>
        <Link to="/admin">Админ</Link>
      </nav>
    </header>
  );
}

