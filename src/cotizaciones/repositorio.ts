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

/** Tope por semillero para que un servidor compartido no crezca sin límite. */
const MAXIMO_COTIZACIONES = 1000;

/** Almacenamiento en memoria de un semillero. POST /api/test/reset lo vacía. */
export class RepositorioCotizaciones {
  private readonly datos = new Map<string, CotizacionGuardada>();

  guardar(cotizacion: CotizacionGuardada): void {
    this.datos.set(cotizacion.id, cotizacion);
    if (this.datos.size > MAXIMO_COTIZACIONES) {
      const masAntigua = this.datos.keys().next().value as string;
      this.datos.delete(masAntigua);
    }
  }

  buscar(id: string): CotizacionGuardada | undefined {
    return this.datos.get(id);
  }

  vaciar(): void {
    this.datos.clear();
  }
}
