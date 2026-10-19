const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const solesSinDecimales = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Intl usa un espacio no separable entre "S/" y el monto; se cambia por un espacio normal
// para que las pruebas puedan comparar el texto tal como se lee.
const espacioNormal = (texto: string) => texto.replace(/ /g, ' ');

/** 1652.38 → "S/ 1,652.38" */
export const enSoles = (monto: number) => espacioNormal(soles.format(monto));

/** 100000 → "S/ 100,000" */
export const enSolesEnteros = (monto: number) => espacioNormal(solesSinDecimales.format(monto));

/** "2026-11-12" → "12/11/2026" (sin pasar por Date para no correr el día por zona horaria) */
export const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

/** Sumas aseguradas permitidas: S/ 50,000 a S/ 500,000 en pasos de S/ 10,000. */
export const SUMAS_ASEGURADAS = Array.from({ length: 46 }, (_, i) => 50000 + i * 10000);
