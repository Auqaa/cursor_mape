import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMushroomBalance, subscribeToProfileUpdates } from '../lib/storage';

export default function Navbar() {
  const [mushrooms, setMushrooms] = useState(() => getMushroomBalance());

  useEffect(() => subscribeToProfileUpdates(setMushrooms), []);

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <Link to="/" className="brand">
          Туристическая Рязань
        </Link>
        <span className="navbar__balance">{mushrooms} 🍄</span>
      </div>
      <nav>
        <Link to="/">Маршруты</Link>
        <Link to="/auth-placeholder">Войти</Link>
        <Link to="/auth-placeholder">Регистрация</Link>
        <Link to="/admin">Админ</Link>
      </nav>
    </header>
  );
}
