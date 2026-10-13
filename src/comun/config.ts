/** Configuración leída de variables de entorno. */
export type Ambiente = 'LOCAL' | 'DEV' | 'CERTI' | 'PROD';
const AMBIENTES: Ambiente[] = ['LOCAL', 'DEV', 'CERTI', 'PROD'];

export interface Config {
  puerto: number;
  /** Ambiente en el que corre la instancia; se informa en /api/health y en el header X-Ambiente. */
  ambiente: Ambiente;
  /** "test" habilita los endpoints de soporte de pruebas (/api/test/*). */
  modo: 'test' | 'produccion';
  /** Defectos sembrados activos: vacío = ninguno (versión de referencia). */
  bugs: Set<string>;
  /** Feature flags por historia (TBD): '*' = todas; si no, la lista de HU encendidas. */
  funcionalidades: Set<string>;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const ambiente = (env.AMBIENTE ?? 'LOCAL').trim().toUpperCase() as Ambiente;
  return {
    puerto: Number(env.PORT ?? 3000),
    ambiente: AMBIENTES.includes(ambiente) ? ambiente : 'LOCAL',
    modo: env.APP_MODE === 'test' ? 'test' : 'produccion',
    bugs: parsearLista(env.BUGS, 'NINGUNO'),
    funcionalidades: parsearLista(env.FUNCIONALIDADES, 'TODAS'),
  };
}

/** "ninguno" → vacío, "todos"/"todas" → '*', "A, b" → {A, B}. */
function parsearLista(valor: string | undefined, porDefecto: string): Set<string> {
  const limpio = (valor ?? porDefecto).trim().toUpperCase();
  if (limpio === '' || limpio === 'NINGUNO' || limpio === 'NINGUNA') return new Set();
  if (limpio === 'TODOS' || limpio === 'TODAS') return new Set(['*']);
  return new Set(limpio.split(',').map((b) => b.trim()).filter(Boolean));
}

/** Indica si un defecto sembrado está activo. Aún no hay defectos definidos para la HU-01. */
export function bugActivo(config: Config, id: string): boolean {
  return config.bugs.has('*') || config.bugs.has(id.toUpperCase());
}

/** Indica si una historia está encendida (feature flag). */
export function historiaActiva(config: Config, historia: string): boolean {
  return config.funcionalidades.has('*') || config.funcionalidades.has(historia.toUpperCase());
}
