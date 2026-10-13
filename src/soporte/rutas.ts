import { Router } from 'express';
import { ApiError } from '../comun/errores';
import { fechaHoraLocal } from '../comun/reloj';
import { espacioDe, type EspacioSemillero } from '../comun/semilleros';

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const MENSAJE_FECHA_HORA =
  'Debe ser una fecha y hora ISO 8601 con zona horaria, por ejemplo 2026-10-13T10:00:00-05:00.';

/** Restaura los datos de prueba de un semillero. */
function reiniciarDatos(espacio: EspacioSemillero): void {
  espacio.cotizaciones.vaciar();
}

/**
 * Endpoints de soporte de pruebas. Solo se montan con APP_MODE=test.
 * Afectan únicamente al semillero indicado en X-Semillero.
 */
export function rutasSoporte(): Router {
  const router = Router();

  const estadoReloj = (e: EspacioSemillero) => ({
    fechaHora: fechaHoraLocal(e.reloj.ahora()),
    simulado: e.reloj.esSimulado(),
  });

  // El reset restaura los datos; el reloj se mantiene como esté.
  router.post('/reset', (_req, res) => {
    reiniciarDatos(espacioDe(res));
    res.status(204).end();
  });

  router.get('/reloj', (_req, res) => {
    res.json(estadoReloj(espacioDe(res)));
  });

  router.put('/reloj', (req, res) => {
    const cuerpo = req.body ?? {};
    const extras = Object.keys(cuerpo).filter((k) => k !== 'fechaHora');
    const valor = cuerpo.fechaHora;
    const detalles = [];
    if (valor === undefined) {
      detalles.push({ campo: 'fechaHora', mensaje: 'Es obligatorio.' });
    } else if (typeof valor !== 'string' || !ISO_CON_ZONA.test(valor) || Number.isNaN(Date.parse(valor))) {
      detalles.push({ campo: 'fechaHora', mensaje: MENSAJE_FECHA_HORA });
    }
    for (const campo of extras) detalles.push({ campo, mensaje: 'Campo no permitido.' });
    if (detalles.length) {
      throw new ApiError(400, 'VALIDACION', 'Hay datos inválidos en la solicitud.', detalles);
    }
    const espacio = espacioDe(res);
    espacio.reloj.fijar(new Date(valor));
    res.json(estadoReloj(espacio));
  });

  router.delete('/reloj', (_req, res) => {
    espacioDe(res).reloj.restaurar();
    res.status(204).end();
  });

  return router;
}
