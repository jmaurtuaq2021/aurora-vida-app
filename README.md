# Aurora Vida – API (privado)

API de Aurora Vida, la web ficticia de venta de seguro de vida temporal del semillero QE.
**Este repositorio debe ser privado**: contiene las reglas de negocio y, más adelante, los defectos sembrados.

Versión actual: **HU-01 Cotizador** (`1.0.0-hu01`).

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | /api/v1/catalogos/plazos | Plazos disponibles |
| POST | /api/v1/cotizaciones | Calcula y registra una cotización |
| GET | /api/v1/cotizaciones/{id} | Consulta una cotización |
| POST | /api/test/reset | Restaura los datos (solo `APP_MODE=test`) |
| GET / PUT / DELETE | /api/test/reloj | Reloj simulado (solo `APP_MODE=test`) |
| GET | /api/health | Estado de la API |
| GET | /api-docs | Swagger UI |

## Desarrollo local

```bash
npm install
APP_MODE=test npm run dev     # http://localhost:3000/api-docs
npm test                      # pruebas contra el oráculo de primas y los límites
```

En Windows PowerShell: `$env:APP_MODE="test"; npm run dev`.

## Variables de entorno

| Variable | Valor por defecto en la imagen | Efecto |
| --- | --- | --- |
| `PORT` | 3000 | Puerto HTTP |
| `APP_MODE` | test | `test` habilita `/api/test/*`; otro valor los oculta (404) |
| `BUGS` | ninguno | Defectos sembrados: `ninguno`, `todos` o lista `BUG-01,BUG-03` |

## Publicar una versión

1. Sube el código a este repo (privado).
2. Crea el tag de la historia y súbelo:
   ```bash
   git tag hu-01
   git push origin hu-01
   ```
3. El workflow **Publicar imagen** corre las pruebas y, si pasan, publica:
   `ghcr.io/<tu-usuario>/aurora-vida:hu-01` y `:latest`.
4. **Solo la primera vez:** en tu perfil de GitHub → Packages → `aurora-vida` → Package settings →
   Change visibility → **Public**, para que los semilleros puedan descargarla sin credenciales.

## Uso de la imagen

```bash
docker run --rm -p 3000:3000 ghcr.io/<tu-usuario>/aurora-vida:hu-01
```

## Reglas implementadas (documento de negocio)

RN-10 a RN-19: edad actuarial cumplida, rango 18–65, suma asegurada 50,000–500,000 en múltiplos de 10,000,
plazos 5/10/15/20, edad + plazo ≤ 75, tarifa por bandas de edad y factores, redondeo mitad hacia arriba
solo en la prima total anual, recargo mensual 8 %, prima mensual mínima S/ 20.00 y vigencia de 30 días.

Notas de implementación:

- `primaNetaAnual` se informa redondeada a 2 decimales; el cálculo usa el valor sin redondear (RN-16).
- Quien nació un 29 de febrero cumple años el 1 de marzo en los años no bisiestos.
- El reset borra los datos pero no toca el reloj simulado.
- Los datos viven en memoria: reiniciar el contenedor equivale a un reset.
