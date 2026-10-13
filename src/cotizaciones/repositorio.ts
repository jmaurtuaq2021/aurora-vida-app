import type { Plazo } from './tarifa';

export interface CotizacionGuardada {
  id: string;
  fechaCotizacion: string;
  fechaVencimiento: string;
  fechaNacimiento: string;
  edadActuarial: number;
  fumador: boolean;
  sumaAsegurada: number;
  plazo: Plazo;
  primaNetaAnual: number;
  primaTotalAnual: number;
  primaMensual: number;
}

/** Almacenamiento en memoria. POST /api/test/reset lo vacía. */
export class RepositorioCotizaciones {
  private readonly datos = new Map<string, CotizacionGuardada>();

  guardar(cotizacion: CotizacionGuardada): void {
    this.datos.set(cotizacion.id, cotizacion);
  }

  buscar(id: string): CotizacionGuardada | undefined {
    return this.datos.get(id);
  }

  vaciar(): void {
    this.datos.clear();
  }
}
