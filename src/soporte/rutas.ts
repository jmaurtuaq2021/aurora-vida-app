import { Router } from 'express';
import { ApiError } from '../comun/errores';
import { fechaHoraLocal, type Reloj } from '../comun/reloj';

interface Dependencias {
  reloj: Reloj;
  /** Restaura todos los datos de prueba. */
  reiniciarDatos: () => void;
}

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const MENSAJE_FECHA_HORA =
  'Debe ser una fecha y hora ISO 8601 con zona horaria, por ejemplo 2026-10-13T10:00:00-05:00.';

/** Endpoints de soporte de pruebas. Solo se montan con APP_MODE=test. */
export function rutasSoporte({ reloj, reiniciarDatos }: Dependencias): Router {
  const router = Router();

  const estadoReloj = () => ({ fechaHora: fechaHoraLocal(reloj.ahora()), simulado: reloj.esSimulado() });

  // El reset restaura los datos; el reloj se mantiene como esté.
  router.post('/reset', (_req, res) => {
    reiniciarDatos();
    res.status(204).end();
  });

  router.get('/reloj', (_req, res) => {
    res.json(estadoReloj());
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
    reloj.fijar(new Date(valor));
    res.json(estadoReloj());
  });

  router.delete('/reloj', (_req, res) => {
    reloj.restaurar();
    res.status(204).end();
  });

  return router;
}
