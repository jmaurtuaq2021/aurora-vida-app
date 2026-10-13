import cors from 'cors';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { rutasCatalogos } from './catalogos/rutas';
import { type Config } from './comun/config';
import { manejadorErrores, manejadorNoEncontrado } from './comun/errores';
import { Reloj } from './comun/reloj';
import { RepositorioCotizaciones } from './cotizaciones/repositorio';
import { rutasCotizaciones } from './cotizaciones/rutas';
import { rutasSoporte } from './soporte/rutas';

export const VERSION = '1.0.0-hu01';

/** Ruta del contrato; en la imagen Docker está junto a dist/. */
export const RUTA_CONTRATO = process.env.OPENAPI_PATH ?? join(process.cwd(), 'openapi', 'openapi.yaml');

type Spec = Record<string, any>;

function cargarContrato(): Spec {
  return YAML.parse(readFileSync(RUTA_CONTRATO, 'utf8'));
}

/** Contrato que se valida en /api/v1: sin las rutas de soporte, que tienen otra base. */
function contratoParaValidar(contrato: Spec): Spec {
  const copia: Spec = structuredClone(contrato);
  copia.servers = [{ url: '/api/v1' }];
  for (const ruta of Object.keys(copia.paths)) {
    if (ruta.startsWith('/test/')) delete copia.paths[ruta];
  }
  return copia;
}

/** Contrato publicado en Swagger: con servidores relativos, para que "Try it out" funcione en cualquier host. */
function contratoParaSwagger(contrato: Spec): Spec {
  const copia: Spec = structuredClone(contrato);
  copia.servers = [{ url: '/api/v1', description: 'Esta instancia' }];
  for (const [ruta, item] of Object.entries<Spec>(copia.paths)) {
    if (ruta.startsWith('/test/')) item.servers = [{ url: '/api', description: 'Soporte de pruebas' }];
  }
  return copia;
}

export interface App {
  app: express.Express;
  reloj: Reloj;
  /** Respuestas que no cumplieron el contrato (para las pruebas). */
  violacionesContrato: string[];
}

export function crearApp(config: Config): App {
  const contrato = cargarContrato();
  const reloj = new Reloj();
  const cotizaciones = new RepositorioCotizaciones();
  const reiniciarDatos = () => cotizaciones.vaciar();
  const violacionesContrato: string[] = [];

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ estado: 'OK', version: VERSION, modo: config.modo });
  });

  const swaggerSpec = contratoParaSwagger(contrato);
  app.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').send(YAML.stringify(swaggerSpec));
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Aurora Vida API',
      swaggerOptions: { docExpansion: 'list', displayRequestDuration: true },
    }),
  );

  if (config.modo === 'test') {
    app.use('/api/test', rutasSoporte({ reloj, reiniciarDatos }));
  }

  // El validador revisa requests y responses de /api/v1 contra el contrato.
  // Una respuesta que no cumple el contrato se reporta en el log (onError) sin romper la respuesta;
  // las pruebas automáticas fallan si aparece alguna.
  app.use(
    OpenApiValidator.middleware({
      apiSpec: contratoParaValidar(contrato) as any,
      validateRequests: { allowUnknownQueryParameters: false, allErrors: true },
      validateResponses: {
        onError: (error: Error, _body: unknown, req: express.Request) => {
          violacionesContrato.push(`${req.method} ${req.originalUrl}: ${error.message}`);
          console.warn(`[contrato] ${req.method} ${req.originalUrl}: ${error.message}`);
        },
      },
      validateFormats: true,
      ajvFormats: { mode: 'full' },
      ignoreUndocumented: false,
    }),
  );
  const v1 = express.Router();
  v1.use(rutasCatalogos());
  v1.use(rutasCotizaciones({ reloj, repositorio: cotizaciones }));
  app.use('/api/v1', v1);

  app.use(manejadorNoEncontrado);
  app.use(manejadorErrores);

  return { app, reloj, violacionesContrato };
}
