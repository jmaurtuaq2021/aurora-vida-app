import { Router } from 'express';
import { PLAZOS } from '../cotizaciones/tarifa';

export function rutasCatalogos(): Router {
  const router = Router();

  router.get('/catalogos/plazos', (_req, res) => {
    res.json(PLAZOS.map((valor) => ({ valor, descripcion: `${valor} años` })));
  });

  return router;
}
