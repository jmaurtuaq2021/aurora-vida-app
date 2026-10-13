/** Configuración leída de variables de entorno. */
export interface Config {
  puerto: number;
  /** "test" habilita los endpoints de soporte de pruebas (/api/test/*). */
  modo: 'test' | 'produccion';
  /** Defectos sembrados activos: vacío = ninguno (versión de referencia). */
  bugs: Set<string>;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const modo = env.APP_MODE === 'test' ? 'test' : 'produccion';
  return {
    puerto: Number(env.PORT ?? 3000),
    modo,
    bugs: parsearBugs(env.BUGS),
  };
}

function parsearBugs(valor: string | undefined): Set<string> {
  const limpio = (valor ?? 'ninguno').trim().toUpperCase();
  if (limpio === '' || limpio === 'NINGUNO') return new Set();
  if (limpio === 'TODOS') return new Set(['*']);
  return new Set(limpio.split(',').map((b) => b.trim()).filter(Boolean));
}

/** Indica si un defecto sembrado está activo. Aún no hay defectos definidos para la HU-01. */
export function bugActivo(config: Config, id: string): boolean {
  return config.bugs.has('*') || config.bugs.has(id.toUpperCase());
}
