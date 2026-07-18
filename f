#!/usr/bin/env bash
# ProMatchXI proxy: SSH-toegang herstellen (poort 22 + sleutel). Tijdelijk script.
set -u
echo "=== ProMatchXI proxy — SSH herstellen ==="

# 1) Publieke sleutel toevoegen aan root
mkdir -p /root/.ssh; chmod 700 /root/.ssh
KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICY387AWizduSOj5cbk3h1OknRfqMQyMxDjfREO4hOvb pmx-proxy"
touch /root/.ssh/authorized_keys
if grep -qxF "$KEY" /root/.ssh/authorized_keys; then
  echo "[ok] sleutel stond er al"
else
  echo "$KEY" >> /root/.ssh/authorized_keys
  echo "[ok] sleutel toegevoegd"
fi
chmod 600 /root/.ssh/authorized_keys

# 2) sshd: pubkey + root-login toestaan via drop-in (sshd_config zelf niet aanraken)
mkdir -p /etc/ssh/sshd_config.d
printf 'Port 22\nPermitRootLogin prohibit-password\nPubkeyAuthentication yes\n' > /etc/ssh/sshd_config.d/00-pmx-access.conf
echo "[ok] sshd drop-in geschreven"

# 3) sshd alleen aanraken als hij NIET al op 22 luistert
if ss -tlnp 2>/dev/null | grep -q ':22 '; then
  echo "[ok] sshd luistert al op poort 22 — service niet aangeraakt"
else
  echo "[info] sshd luistert nog niet op 22 — service starten"
  systemctl enable --now ssh 2>/dev/null || true
  systemctl start ssh.socket 2>/dev/null || true
  systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
fi

# 4) firewall: poort 22 TOESTAAN (nooit iets blokkeren; 80/443 blijft ongemoeid)
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
  ufw allow 22/tcp >/dev/null 2>&1 && echo "[ok] ufw: poort 22 toegestaan"
fi
if command -v nft >/dev/null 2>&1 && nft list ruleset 2>/dev/null | grep -q 'hook input'; then
  nft add rule inet filter input tcp dport 22 accept 2>/dev/null && echo "[ok] nftables: poort 22 toegestaan" || true
fi
if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null && echo "[ok] iptables: poort 22 toegestaan" || true
fi

# 5) Controle
echo "=== CONTROLE ==="
echo "-- luistert sshd op 22? --"
ss -tlnp 2>/dev/null | grep ':22 ' && echo "[OK] JA" || echo "[LET OP] NEE — stuur deze output naar Claude"
echo "-- actieve firewall --"
{ command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | head -6; } || true
echo "=== KLAAR. Test nu vanaf je pc:  ssh -i %USERPROFILE%\\.ssh\\pmx_key root@138.201.189.10 ==="
