#!/usr/bin/env bash
set -uo pipefail
echo "=== ProMatchXI job-runner setup ==="
DIR=/opt/pmx-jobs

echo "[1/4] Node + git installeren (kan een minuut duren)..."
apt-get update -qq
apt-get install -y -qq nodejs git >/dev/null 2>&1
echo "     node $(node -v 2>/dev/null || echo '?'), git $(git --version 2>/dev/null | awk '{print $3}')"

echo "[2/4] Repo klaarzetten in $DIR ..."
if [ -d "$DIR/.git" ]; then
  if git -C "$DIR" fetch --depth 1 origin main && git -C "$DIR" reset --hard FETCH_HEAD >/dev/null; then
    echo "     repo bijgewerkt naar $(git -C "$DIR" rev-parse --short HEAD)"
  else
    echo "[FOUT] repo bijwerken mislukt"; exit 1
  fi
else
  git clone --depth 1 https://github.com/RobLizet/Toto-AI.git "$DIR" >/dev/null 2>&1 && echo "     repo gekloond" || { echo "[FOUT] clonen mislukt"; exit 1; }
fi
# GEEN chmod +x op jobs/run.sh: git volgt het rechten-bitje, dat gaf een
# permanente "lokale wijziging" die pulls blokkeerde. systemd start het script
# via /usr/bin/bash, dus het uitvoerbaar-bitje is niet nodig.

echo "[3/4] .env klaarzetten ..."
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<'EOF'
# --- ProMatchXI job-runner secrets (blijft LOKAAL op de box) ---
SUPABASE_URL=https://gtmzznlknmpjcwuyupjv.supabase.co
SUPABASE_SERVICE_KEY=VUL_HIER_JE_SERVICE_ROLE_KEY_IN
# Welke job de timer draait (bestandsnaam in jobs/ zonder .js):
PMX_JOB=heartbeat
EOF
  chmod 600 "$DIR/.env"
  echo "     .env-template geschreven -> MOET nog ingevuld ($DIR/.env)"
else
  echo "     bestaande .env behouden (secrets ongemoeid)"
fi

echo "[4/4] systemd service + timer plaatsen (timer nog UIT) ..."
cat > /etc/systemd/system/pmx-jobs.service <<EOF
[Unit]
Description=ProMatchXI job runner (repo-sync + node)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
ExecStart=/usr/bin/bash $DIR/jobs/run.sh
EOF
cat > /etc/systemd/system/pmx-jobs.timer <<EOF
[Unit]
Description=ProMatchXI job runner timer

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
echo ""
echo "=== KLAAR met installeren. Nu jij: ==="
echo "1) Vul je Supabase service_role key in:"
echo "     nano $DIR/.env"
echo "2) Test de keten 1x handmatig:"
echo "     systemctl start pmx-jobs.service && journalctl -u pmx-jobs.service -n 15 --no-pager"
echo "   -> zoek de regel [OK] rij geschreven naar job_heartbeat"
echo "3) Pas als dat werkt, timer aanzetten:"
echo "     systemctl enable --now pmx-jobs.timer"
