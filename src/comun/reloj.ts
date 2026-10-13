/**
 * Reloj único de la aplicación (zona America/Lima).
 * Toda regla con tiempo usa este reloj, nunca Date.now() directo,
 * para que las pruebas puedan fijar la fecha con PUT /api/test/reloj.
 */
export const ZONA = 'America/Lima';

export class Reloj {
  private simulado: Date | null = null;

  ahora(): Date {
    return this.simulado ? new Date(this.simulado.getTime()) : new Date();
  }

  fijar(fecha: Date): void {
    this.simulado = new Date(fecha.getTime());
  }

  restaurar(): void {
    this.simulado = null;
  }

  esSimulado(): boolean {
    return this.simulado !== null;
  }

  /** Fecha calendario de hoy en Lima, formato AAAA-MM-DD. */
  hoy(): string {
    return fechaLocal(this.ahora());
  }
}

function partes(fecha: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(fecha).map((p) => [p.type, p.value]));
}

/** AAAA-MM-DD en hora de Lima. */
export function fechaLocal(fecha: Date): string {
  const p = partes(fecha);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Fecha y hora ISO 8601 con el desfase de Lima (Perú no usa horario de verano: -05:00). */
export function fechaHoraLocal(fecha: Date): string {
  const p = partes(fecha);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-05:00`;
}

/** Suma días calendario a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(a, m - 1, d + dias));
  return utc.toISOString().slice(0, 10);
}
