#!/usr/bin/env bash
# ProMatchXI job-runner wrapper.
# v3 (22-07-2026): 'git pull --ff-only' vervangen door fetch + reset --hard.
#   Aanleiding: setup-jobs.sh deed ooit 'chmod +x jobs/run.sh'. Git ziet dat
#   rechten-bitje als een lokale wijziging, waardoor de eerste upstream-wijziging
#   aan run.sh de pull blokkeerde en de box stil oude code bleef draaien.
#   De box is een pure consument: de repo is de waarheid.
#
#   LET OP: wijzigingen in GEVOLGDE bestanden op de box worden overschreven.
#   Niet-gevolgde bestanden (.env, losse scripts) blijven ongemoeid — er wordt
#   bewust GEEN 'git clean' gedraaid, dat zou .env weggooien.
#
# Alles staat in main(); bash leest een functie in zijn geheel in voordat hij
# hem uitvoert. Dat is nodig omdat dit script zichzelf tijdens de rit vervangt.
set -u

REPO_VERWACHT="RobLizet/Toto-AI"

main() {
  cd "$(dirname "$0")/.." || exit 1

  if [ ! -d .git ]; then
    echo "[run] FOUT: $(pwd) is geen git-repo. Niets gedraaid."
    exit 1
  fi

  # Veiligheidsslot: nooit hard resetten in een map die niet onze repo is.
  REMOTE="$(git config --get remote.origin.url 2>/dev/null)"
  case "$REMOTE" in
    *"$REPO_VERWACHT"*) : ;;
    *)
      echo "[run] FOUT: onverwachte remote '$REMOTE' (verwacht $REPO_VERWACHT). Niets gereset, niets gedraaid."
      exit 1
      ;;
  esac

  SHA_VOOR="$(git rev-parse --short HEAD 2>/dev/null)"
  if [ -z "$SHA_VOOR" ]; then SHA_VOOR="onbekend"; fi

  if FETCH_UIT="$(git fetch --depth 1 origin main 2>&1)"; then
    if RESET_UIT="$(git reset --hard FETCH_HEAD 2>&1)"; then
      PMX_GIT_PULL="sync-ok"
    else
      PMX_GIT_PULL="RESET-FAALDE"
      echo "[run] LET OP: git reset faalde: $(echo "$RESET_UIT" | tr '\n' ' ' | cut -c1-200)"
    fi
  else
    PMX_GIT_PULL="FETCH-FAALDE"
    echo "[run] LET OP: git fetch faalde: $(echo "$FETCH_UIT" | tr '\n' ' ' | cut -c1-200)"
  fi

  PMX_GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
  if [ -z "$PMX_GIT_SHA" ]; then PMX_GIT_SHA="sha-onbekend"; fi
  if [ "$PMX_GIT_SHA" != "$SHA_VOOR" ]; then
    echo "[run] code bijgewerkt: $SHA_VOOR -> $PMX_GIT_SHA"
  fi
  export PMX_GIT_PULL PMX_GIT_SHA

  JOB="${PMX_JOB:-heartbeat}"
  if [ ! -f "jobs/${JOB}.js" ]; then
    echo "[run] FOUT: jobs/${JOB}.js bestaat niet (PMX_JOB=$JOB). Niets gedraaid."
    exit 1
  fi

  echo "[run] $(date -u +%FT%TZ) job=$JOB host=$(hostname) sha=$PMX_GIT_SHA $PMX_GIT_PULL"
  exec node "jobs/${JOB}.js"
}

main "$@"
