import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { api, type Salud } from './api';
import { Cotizador } from './paginas/Cotizador';
import { Ingresar } from './paginas/Ingresar';

export function App() {
  const [salud, setSalud] = useState<Salud | null>(null);
  const semillero = (() => {
    try {
      return localStorage.getItem('aurora.semillero');
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    api.salud().then(setSalud).catch(() => setSalud(null));
  }, []);

  const mostrarAmbiente = salud && salud.ambiente !== 'PROD';

  return (
    <div className="marco">
      <header className="cabecera">
        <Link to="/" className="marca" data-testid="app-inicio-link" aria-label="Aurora Vida, ir al cotizador">
          <svg className="marca-icono" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M6 22a10 10 0 0 1 20 0z" fill="currentColor" />
            <rect x="5" y="23" width="22" height="2" rx="1" fill="currentColor" opacity="0.45" />
          </svg>
          <span>Aurora Vida</span>
        </Link>
        {mostrarAmbiente && (
          <span className="ambiente" data-testid="app-ambiente-text" title={`Versión ${salud.version}`}>
            Ambiente {salud.ambiente}
          </span>
        )}
      </header>

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Cotizador />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="pie">
        <span>Aurora Seguros es una empresa ficticia creada para práctica de QA.</span>
        {semillero && mostrarAmbiente && (
          <span data-testid="app-semillero-text">Espacio de pruebas: {semillero}</span>
        )}
      </footer>
    </div>
  );
}
