#!/usr/bin/env bash
# Wrapper: repo bijwerken, dan de ingestelde job draaien (PMX_JOB, standaard heartbeat).
set -u
cd "$(dirname "$0")/.." || exit 1
git pull --ff-only --quiet 2>/dev/null || true
JOB="${PMX_JOB:-heartbeat}"
echo "[run] $(date -u +%FT%TZ) job=$JOB host=$(hostname)"
exec node "jobs/${JOB}.js"
