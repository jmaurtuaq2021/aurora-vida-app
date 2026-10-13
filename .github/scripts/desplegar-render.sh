#!/usr/bin/env bash
# Pide a Render que despliegue una imagen concreta en un ambiente.
# Uso:  RENDER_HOOK=<deploy hook> desplegar-render.sh <AMBIENTE> <imagen:tag>
# Si el secreto del ambiente no está configurado, avisa y termina sin error,
# para que el pipeline funcione aunque Render todavía no esté listo.
set -euo pipefail

AMBIENTE="$1"
IMAGEN="$2"
RESUMEN="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ -z "${RENDER_HOOK:-}" ]; then
  echo "::warning::Falta el secreto RENDER_DEPLOY_HOOK_${AMBIENTE}. Se omite el despliegue a ${AMBIENTE}."
  echo "### ${AMBIENTE}: despliegue omitido (falta el secreto RENDER_DEPLOY_HOOK_${AMBIENTE})" >> "$RESUMEN"
  exit 0
fi

# Render permite indicar la imagen exacta con el parámetro imgURL (codificado).
IMAGEN_CODIFICADA=$(jq -rn --arg v "$IMAGEN" '$v|@uri')
SEPARADOR='?'
[[ "$RENDER_HOOK" == *\?* ]] && SEPARADOR='&'

CODIGO=$(curl -sS -o /tmp/render.txt -w '%{http_code}' -X POST "${RENDER_HOOK}${SEPARADOR}imgURL=${IMAGEN_CODIFICADA}")

if [[ "$CODIGO" != 2* ]]; then
  echo "::error::Render respondió ${CODIGO} al desplegar ${AMBIENTE}."
  cat /tmp/render.txt || true
  exit 1
fi

echo "Despliegue a ${AMBIENTE} solicitado: ${IMAGEN}"
{
  echo "### ${AMBIENTE}: despliegue solicitado"
  echo '```'
  echo "${IMAGEN}"
  echo '```'
  echo "Render tarda unos minutos en dejar la nueva versión arriba."
} >> "$RESUMEN"
