import request from 'supertest';
import { crearApp } from '../src/app';
import { leerConfig } from '../src/comun/config';

const base = { fechaNacimiento: '1996-05-20', fumador: false, sumaAsegurada: 100000, plazo: 10 };

const app = (env: Record<string, string> = {}) =>
  crearApp(leerConfig({ APP_MODE: 'test', ...env }));

describe('Aislamiento por X-Semillero', () => {
  it('las cotizaciones de un semillero no son visibles para otro', async () => {
    const { app: a } = app();
    const creada = await request(a).post('/api/v1/cotizaciones').set('X-Semillero', 'ana').send(base);
    expect(creada.status).toBe(201);
    expect(creada.headers['x-semillero']).toBe('ana');

    expect((await request(a).get(`/api/v1/cotizaciones/${creada.body.id}`).set('X-Semillero', 'ana')).status).toBe(200);
    expect((await request(a).get(`/api/v1/cotizaciones/${creada.body.id}`).set('X-Semillero', 'luis')).status).toBe(404);
    expect((await request(a).get(`/api/v1/cotizaciones/${creada.body.id}`)).status).toBe(404); // espacio general
  });

  it('el header no distingue mayúsculas', async () => {
    const { app: a } = app();
    const creada = await request(a).post('/api/v1/cotizaciones').set('X-Semillero', 'JPerez').send(base);
    expect(creada.headers['x-semillero']).toBe('jperez');
    expect((await request(a).get(`/api/v1/cotizaciones/${creada.body.id}`).set('X-Semillero', 'jperez')).status).toBe(200);
  });

  it('el reloj de un semillero no mueve el de otro', async () => {
    const { app: a } = app();
    await request(a).put('/api/test/reloj').set('X-Semillero', 'ana').send({ fechaHora: '2030-01-01T09:00:00-05:00' });
    const ana = await request(a).get('/api/test/reloj').set('X-Semillero', 'ana');
    const luis = await request(a).get('/api/test/reloj').set('X-Semillero', 'luis');
    expect(ana.body).toEqual({ fechaHora: '2030-01-01T09:00:00-05:00', simulado: true });
    expect(luis.body.simulado).toBe(false);

    const cot = await request(a).post('/api/v1/cotizaciones').set('X-Semillero', 'ana').send(base);
    expect(cot.body.fechaCotizacion).toBe('2030-01-01');
  });

  it('el reset de un semillero no borra los datos de otro', async () => {
    const { app: a } = app();
    const deLuis = await request(a).post('/api/v1/cotizaciones').set('X-Semillero', 'luis').send(base);
    await request(a).post('/api/test/reset').set('X-Semillero', 'ana');
    expect((await request(a).get(`/api/v1/cotizaciones/${deLuis.body.id}`).set('X-Semillero', 'luis')).status).toBe(200);
  });

  it.each(['a', 'con espacio', 'ñandú', '-empieza-con-guion', 'x'.repeat(31)])(
    'X-Semillero inválido "%s" → 400',
    async (valor) => {
      const res = await request(app().app).get('/api/v1/catalogos/plazos').set('X-Semillero', valor);
      expect(res.status).toBe(400);
      expect(res.body.detalles[0].campo).toBe('X-Semillero');
    },
  );
});

describe('Ambiente', () => {
  it('health y header X-Ambiente informan el ambiente', async () => {
    const { app: a } = app({ AMBIENTE: 'certi' });
    const res = await request(a).get('/api/health');
    expect(res.headers['x-ambiente']).toBe('CERTI');
    expect(res.body).toMatchObject({ estado: 'OK', ambiente: 'CERTI', modo: 'test', historias: ['HU-01'] });
  });

  it('ambiente desconocido → LOCAL', async () => {
    const res = await request(app({ AMBIENTE: 'qa' }).app).get('/api/health');
    expect(res.body.ambiente).toBe('LOCAL');
  });

  it('PROD sin modo test: no hay soporte de pruebas ni en la API ni en Swagger', async () => {
    const { app: a } = crearApp(leerConfig({ AMBIENTE: 'PROD', APP_MODE: 'produccion' }));
    expect((await request(a).post('/api/test/reset')).status).toBe(404);
    const yaml = (await request(a).get('/openapi.yaml')).text;
    expect(yaml).not.toContain('/test/reset');
    expect((await request(a).post('/api/v1/cotizaciones').send(base)).status).toBe(201);
  });
});

describe('Feature flags por historia (FUNCIONALIDADES)', () => {
  it('por defecto todas las historias están encendidas', async () => {
    const { app: a } = app();
    expect((await request(a).get('/api/v1/catalogos/plazos')).status).toBe(200);
  });

  it('una historia apagada responde 404 y desaparece de Swagger', async () => {
    const { app: a, violacionesContrato } = app({ FUNCIONALIDADES: 'HU-99' });
    const res = await request(a).post('/api/v1/cotizaciones').send(base);
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('RECURSO_NO_ENCONTRADO');
    expect((await request(a).get('/openapi.yaml')).text).not.toContain('/cotizaciones');
    expect((await request(a).get('/api/health')).body.historias).toEqual([]);
    expect(violacionesContrato).toEqual([]);
  });

  it('se enciende por lista explícita', async () => {
    const { app: a } = app({ FUNCIONALIDADES: 'hu-01, HU-02' });
    expect((await request(a).post('/api/v1/cotizaciones').send(base)).status).toBe(201);
  });
});
