import cors from 'cors';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { rutasCatalogos } from './catalogos/rutas';
import { historiaActiva, type Config } from './comun/config';
import { manejadorErrores, manejadorNoEncontrado } from './comun/errores';
import { Espacios, HEADER_SEMILLERO, middlewareSemillero } from './comun/semilleros';
import { rutasCotizaciones } from './cotizaciones/rutas';
import { rutasSoporte } from './soporte/rutas';

export const VERSION = '1.2.0-hu01';

/** Ruta del contrato; en la imagen Docker está junto a dist/. */
export const RUTA_CONTRATO = process.env.OPENAPI_PATH ?? join(process.cwd(), 'openapi', 'openapi.yaml');

/** Carpeta del frontend compilado. */
export const RUTA_WEB = process.env.WEB_PATH ?? join(process.cwd(), 'web', 'dist');

type Spec = Record<string, any>;
const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

function cargarContrato(): Spec {
  return YAML.parse(readFileSync(RUTA_CONTRATO, 'utf8'));
}

/** Historias declaradas en el contrato con la extensión x-historia. */
function historiasDelContrato(contrato: Spec): string[] {
  const historias = new Set<string>();
  for (const item of Object.values<Spec>(contrato.paths)) {
    for (const m of METODOS) if (item[m]?.['x-historia']) historias.add(item[m]['x-historia']);
  }
  return [...historias].sort();
}

/**
 * Feature flags (TBD): quita del contrato las operaciones de historias apagadas.
 * Lo que no está en el contrato filtrado responde 404 y no aparece en Swagger.
 */
function filtrarPorHistoria(contrato: Spec, config: Config): Spec {
  const copia: Spec = structuredClone(contrato);
  for (const [ruta, item] of Object.entries<Spec>(copia.paths)) {
    for (const m of METODOS) {
      const historia = item[m]?.['x-historia'];
      if (historia && !historiaActiva(config, historia)) delete item[m];
    }
    if (!METODOS.some((m) => item[m])) delete copia.paths[ruta];
  }
  return copia;
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

/** Contrato publicado en Swagger: servidores relativos, para que "Try it out" funcione en cualquier host. */
function contratoParaSwagger(contrato: Spec, config: Config): Spec {
  const copia: Spec = structuredClone(contrato);
  copia.servers = [{ url: '/api/v1', description: `Esta instancia (${config.ambiente})` }];
  for (const [ruta, item] of Object.entries<Spec>(copia.paths)) {
    if (!ruta.startsWith('/test/')) continue;
    if (config.modo === 'test') item.servers = [{ url: '/api', description: 'Soporte de pruebas' }];
    else delete copia.paths[ruta];
  }
  return copia;
}

export interface App {
  app: express.Express;
  espacios: Espacios;
  /** Respuestas que no cumplieron el contrato (para las pruebas). */
  violacionesContrato: string[];
}

export function crearApp(config: Config): App {
  const contratoCompleto = cargarContrato();
  const contrato = filtrarPorHistoria(contratoCompleto, config);
  const historiasEncendidas = historiasDelContrato(contratoCompleto).filter((h) => historiaActiva(config, h));
  const espacios = new Espacios();
  const violacionesContrato: string[] = [];

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ exposedHeaders: ['X-Ambiente', HEADER_SEMILLERO, 'Location'] }));
  app.use((_req, res, next) => {
    res.setHeader('X-Ambiente', config.ambiente);
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      estado: 'OK',
      version: VERSION,
      ambiente: config.ambiente,
      modo: config.modo,
      historias: historiasEncendidas,
    });
  });

  const swaggerSpec = contratoParaSwagger(contrato, config);
  app.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').send(YAML.stringify(swaggerSpec));
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: `Aurora Vida API · ${config.ambiente}`,
      swaggerOptions: { docExpansion: 'list', displayRequestDuration: true },
    }),
  );

  // Cada request de API trabaja en el espacio del semillero (header X-Semillero)
  const semillero = middlewareSemillero(espacios);

  if (config.modo === 'test') {
    app.use('/api/test', semillero, rutasSoporte());
  }

  // Frontend (web/dist): se sirve desde la misma URL que la API.
  // Cualquier ruta que no sea de la API devuelve index.html (la web maneja sus rutas).
  if (existsSync(join(RUTA_WEB, 'index.html'))) {
    app.use(express.static(RUTA_WEB, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api(\/|$)|api-docs(\/|$)|openapi\.yaml$).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(RUTA_WEB, 'index.html'));
    });
  }

  // El validador revisa requests y responses de /api/v1 contra el contrato.
  // Una respuesta que no cumple el contrato se reporta en el log (onError) sin romper la respuesta;
  // las pruebas automáticas fallan si aparece alguna.
  app.use('/api/v1', semillero);
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
  if (historiaActiva(config, 'HU-01')) {
    v1.use(rutasCatalogos());
    v1.use(rutasCotizaciones());
  }
  app.use('/api/v1', v1);

  app.use(manejadorNoEncontrado);
  app.use(manejadorErrores);

  return { app, espacios, violacionesContrato };
}
