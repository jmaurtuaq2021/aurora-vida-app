import { randomBytes } from 'crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export interface DetalleError {
  campo: string;
  mensaje: string;
}

/** Error de negocio o validación con el formato único del contrato. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: DetalleError[] = [],
  ) {
    super(mensaje);
  }
}

export const nuevoTraceId = (): string => randomBytes(4).toString('hex');

/** Mensajes en español para los campos que valida el contrato. */
const MENSAJES_CAMPO: Record<string, string> = {
  fechaNacimiento: 'Debe ser una fecha válida con formato AAAA-MM-DD.',
  fumador: 'Debe ser verdadero o falso.',
  sumaAsegurada: 'Debe estar entre 50,000 y 500,000 en múltiplos de 10,000.',
  plazo: 'Debe ser 5, 10, 15 o 20 años.',
  id: 'Debe ser un identificador válido (UUID).',
  fechaHora: 'Debe ser una fecha y hora ISO 8601 con zona horaria, por ejemplo 2026-10-13T10:00:00-05:00.',
};

interface ErrorValidador {
  path?: string;
  message?: string;
  errorCode?: string;
}

/** Convierte un error de express-openapi-validator al formato del contrato. */
function detallesDeValidador(errores: ErrorValidador[]): DetalleError[] {
  const vistos = new Map<string, DetalleError>();
  for (const e of errores) {
    const ruta = (e.path ?? '')
      .replace(/^[./]?(body|params|query|path)[./]?/, '')
      .replace(/^[./]/, '')
      .replace(/\//g, '.');
    const esRequerido = e.errorCode?.startsWith('required') || /required property/.test(e.message ?? '');
    const esNoPermitido = e.errorCode?.startsWith('additionalProperties') || /additional properties/i.test(e.message ?? '');
    let campo = ruta;
    let mensaje: string;
    if (esRequerido) {
      campo = (e.message ?? '').match(/'([^']+)'/)?.[1] ?? ruta;
      mensaje = 'Es obligatorio.';
    } else if (esNoPermitido) {
      campo = (e.message ?? '').match(/'([^']+)'/)?.[1] ?? ruta;
      mensaje = 'Campo no permitido.';
    } else {
      mensaje = MENSAJES_CAMPO[campo] ?? 'Valor inválido.';
    }
    campo = campo || 'cuerpo';
    if (!vistos.has(campo)) vistos.set(campo, { campo, mensaje });
  }
  return [...vistos.values()];
}

export const manejadorNoEncontrado: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'RECURSO_NO_ENCONTRADO', 'El recurso solicitado no existe.'));
};

export const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  const traceId = nuevoTraceId();

  if (err instanceof ApiError) {
    res.status(err.status).json({ codigo: err.codigo, mensaje: err.message, detalles: err.detalles, traceId });
    return;
  }

  // JSON mal formado en el cuerpo
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({
      codigo: 'VALIDACION',
      mensaje: 'El cuerpo de la solicitud no es un JSON válido.',
      detalles: [{ campo: 'cuerpo', mensaje: 'JSON inválido.' }],
      traceId,
    });
    return;
  }

  // Errores de express-openapi-validator
  if (typeof err?.status === 'number' && Array.isArray(err?.errors)) {
    if (err.status === 400) {
      res.status(400).json({
        codigo: 'VALIDACION',
        mensaje: 'Hay datos inválidos en la solicitud.',
        detalles: detallesDeValidador(err.errors),
        traceId,
      });
      return;
    }
    if (err.status === 404 || err.status === 405) {
      res.status(404).json({ codigo: 'RECURSO_NO_ENCONTRADO', mensaje: 'El recurso solicitado no existe.', detalles: [], traceId });
      return;
    }
    if (err.status === 415) {
      res.status(400).json({
        codigo: 'VALIDACION',
        mensaje: 'El cuerpo debe enviarse como application/json.',
        detalles: [{ campo: 'Content-Type', mensaje: 'Debe ser application/json.' }],
        traceId,
      });
      return;
    }
  }

  // Cualquier otra cosa: error interno sin filtrar detalles
  console.error(`[${traceId}]`, err);
  res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.', detalles: [], traceId });
};
