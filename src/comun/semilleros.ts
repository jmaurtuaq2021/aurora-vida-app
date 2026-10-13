import type { RequestHandler, Response } from 'express';
import { RepositorioCotizaciones } from '../cotizaciones/repositorio';
import { ApiError } from './errores';
import { Reloj } from './reloj';

/**
 * Aislamiento por semillero: cada valor del header X-Semillero tiene sus propios
 * datos y su propio reloj. Así, en un servidor compartido, el reset o el cambio
 * de fecha de un semillero no afecta las pruebas de los demás.
 */
export const HEADER_SEMILLERO = 'X-Semillero';
export const SEMILLERO_POR_DEFECTO = 'general';
export const PATRON_SEMILLERO = /^[a-z0-9][a-z0-9_-]{1,29}$/;
const MAXIMO_ESPACIOS = 100;

export interface EspacioSemillero {
  id: string;
  reloj: Reloj;
  cotizaciones: RepositorioCotizaciones;
}

export class Espacios {
  /** Map conserva el orden de inserción: el primero es el menos usado recientemente. */
  private readonly mapa = new Map<string, EspacioSemillero>();

  constructor(private readonly maximo = MAXIMO_ESPACIOS) {}

  obtener(id: string): EspacioSemillero {
    const existente = this.mapa.get(id);
    if (existente) {
      this.mapa.delete(id);
      this.mapa.set(id, existente);
      return existente;
    }
    const nuevo: EspacioSemillero = { id, reloj: new Reloj(), cotizaciones: new RepositorioCotizaciones() };
    this.mapa.set(id, nuevo);
    if (this.mapa.size > this.maximo) {
      const menosUsado = this.mapa.keys().next().value as string;
      this.mapa.delete(menosUsado);
    }
    return nuevo;
  }

  cantidad(): number {
    return this.mapa.size;
  }
}

/** Resuelve el espacio del semillero a partir del header y lo deja en res.locals. */
export function middlewareSemillero(espacios: Espacios): RequestHandler {
  return (req, res, next) => {
    const valor = (req.get(HEADER_SEMILLERO) ?? SEMILLERO_POR_DEFECTO).trim().toLowerCase();
    if (!PATRON_SEMILLERO.test(valor)) {
      next(
        new ApiError(400, 'VALIDACION', 'Hay datos inválidos en la solicitud.', [
          {
            campo: HEADER_SEMILLERO,
            mensaje: 'Debe tener de 2 a 30 caracteres: letras, números, guion o guion bajo, empezando por letra o número.',
          },
        ]),
      );
      return;
    }
    res.locals.espacio = espacios.obtener(valor);
    res.setHeader(HEADER_SEMILLERO, valor);
    next();
  };
}

export const espacioDe = (res: Response): EspacioSemillero => res.locals.espacio as EspacioSemillero;
