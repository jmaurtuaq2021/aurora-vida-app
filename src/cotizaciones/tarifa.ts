import Decimal from 'decimal.js';

/**
 * Tarifa de Vida Aurora Temporal (documento de negocio, RN-15 a RN-18).
 * Todo el cálculo usa aritmética decimal: con punto flotante 4,812.675
 * redondearía a 4,812.67 en lugar de 4,812.68.
 */

export const EDAD_MINIMA = 18; // RN-11
export const EDAD_MAXIMA = 65; // RN-11
export const EDAD_MAXIMA_AL_TERMINO = 75; // RN-14
export const PLAZOS = [5, 10, 15, 20] as const; // RN-13
export type Plazo = (typeof PLAZOS)[number];

/** RN-15: tasa base anual por cada S/ 1,000 de suma asegurada. */
const TASAS: Array<{ desde: number; hasta: number; tasa: string }> = [
  { desde: 18, hasta: 30, tasa: '1.20' },
  { desde: 31, hasta: 40, tasa: '1.80' },
  { desde: 41, hasta: 50, tasa: '3.10' },
  { desde: 51, hasta: 60, tasa: '5.40' },
  { desde: 61, hasta: 65, tasa: '8.90' },
];

const FACTOR_FUMADOR = { si: '1.50', no: '1.00' };
const FACTOR_PLAZO: Record<Plazo, string> = { 5: '1.00', 10: '1.05', 15: '1.10', 20: '1.15' };

const DERECHO_EMISION = new Decimal('1.03'); // RN-16
const RECARGO_FRACCIONAMIENTO = new Decimal('1.08'); // RN-17
const PRIMA_MENSUAL_MINIMA = new Decimal('20.00'); // RN-18

const redondear = (valor: Decimal) => valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function tasaPorEdad(edad: number): Decimal {
  const fila = TASAS.find((t) => edad >= t.desde && edad <= t.hasta);
  if (!fila) throw new Error(`Edad sin tasa: ${edad}`);
  return new Decimal(fila.tasa);
}

export interface ResultadoTarifa {
  /** Valor sin redondear, como lo exige RN-16. */
  primaNetaAnual: Decimal;
  primaTotalAnual: Decimal;
  primaMensual: Decimal;
}

export function calcularPrimas(params: {
  edad: number;
  fumador: boolean;
  sumaAsegurada: number;
  plazo: Plazo;
}): ResultadoTarifa {
  const { edad, fumador, sumaAsegurada, plazo } = params;

  // RN-16: neta = (SA / 1000) × tasa × factor fumador × factor plazo
  const primaNetaAnual = new Decimal(sumaAsegurada)
    .div(1000)
    .mul(tasaPorEdad(edad))
    .mul(fumador ? FACTOR_FUMADOR.si : FACTOR_FUMADOR.no)
    .mul(FACTOR_PLAZO[plazo]);

  // RN-16: solo la prima total anual se redondea (mitad hacia arriba)
  const primaTotalAnual = redondear(primaNetaAnual.mul(DERECHO_EMISION));

  // RN-17: mensual sobre la anual ya redondeada; RN-18: mínimo S/ 20.00
  const mensualCalculada = redondear(primaTotalAnual.mul(RECARGO_FRACCIONAMIENTO).div(12));
  const primaMensual = Decimal.max(mensualCalculada, PRIMA_MENSUAL_MINIMA);

  return { primaNetaAnual, primaTotalAnual, primaMensual };
}

/** Monto para mostrar en la respuesta: 2 decimales, mitad hacia arriba. */
export const aMonto = (valor: Decimal): number => redondear(valor).toNumber();
