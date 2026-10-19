/** Cliente de la API de Aurora Vida (misma URL que la web: /api). */

export interface Plazo {
  valor: number;
  descripcion: string;
}

export interface Cotizacion {
  id: string;
  fechaCotizacion: string;
  fechaVencimiento: string;
  vigente: boolean;
  fechaNacimiento: string;
  edadActuarial: number;
  fumador: boolean;
  sumaAsegurada: number;
  plazo: number;
  primaNetaAnual: number;
  primaTotalAnual: number;
  primaMensual: number;
}

export interface SolicitudCotizacion {
  fechaNacimiento: string;
  fumador: boolean;
  sumaAsegurada: number;
  plazo: number;
}

export interface Salud {
  estado: string;
  version: string;
  ambiente: 'LOCAL' | 'DEV' | 'CERTI' | 'PROD';
  historias: string[];
}

export interface DetalleError {
  campo: string;
  mensaje: string;
}

/** Error con el formato único del contrato. */
export class ErrorApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: DetalleError[] = [],
  ) {
    super(mensaje);
  }
}

// ---- Espacio del semillero (header X-Semillero) ----
// Se fija una vez con ?semillero=<usuario> en la URL y se recuerda en este navegador.
const CLAVE_SEMILLERO = 'aurora.semillero';
const PATRON_SEMILLERO = /^[a-z0-9][a-z0-9_-]{1,29}$/;

function leerAlmacenado(): string | null {
  try {
    return localStorage.getItem(CLAVE_SEMILLERO);
  } catch {
    return null;
  }
}

export function iniciarSemillero(): string | null {
  const desdeUrl = new URLSearchParams(window.location.search).get('semillero')?.trim().toLowerCase();
  if (desdeUrl !== undefined) {
    try {
      if (desdeUrl === '') localStorage.removeItem(CLAVE_SEMILLERO);
      else if (PATRON_SEMILLERO.test(desdeUrl)) localStorage.setItem(CLAVE_SEMILLERO, desdeUrl);
    } catch {
      /* navegador sin almacenamiento: se usa el espacio general */
    }
  }
  return leerAlmacenado();
}

async function llamar<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const semillero = leerAlmacenado();
  if (semillero) headers.set('X-Semillero', semillero);
  if (init.body) headers.set('Content-Type', 'application/json');

  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, { ...init, headers });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No pudimos conectarnos con Aurora Vida. Revisa tu conexión e intenta de nuevo.');
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (cuerpo && typeof cuerpo.codigo === 'string') {
      throw new ErrorApi(respuesta.status, cuerpo.codigo, cuerpo.mensaje, cuerpo.detalles ?? []);
    }
    throw new ErrorApi(respuesta.status, 'ERROR_INESPERADO', 'No pudimos calcular tu prima. Intenta de nuevo en unos segundos.');
  }
  return cuerpo as T;
}

export const api = {
  salud: () => llamar<Salud>('/api/health'),
  plazos: () => llamar<Plazo[]>('/api/v1/catalogos/plazos'),
  cotizar: (datos: SolicitudCotizacion) =>
    llamar<Cotizacion>('/api/v1/cotizaciones', { method: 'POST', body: JSON.stringify(datos) }),
};
