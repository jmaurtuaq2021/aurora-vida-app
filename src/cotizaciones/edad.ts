/**
 * RN-10: edad actuarial = edad cumplida a la fecha de cotización.
 * Quien nació un 29 de febrero cumple años el 1 de marzo en los años no bisiestos.
 */
export function edadCumplida(fechaNacimiento: string, fechaReferencia: string): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [ar, mr, dr] = fechaReferencia.split('-').map(Number);
  let edad = ar - an;
  if (mr < mn || (mr === mn && dr < dn)) edad -= 1;
  return edad;
}
