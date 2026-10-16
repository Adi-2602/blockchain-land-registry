#!/usr/bin/env bash
# Run on the EC2 server (as user ubuntu) after it is launched with:
#   - IAM role LandRegistryEC2Role (S3 + DynamoDB access)
#   - user data that installs Node 22, pm2 and ganache
# Starts: Ganache (persistent chain, localhost only) + Express API on port 5001.
# Safe to re-run: pulls latest code and restarts the API; chain data is kept.
#
# Usage:  bash ec2-setup.sh
set -euo pipefail

S3_BUCKET="${S3_BUCKET:-blockcodem-land-docs-125254}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
BRANCH="${BRANCH:-main}"
REPO=https://github.com/adi-2602/blockchain-land-registry.git
APP="$HOME/blockchain-land-registry"
CHAIN_DIR="$HOME/chaindata"
CHAIN_ID="${CHAIN_ID:-2602}"   # MetaMask ke "Localhost 1337" network se takraav na ho

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

say "1/5 Waiting for server bootstrap (Node, pm2, ganache)"
for _ in $(seq 1 60); do
  [ -f /var/log/land-registry-bootstrap-done ] && break
  sleep 10
done
for bin in node npm pm2 ganache git; do
  command -v $bin >/dev/null || { echo "!! $bin not installed yet. Wait 2 minutes and re-run."; exit 1; }
done
node -v

say "2/5 Getting code (branch $BRANCH)"
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch -q origin "$BRANCH"
  git -C "$APP" checkout -q "$BRANCH"
  git -C "$APP" reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$APP"
fi
cd "$APP/backend"
npm ci --omit=dev --no-audit --no-fund

say "3/5 Writing backend/.env (only the first time)"
ENVF="$APP/backend/.env"
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<EOF
PORT=5001
GANACHE_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
AWS_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
USERS_TABLE=Users
DOCS_TABLE=LandDocuments
EOF
  chmod 600 "$ENVF"
fi
set -a; . "$ENVF"; set +a

say "4/5 Starting Ganache (chain id $CHAIN_ID, data kept in $CHAIN_DIR)"
rpc() {
  curl -s -XPOST localhost:8545 -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).result'
}
# Purana chain process dusre chain id par chal raha ho to usi data ke saath naye id par restart karo
if pm2 describe chain >/dev/null 2>&1 && [ "$(rpc eth_chainId '[]' 2>/dev/null)" != "$(printf '0x%x' "$CHAIN_ID")" ]; then
  echo "switching chain id to $CHAIN_ID (existing land records are kept)"
  pm2 delete chain >/dev/null
fi
if ! pm2 describe chain >/dev/null 2>&1; then
  mkdir -p "$CHAIN_DIR"
  pm2 start "$(command -v ganache)" --name chain -- \
    --server.host 127.0.0.1 --server.port 8545 --chain.chainId "$CHAIN_ID" \
    --database.dbPath "$CHAIN_DIR" --wallet.accounts "$PRIVATE_KEY,1000000000000000000000"
fi
for _ in $(seq 1 30); do
  [ "$(rpc eth_blockNumber '[]' 2>/dev/null)" != "" ] && [ "$(rpc eth_blockNumber '[]' 2>/dev/null)" != "undefined" ] && break
  sleep 2
done

# Deploy contract once; re-deploy only if the saved address has no code (chain was wiped)
CODE="0x"
if [ -n "${CONTRACT_ADDRESS:-}" ]; then
  CODE=$(rpc eth_getCode "[\"$CONTRACT_ADDRESS\",\"latest\"]")
fi
if [ "$CODE" = "0x" ]; then
  ADDR=$(node scripts/deploy-local.js)
  sed -i '/^CONTRACT_ADDRESS=/d' "$ENVF"
  echo "CONTRACT_ADDRESS=$ADDR" >> "$ENVF"
  echo "contract deployed at $ADDR"
else
  echo "contract already deployed at $CONTRACT_ADDRESS"
fi

say "5/5 Starting API on port 5001"
pm2 delete api >/dev/null 2>&1 || true
pm2 start server.js --name api
pm2 save
# auto-start chain + API after a server reboot
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null \
  || echo "(pm2 startup skipped; run it manually if you need auto-start on reboot)"

sleep 3
curl -s localhost:5001/api/health; echo
IP=$(curl -s http://checkip.amazonaws.com || true)
say "DONE. API: http://$IP:5001/api   (health: http://$IP:5001/api/health)"
