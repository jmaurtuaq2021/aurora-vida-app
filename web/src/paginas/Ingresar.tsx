import { Link, useSearchParams } from 'react-router-dom';

/**
 * Destino del botón "Contratar" (HU-01, criterio 7).
 * El registro y el inicio de sesión llegan con la HU-02; por ahora la página
 * confirma que la cotización se conservó para continuar la compra.
 */
export function Ingresar() {
  const [params] = useSearchParams();
  const guardada = (() => {
    try {
      return sessionStorage.getItem('aurora.cotizacionId');
    } catch {
      return null;
    }
  })();
  const cotizacionId = params.get('cotizacion') ?? guardada;

  return (
    <section className="ingresar" aria-labelledby="titulo-ingresar">
      <h1 id="titulo-ingresar" className="titular">
        Inicia sesión para continuar
      </h1>
      {cotizacionId ? (
        <p className="entrada">
          Guardamos tu cotización N.°{' '}
          <span className="numero" data-testid="ingresar-cotizacion-text">
            {cotizacionId}
          </span>{' '}
          para que continúes la compra.
        </p>
      ) : (
        <p className="entrada" data-testid="ingresar-sin-cotizacion-msg">
          Primero cotiza tu seguro para poder contratarlo.
        </p>
      )}
      <p className="aviso" data-testid="ingresar-proximamente-msg">
        El registro y el inicio de sesión estarán disponibles en una próxima versión.
      </p>
      <Link to="/" className="enlace" data-testid="ingresar-volver-link">
        Volver al cotizador
      </Link>
    </section>
  );
}
