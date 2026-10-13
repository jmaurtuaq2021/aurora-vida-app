# Aurora Vida – API (privado)

API de Aurora Vida, la web ficticia de venta de seguro de vida temporal del semillero QE.
**Este repositorio debe ser privado**: contiene las reglas de negocio y, más adelante, los defectos sembrados.

Versión actual: **1.1.0-hu01** (HU-01 Cotizador).

## Flujo de trabajo: Trunk Based Development

```
rama corta feat/... ──PR──► main ──► pruebas ──► imagen :sha-xxxxxxx ──► DEV
                                                   │
                         git tag hu-XX ────────────┴──► misma imagen :hu-XX ──► CERTI
                                                                              │
                         Actions → "Promover a PROD" ─────────────────────────┴──► PROD
```

1. **Cada cambio en una rama corta** (`feat/hu-02-registro`, `fix/redondeo`). Vive horas o pocos días.
2. **Pull Request a `main`**: el workflow **CI/CD** corre tipos, pruebas y validación del contrato. Solo se integra con checks en verde.
3. **Merge a `main`** → se construye la imagen `ghcr.io/<usuario>/aurora-vida:sha-xxxxxxx` (y `:latest`) y se despliega en **DEV**.
4. **Liberar una versión a CERTI**: crea el tag sobre `main` y súbelo.
   ```bash
   git checkout main && git pull
   git tag hu-01.1
   git push origin hu-01.1
   ```
   No se reconstruye nada: la imagen que ya pasó por DEV se reetiqueta como `:hu-01.1` y se despliega en **CERTI**.
   Un tag sobre un commit que no pasó por `main` falla a propósito.
5. **Promover a PROD**: Actions → **Promover a PROD** → Run workflow → versión `hu-01.1`.
   La misma imagen certificada se marca como `:prod` y se despliega en **PROD**.

Nombres de versión: `hu-01` (primera entrega de la historia), `hu-01.1`, `hu-01.2`… (revisiones de la misma historia).

## Ambientes en Render

Crea tres Web Services con **+ New → Web Service → Existing Image**, imagen `ghcr.io/<usuario>/aurora-vida:latest`, plan Free.
En cada uno, en **Environment**, configura:

| Servicio | `AMBIENTE` | `APP_MODE` | `FUNCIONALIDADES` | `BUGS` |
| --- | --- | --- | --- | --- |
| `aurora-vida-dev` | DEV | test | todas | ninguno |
| `aurora-vida-certi` | CERTI | test | HU-01 | (los de la HU en prueba) |
| `aurora-vida-prod` | PROD | produccion | HU-01 | ninguno o los aún no corregidos |

Luego copia el **Deploy Hook** de cada servicio (Settings → Deploy Hook) y guárdalo en el repo:
**Settings → Secrets and variables → Actions → New repository secret**

| Secreto | Valor |
| --- | --- |
| `RENDER_DEPLOY_HOOK_DEV` | Deploy hook de `aurora-vida-dev` |
| `RENDER_DEPLOY_HOOK_CERTI` | Deploy hook de `aurora-vida-certi` |
| `RENDER_DEPLOY_HOOK_PROD` | Deploy hook de `aurora-vida-prod` |

Si falta un secreto, el pipeline no falla: avisa y omite ese despliegue.

Plan Free de Render: el servicio se duerme tras 15 min sin tráfico (despierta en ~1 min) y hay 750 horas al mes por workspace.

## Variables de entorno

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `PORT` | 3000 | Puerto HTTP |
| `AMBIENTE` | LOCAL | LOCAL, DEV, CERTI o PROD. Se informa en `/api/health` y en el header `X-Ambiente` |
| `APP_MODE` | test | `test` habilita `/api/test/*`; cualquier otro valor los oculta (404) y los quita de Swagger |
| `FUNCIONALIDADES` | todas | Feature flags: `todas` o lista de historias (`HU-01,HU-02`). Una HU apagada responde 404 y no aparece en Swagger |
| `BUGS` | ninguno | Defectos sembrados: `ninguno`, `todos` o lista (`BUG-01,BUG-03`) |

**Feature flags en TBD:** el código de una historia puede integrarse a `main` antes de liberarse. Se marca en el contrato
con `x-historia: HU-02` y queda apagado en CERTI y PROD (`FUNCIONALIDADES=HU-01`) hasta que lo enciendas.

## Aislamiento por semillero

Cada request puede enviar el header `X-Semillero: <usuario>`. Cada valor tiene sus propias cotizaciones y su propio
reloj, así el reset o el cambio de fecha de un semillero no afecta a los demás. Sin el header se usa el espacio
compartido `general`. Hay un máximo de 100 espacios en memoria (se descarta el menos usado) y 1,000 cotizaciones por espacio.

## Endpoints

| Método | Ruta | Historia |
| --- | --- | --- |
| GET | /api/v1/catalogos/plazos | HU-01 |
| POST | /api/v1/cotizaciones | HU-01 |
| GET | /api/v1/cotizaciones/{id} | HU-01 |
| POST | /api/test/reset | Soporte (solo `APP_MODE=test`) |
| GET / PUT / DELETE | /api/test/reloj | Soporte (solo `APP_MODE=test`) |
| GET | /api/health | Estado, versión, ambiente e historias encendidas |
| GET | /api-docs | Swagger UI de esa instancia |

## Desarrollo local

```bash
npm install
npm test                         # 72 pruebas: oráculo de primas, límites, contrato, aislamiento, flags
APP_MODE=test npm run dev        # http://localhost:3000/api-docs
```

En Windows PowerShell: `$env:APP_MODE="test"; npm run dev`.

## Reglas implementadas (documento de negocio)

RN-10 a RN-19: edad actuarial cumplida, rango 18–65, suma asegurada 50,000–500,000 en múltiplos de 10,000,
plazos 5/10/15/20, edad + plazo ≤ 75, tarifa por bandas de edad y factores, redondeo mitad hacia arriba
solo en la prima total anual, recargo mensual 8 %, prima mensual mínima S/ 20.00 y vigencia de 30 días.

Notas de implementación:

- `primaNetaAnual` se informa redondeada a 2 decimales; el cálculo usa el valor sin redondear (RN-16).
- Quien nació un 29 de febrero cumple años el 1 de marzo en los años no bisiestos.
- El reset borra los datos del semillero pero no toca su reloj simulado.
- Los datos viven en memoria: reiniciar o redesplegar el servicio equivale a un reset de todos.
