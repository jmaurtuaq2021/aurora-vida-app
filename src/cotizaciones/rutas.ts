import { randomUUID } from 'crypto';
import { Router } from 'express';
import { ApiError } from '../comun/errores';
import { sumarDias, type Reloj } from '../comun/reloj';
import { espacioDe } from '../comun/semilleros';
import { edadCumplida } from './edad';
import type { CotizacionGuardada } from './repositorio';
import {
  aMonto,
  calcularPrimas,
  EDAD_MAXIMA,
  EDAD_MAXIMA_AL_TERMINO,
  EDAD_MINIMA,
  type Plazo,
} from './tarifa';

const DIAS_VIGENCIA_COTIZACION = 30; // RN-19

const aRespuesta = (c: CotizacionGuardada, reloj: Reloj) => ({
  id: c.id,
  fechaCotizacion: c.fechaCotizacion,
  fechaVencimiento: c.fechaVencimiento,
  // Vigente hasta el último día inclusive (RN-19)
  vigente: reloj.hoy() <= c.fechaVencimiento,
  fechaNacimiento: c.fechaNacimiento,
  edadActuarial: c.edadActuarial,
  fumador: c.fumador,
  sumaAsegurada: c.sumaAsegurada,
  plazo: c.plazo,
  primaNetaAnual: c.primaNetaAnual,
  primaTotalAnual: c.primaTotalAnual,
  primaMensual: c.primaMensual,
});

/** HU-01: cotizaciones. Cada semillero usa su propio espacio (datos y reloj). */
export function rutasCotizaciones(): Router {
  const router = Router();

  // Formato y rangos de campos (RN-12, RN-13) los valida el contrato OpenAPI antes de llegar aquí.
  router.post('/cotizaciones', (req, res) => {
    const { reloj, cotizaciones } = espacioDe(res);
    const { fechaNacimiento, fumador, sumaAsegurada, plazo } = req.body as {
      fechaNacimiento: string;
      fumador: boolean;
      sumaAsegurada: number;
      plazo: Plazo;
    };

    const hoy = reloj.hoy();
    const edad = edadCumplida(fechaNacimiento, hoy); // RN-10

    if (edad < EDAD_MINIMA || edad > EDAD_MAXIMA) {
      throw new ApiError(422, 'EDAD_FUERA_RANGO', 'La edad de contratación debe estar entre 18 y 65 años.');
    }
    if (edad + plazo > EDAD_MAXIMA_AL_TERMINO) {
      throw new ApiError(422, 'EDAD_PLAZO_EXCEDIDO', 'La edad al término del seguro no puede superar los 75 años.');
    }

    const primas = calcularPrimas({ edad, fumador, sumaAsegurada, plazo });
    const cotizacion: CotizacionGuardada = {
      id: randomUUID(),
      fechaCotizacion: hoy,
      fechaVencimiento: sumarDias(hoy, DIAS_VIGENCIA_COTIZACION),
      fechaNacimiento,
      edadActuarial: edad,
      fumador,
      sumaAsegurada,
      plazo,
      primaNetaAnual: aMonto(primas.primaNetaAnual),
      primaTotalAnual: primas.primaTotalAnual.toNumber(),
      primaMensual: primas.primaMensual.toNumber(),
    };
    cotizaciones.guardar(cotizacion);

    res.status(201).location(`/api/v1/cotizaciones/${cotizacion.id}`).json(aRespuesta(cotizacion, reloj));
  });

  router.get('/cotizaciones/:id', (req, res) => {
    const { reloj, cotizaciones } = espacioDe(res);
    const cotizacion = cotizaciones.buscar(req.params.id);
    if (!cotizacion) {
      throw new ApiError(404, 'COTIZACION_NO_ENCONTRADA', 'La cotización no existe.');
    }
    res.json(aRespuesta(cotizacion, reloj));
  });

  return router;
}
