import type { Express } from 'express';
import request from 'supertest';
import { crearApp } from '../src/app';
import { leerConfig } from '../src/comun/config';

const HOY = '2026-10-13T10:00:00-05:00';

function nuevaApp(modo: 'test' | 'produccion' = 'test') {
  const instancia = crearApp(leerConfig({ APP_MODE: modo, BUGS: 'ninguno' }));
  instancia.reloj.fijar(new Date(HOY));
  return instancia;
}

const cotizar = (app: Express, cuerpo: object) =>
  request(app).post('/api/v1/cotizaciones').send(cuerpo);

const base = { fechaNacimiento: '1996-05-20', fumador: false, sumaAsegurada: 100000, plazo: 10 };

describe('POST /api/v1/cotizaciones', () => {
  let inst: ReturnType<typeof nuevaApp>;
  beforeEach(() => {
    inst = nuevaApp();
  });
  afterEach(() => {
    // Ninguna respuesta debe violar el contrato OpenAPI
    expect(inst.violacionesContrato).toEqual([]);
  });

  it('crea la cotización con el ejemplo del contrato (201)', async () => {
    const res = await cotizar(inst.app, base);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/cotizaciones/${res.body.id}`);
    expect(res.body).toMatchObject({
      fechaCotizacion: '2026-10-13',
      fechaVencimiento: '2026-11-12',
      vigente: true,
      edadActuarial: 30,
      primaNetaAnual: 126,
      primaTotalAnual: 129.78,
      primaMensual: 20,
    });
  });

  it.each([
    ['2008-10-13', 201], // cumple 18 hoy
    ['2008-10-14', 422], // cumple 18 mañana: tiene 17
    ['1961-10-13', 201], // 65 años (con plazo 5)
  ])('edad límite (RN-11): nacido %s → %i', async (fecha, status) => {
    const res = await cotizar(inst.app, { ...base, fechaNacimiento: fecha, plazo: 5 });
    expect(res.status).toBe(status);
  });

  it('66 años → EDAD_FUERA_RANGO (RN-11)', async () => {
    const res = await cotizar(inst.app, { ...base, fechaNacimiento: '1960-10-13', plazo: 5 });
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('EDAD_FUERA_RANGO');
  });

  it('fecha de nacimiento futura → EDAD_FUERA_RANGO', async () => {
    const res = await cotizar(inst.app, { ...base, fechaNacimiento: '2030-01-01' });
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('EDAD_FUERA_RANGO');
  });

  it.each([
    ['1961-10-13', 10, 201], // 65 + 10 = 75
    ['1965-10-13', 15, 422], // 61 + 15 = 76
    ['1965-10-14', 15, 201], // 60 + 15 = 75
  ])('edad + plazo (RN-14): nacido %s, plazo %i → %i', async (fecha, plazo, status) => {
    const res = await cotizar(inst.app, { ...base, fechaNacimiento: fecha, plazo });
    expect(res.status).toBe(status);
    if (status === 422) expect(res.body.codigo).toBe('EDAD_PLAZO_EXCEDIDO');
  });

  it.each([
    [50000, 201], [500000, 201], [40000, 400], [510000, 400], [55000, 400], [49999, 400],
  ])('suma asegurada %i → %i (RN-12)', async (sumaAsegurada, status) => {
    const res = await cotizar(inst.app, { ...base, sumaAsegurada });
    expect(res.status).toBe(status);
    if (status === 400) expect(res.body.detalles).toContainEqual(expect.objectContaining({ campo: 'sumaAsegurada' }));
  });

  it.each([5, 10, 15, 20])('plazo válido %i', async (plazo) => {
    expect((await cotizar(inst.app, { ...base, plazo })).status).toBe(201);
  });

  it.each([0, 7, 25, '10'])('plazo inválido %s → 400', async (plazo) => {
    const res = await cotizar(inst.app, { ...base, plazo });
    expect(res.status).toBe(400);
  });

  it('tipos incorrectos no se convierten en silencio', async () => {
    const res = await cotizar(inst.app, { ...base, sumaAsegurada: '100000', fumador: 'false' });
    expect(res.status).toBe(400);
    const campos = res.body.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['sumaAsegurada', 'fumador']));
  });

  it('reporta todos los campos faltantes a la vez', async () => {
    const res = await cotizar(inst.app, {});
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION');
    expect(res.body.detalles).toHaveLength(4);
    expect(res.body.detalles.every((d: { mensaje: string }) => d.mensaje === 'Es obligatorio.')).toBe(true);
  });

  it('rechaza campos no definidos y fechas imposibles', async () => {
    const res = await cotizar(inst.app, { ...base, fechaNacimiento: '1996-02-30', extra: 1 });
    expect(res.status).toBe(400);
    const campos = res.body.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['fechaNacimiento', 'extra']));
  });

  it('JSON mal formado → 400 con formato de error', async () => {
    const res = await request(inst.app)
      .post('/api/v1/cotizaciones')
      .set('Content-Type', 'application/json')
      .send('{malo');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'VALIDACION', traceId: expect.any(String) });
  });
});

describe('GET /api/v1/cotizaciones/{id} y vigencia (RN-19)', () => {
  it('vigente hasta el día 30 inclusive; vencida el día 31', async () => {
    const inst = nuevaApp();
    const { body } = await cotizar(inst.app, base);

    inst.reloj.fijar(new Date('2026-11-12T23:59:00-05:00')); // día 30
    expect((await request(inst.app).get(`/api/v1/cotizaciones/${body.id}`)).body.vigente).toBe(true);

    inst.reloj.fijar(new Date('2026-11-13T00:00:00-05:00')); // día 31
    const res = await request(inst.app).get(`/api/v1/cotizaciones/${body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.vigente).toBe(false);
    expect(inst.violacionesContrato).toEqual([]);
  });

  it('id inexistente → 404 COTIZACION_NO_ENCONTRADA', async () => {
    const inst = nuevaApp();
    const res = await request(inst.app).get('/api/v1/cotizaciones/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('COTIZACION_NO_ENCONTRADA');
  });

  it('id con formato inválido → 400', async () => {
    const res = await request(nuevaApp().app).get('/api/v1/cotizaciones/abc');
    expect(res.status).toBe(400);
  });
});

describe('Catálogos y misceláneos', () => {
  it('GET /catalogos/plazos', async () => {
    const res = await request(nuevaApp().app).get('/api/v1/catalogos/plazos');
    expect(res.status).toBe(200);
    expect(res.body.map((p: { valor: number }) => p.valor)).toEqual([5, 10, 15, 20]);
  });

  it('ruta inexistente → 404 con formato de error', async () => {
    const res = await request(nuevaApp().app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('RECURSO_NO_ENCONTRADO');
  });

  it('health y swagger responden', async () => {
    const app = nuevaApp().app;
    expect((await request(app).get('/api/health')).body.estado).toBe('OK');
    expect((await request(app).get('/api-docs/')).status).toBe(200);
  });
});

describe('Soporte de pruebas', () => {
  it('reloj: fijar, consultar y restaurar', async () => {
    const app = nuevaApp().app;
    const put = await request(app).put('/api/test/reloj').send({ fechaHora: '2026-12-01T08:30:00-05:00' });
    expect(put.body).toEqual({ fechaHora: '2026-12-01T08:30:00-05:00', simulado: true });
    expect((await request(app).get('/api/test/reloj')).body.fechaHora).toBe('2026-12-01T08:30:00-05:00');
    expect((await request(app).delete('/api/test/reloj')).status).toBe(204);
    expect((await request(app).get('/api/test/reloj')).body.simulado).toBe(false);
  });

  it('reloj: rechaza fecha sin zona horaria', async () => {
    const res = await request(nuevaApp().app).put('/api/test/reloj').send({ fechaHora: '2026-12-01T08:30:00' });
    expect(res.status).toBe(400);
    expect(res.body.detalles[0].campo).toBe('fechaHora');
  });

  it('reset borra las cotizaciones', async () => {
    const app = nuevaApp().app;
    const { body } = await cotizar(app, base);
    expect((await request(app).post('/api/test/reset')).status).toBe(204);
    expect((await request(app).get(`/api/v1/cotizaciones/${body.id}`)).status).toBe(404);
  });

  it('fuera de APP_MODE=test los endpoints de soporte no existen', async () => {
    const res = await request(nuevaApp('produccion').app).post('/api/test/reset');
    expect(res.status).toBe(404);
  });
});
