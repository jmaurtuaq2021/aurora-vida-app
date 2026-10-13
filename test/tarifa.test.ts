import { edadCumplida } from '../src/cotizaciones/edad';
import { calcularPrimas, tasaPorEdad } from '../src/cotizaciones/tarifa';

describe('Tarifa (RN-15 a RN-18) – oráculo del documento de negocio', () => {
  it.each([
    // edad, fumador, SA, plazo, total anual, mensual
    [30, false, 100000, 10, '129.78', '20'], // mensual calculada 11.68 → mínimo RN-18
    [45, true, 300000, 20, '1652.38', '148.71'],
    [61, false, 500000, 10, '4812.68', '433.14'], // 4,812.675 redondea arriba (trampa de flotante)
  ] as const)('edad %i, fumador %s, SA %i, plazo %i', (edad, fumador, sa, plazo, anual, mensual) => {
    const r = calcularPrimas({ edad, fumador, sumaAsegurada: sa, plazo });
    expect(r.primaTotalAnual.toString()).toBe(anual);
    expect(r.primaMensual.toString()).toBe(mensual);
  });

  it('la prima neta no se redondea antes del derecho de emisión (RN-16)', () => {
    // Cálculo puro (la API no aceptaría S/ 10,000): 10 × 3.10 × 1.50 × 1.15 = 53.475
    const r = calcularPrimas({ edad: 45, fumador: true, sumaAsegurada: 10000, plazo: 20 });
    expect(r.primaNetaAnual.toString()).toBe('53.475');
    expect(r.primaTotalAnual.toString()).toBe('55.08'); // 53.475 × 1.03 = 55.07925
  });

  it('mensual exactamente en el mínimo y apenas encima', () => {
    // anual que da mensual calculada >= 20: SA 200,000, 30 años, no fumador, 5 años → 240 × 1.03 = 247.20 → 22.25
    const r = calcularPrimas({ edad: 30, fumador: false, sumaAsegurada: 200000, plazo: 5 });
    expect(r.primaTotalAnual.toString()).toBe('247.2');
    expect(r.primaMensual.toString()).toBe('22.25');
  });

  it.each([
    [18, '1.2'], [30, '1.2'], [31, '1.8'], [40, '1.8'], [41, '3.1'],
    [50, '3.1'], [51, '5.4'], [60, '5.4'], [61, '8.9'], [65, '8.9'],
  ])('tasa en el límite de banda: edad %i → %s', (edad, tasa) => {
    expect(tasaPorEdad(edad).toString()).toBe(tasa);
  });
});

describe('Edad actuarial (RN-10)', () => {
  it.each([
    ['1996-10-13', '2026-10-13', 30], // cumple hoy
    ['1996-10-14', '2026-10-13', 29], // cumple mañana
    ['2008-02-29', '2026-02-28', 17], // bisiesto: aún no cumple
    ['2008-02-29', '2026-03-01', 18], // bisiesto: cumple el 1 de marzo
    ['2008-02-29', '2028-02-29', 20],
  ])('nacido %s, a la fecha %s → %i', (nac, ref, edad) => {
    expect(edadCumplida(nac, ref)).toBe(edad);
  });
});
