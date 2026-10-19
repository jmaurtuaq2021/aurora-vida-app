import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';

// Frontend simulado: la prueba no depende de haber compilado web/
const carpeta = mkdtempSync(join(tmpdir(), 'aurora-web-'));
mkdirSync(join(carpeta, 'assets'));
writeFileSync(join(carpeta, 'index.html'), '<!doctype html><title>Aurora Vida</title><div id="root"></div>');
writeFileSync(join(carpeta, 'assets', 'app.js'), 'console.log("ok")');
process.env.WEB_PATH = carpeta;

describe('Frontend servido por la API', () => {
  let app: import('express').Express;
  beforeAll(async () => {
    const { crearApp } = await import('../src/app');
    const { leerConfig } = await import('../src/comun/config');
    app = crearApp(leerConfig({ APP_MODE: 'test' })).app;
  });

  it.each(['/', '/ingresar', '/ingresar?cotizacion=abc', '/cualquier/ruta'])('%s devuelve la página', async (ruta) => {
    const res = await request(app).get(ruta);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('sirve los archivos estáticos', async () => {
    const res = await request(app).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('console.log');
  });

  it('las rutas de API desconocidas siguen respondiendo 404 en JSON', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('RECURSO_NO_ENCONTRADO');
    expect((await request(app).get('/api/otra')).status).toBe(404);
  });

  it('Swagger y el contrato no se reemplazan por la web', async () => {
    expect((await request(app).get('/openapi.yaml')).text).toContain('openapi:');
    expect((await request(app).get('/api-docs/')).text).toContain('swagger');
  });
});
