#!/usr/bin/env bash
# Wrapper: repo bijwerken, dan de ingestelde job draaien (PMX_JOB, standaard heartbeat).
# v2 (22-07-2026): een mislukte git pull werd stil weggeslikt (2>/dev/null || true),
# waardoor "oude code gedraaid" niet te onderscheiden was van "code bijgewerkt".
# De uitkomst gaat nu mee als PMX_GIT_PULL en de gedraaide commit als PMX_GIT_SHA.
set -u
cd "$(dirname "$0")/.." || exit 1

PULL_UIT="$(git pull --ff-only 2>&1)"
PULL_RC=$?
if [ "$PULL_RC" -eq 0 ]; then
  PMX_GIT_PULL="pull-ok"
else
  PMX_GIT_PULL="PULL-FAALDE(rc=$PULL_RC)"
  echo "[run] LET OP: git pull faalde (rc=$PULL_RC): $(echo "$PULL_UIT" | tr '\n' ' ' | cut -c1-200)"
fi

PMX_GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
if [ -z "$PMX_GIT_SHA" ]; then PMX_GIT_SHA="sha-onbekend"; fi
export PMX_GIT_PULL PMX_GIT_SHA

JOB="${PMX_JOB:-heartbeat}"
if [ ! -f "jobs/${JOB}.js" ]; then
  echo "[run] FOUT: jobs/${JOB}.js bestaat niet (PMX_JOB=$JOB). Niets gedraaid."
  exit 1
fi

echo "[run] $(date -u +%FT%TZ) job=$JOB host=$(hostname) sha=$PMX_GIT_SHA $PMX_GIT_PULL"
exec node "jobs/${JOB}.js"
