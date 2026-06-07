#!/usr/bin/env bash
set -euo pipefail

cd /home/dldnjsrk/6.3지방선거/집회누리집

export PATH="/home/dldnjsrk/.config/nvm/versions/node/v22.21.1/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games:/snap/bin"

SERVICE_ROLE_KEY="$(
  supabase projects api-keys --project-ref qmdknxbuvftwqmfxtkch --output json 2>/dev/null |
    node -e '
      let input = "";
      process.stdin.on("data", (chunk) => input += chunk);
      process.stdin.on("end", () => {
        const keys = JSON.parse(input);
        const row = keys.find((key) => key.name === "service_role" || key.id === "service_role");
        if (!row) process.exit(1);
        process.stdout.write(row.api_key);
      });
    '
)"

SUPABASE_URL="https://qmdknxbuvftwqmfxtkch.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
npm run ingest -- --limit=10
