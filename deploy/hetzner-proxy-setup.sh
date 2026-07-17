#!/usr/bin/env bash
# ProMatchXI — api-sports proxy op Hetzner (ubuntu-2gb-fsn1-3)
#
# WAAROM: api-sports support (17-07-2026) bevestigt dat gedeelde Cloudflare-egress-IP's
# rate-limit/anti-abuse triggeren, ook als je eigen volume laag is. Gemeten dezelfde dag:
# 4 van 8 parallelle calls geweigerd bij 2,1% dagverbruik. Deze proxy geeft de api-sports-
# call een vast uitgaand IP. De worker houdt al zijn logica; alleen de uitgang verhuist.
#
# Draaien:  curl -sL https://raw.githubusercontent.com/RobLizet/Toto-AI/main/deploy/hetzner-proxy-setup.sh | bash

set -euo pipefail

DOMEIN="apif.promatchxi.app"
VERWACHT_IP="138.201.189.10"
UPSTREAM="https://v3.football.api-sports.io"

rood()  { printf '\033[31m%s\033[0m\n' "$*"; }
groen() { printf '\033[32m%s\033[0m\n' "$*"; }
kop()   { printf '\n\033[1m== %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { rood "Draai dit als root."; exit 1; }

kop "1/8  Controle: juiste server?"
IP=$(curl -s --max-time 10 https://api.ipify.org || echo "?")
echo "    uitgaand IP: $IP"
if [ "$IP" != "$VERWACHT_IP" ]; then
  rood "    Verwacht $VERWACHT_IP. Dit is een ANDERE server — stoppen."
  exit 1
fi
groen "    OK — dit is de server met het vaste IP."

kop "2/8  Controle: DNS"
# Let's Encrypt heeft dit nodig: $DOMEIN moet naar deze server wijzen.
DNS_IP=$(getent hosts "$DOMEIN" | awk '{print $1}' | head -1 || true)
if [ "$DNS_IP" != "$VERWACHT_IP" ]; then
  rood "    $DOMEIN wijst naar '${DNS_IP:-niets}' i.p.v. $VERWACHT_IP."
  rood "    Zet eerst in Cloudflare DNS:  A  apif  $VERWACHT_IP   (Proxy status: DNS only / grijze wolk)"
  rood "    Grijze wolk is essentieel: met de oranje wolk loopt het verkeer wéér over gedeelde IP's."
  exit 1
fi
groen "    OK — $DOMEIN -> $VERWACHT_IP"

kop "3/8  Rootwachtwoord vervangen"
echo "    Het wachtwoord uit de Hetzner-mail is gedeeld en moet weg. Kies een nieuw:"
passwd root

kop "4/8  Pakketten + Caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg ufw >/dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq caddy >/dev/null
groen "    Caddy $(caddy version | head -1)"

kop "5/8  Geheimen"
echo "    Plak je API-Football key (invoer blijft onzichtbaar):"
read -rs APIF_KEY
echo
[ -n "$APIF_KEY" ] || { rood "    Lege key — stoppen."; exit 1; }

# Sanity: werkt de key vanaf DIT IP? Meteen de kernmeting.
echo "    Key testen vanaf dit IP..."
STATUS_JSON=$(curl -s --max-time 20 -H "x-apisports-key: $APIF_KEY" "$UPSTREAM/status")
if echo "$STATUS_JSON" | grep -q '"token"'; then
  rood "    api-sports weigert deze key. Niets gewijzigd — stoppen."
  exit 1
fi
echo "    api-sports antwoordt: $(echo "$STATUS_JSON" | head -c 200)"

PROXY_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

install -m 700 -d /etc/caddy
cat > /etc/caddy/apif.env <<EOF
APIF_KEY=$APIF_KEY
PROXY_SECRET=$PROXY_SECRET
EOF
chmod 600 /etc/caddy/apif.env
groen "    /etc/caddy/apif.env aangemaakt (chmod 600, alleen root)"

kop "6/8  Caddy-config"
cat > /etc/caddy/Caddyfile <<EOF
{
	email zweetzakken@gmail.com
}

$DOMEIN {
	route {
		# Open voor monitoring — verraadt niets.
		respond /healthz \`{"ok":true}\` 200

		# Alleen de worker mag hierlangs. Geen IP-allowlist: de worker-IP's zijn
		# juist gedeeld, dat is het hele probleem dat we oplossen.
		@geen_secret not header X-Proxy-Secret {\$PROXY_SECRET}
		respond @geen_secret \`{"error":"Unauthorized"}\` 401

		handle_path /v3/* {
			reverse_proxy $UPSTREAM {
				# Getest 17-07: Caddy herschrijft Host NIET vanzelf — zonder deze regel
				# krijgt api-sports de Host van de worker en klopt er niets van.
				header_up Host v3.football.api-sports.io
				header_up x-apisports-key {\$APIF_KEY}
				header_up -X-Proxy-Secret
			}
		}
		respond \`{"error":"Not found"}\` 404
	}
}
EOF

# systemd moet de env-file inlezen, anders zijn {\$APIF_KEY} en {\$PROXY_SECRET} leeg.
install -m 755 -d /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/env.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/apif.env
EOF
systemctl daemon-reload

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  && groen "    Caddyfile geldig" || { rood "    Caddyfile ONGELDIG — stoppen."; exit 1; }

kop "7/8  Firewall + start"
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
groen "    ufw actief (22, 80, 443)"
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
sleep 6

kop "8/8  Verificatie"
HZ=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://$DOMEIN/healthz" || echo "?")
echo "    https://$DOMEIN/healthz            -> HTTP $HZ"
GEEN=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://$DOMEIN/v3/status" || echo "?")
echo "    /v3/status zonder secret           -> HTTP $GEEN  (moet 401 zijn)"
MET=$(curl -s --max-time 25 -H "X-Proxy-Secret: $PROXY_SECRET" "https://$DOMEIN/v3/status")
echo "    /v3/status met secret              -> $(echo "$MET" | head -c 160)"

if [ "$HZ" = "200" ] && [ "$GEEN" = "401" ]; then
  groen "
  ================= KLAAR =================
  Proxy draait op https://$DOMEIN

  Zet deze waarde in Cloudflare > Workers > je worker > Settings > Variables
  als SECRET (niet als plain text), naam:  PROXY_SECRET

      $PROXY_SECRET

  Geef deze waarde NIET door in een chat. Claude heeft hem niet nodig.
  ========================================="
else
  rood "
  Iets klopt niet (healthz=$HZ, zonder-secret=$GEEN).
  Kijk met:  journalctl -u caddy -n 50 --no-pager"
  exit 1
fi
