#!/usr/bin/env bash
# ============================================================================
# stripe-sync-webhook-events.sh
#
# Ensures the LIVE Stripe webhook endpoint for Marginalia is subscribed to every
# event our handler cares about — adding the two new credit-system events
# (checkout.session.completed, invoice.paid) WITHOUT dropping the subscription
# events it already listens to.
#
# Idempotent: re-running is a no-op once all events are present.
#
# Auth: needs a valid LIVE key. Either
#   - run `stripe login` first (refreshes ~/.config/stripe/config.toml), or
#   - export STRIPE_API_KEY=sk_live_...   (full secret key)
#
# Usage:  bash scripts/stripe-sync-webhook-events.sh [--live|--test]
#         (default --live; --test syncs the test-mode endpoint instead)
# ============================================================================
set -euo pipefail

MODE="${1:---live}"
WEBHOOK_PATH="/api/public/payments/webhook"
SITE_URL="https://self-law.org${WEBHOOK_PATH}"

# Every event our webhook (src/routes/api/public/payments/webhook.ts) handles.
WANT=(
  "customer.subscription.created"
  "customer.subscription.updated"
  "customer.subscription.deleted"
  "checkout.session.completed"
  "invoice.paid"
)

CFG="$HOME/.config/stripe/config.toml"
if [ "$MODE" = "--test" ]; then
  ENV_QS="sandbox"
  KEY="${STRIPE_API_KEY:-$(grep -E '^test_mode_api_key' "$CFG" 2>/dev/null | head -1 | sed -E "s/.*= *'([^']+)'.*/\1/")}"
else
  ENV_QS="live"
  KEY="${STRIPE_API_KEY:-$(grep -E '^live_mode_api_key' "$CFG" 2>/dev/null | head -1 | sed -E "s/.*= *'([^']+)'.*/\1/")}"
fi
[ -n "${KEY:-}" ] || { echo "ERROR: no API key. Run 'stripe login' or export STRIPE_API_KEY." >&2; exit 1; }

ENDPOINT_URL="${SITE_URL}?env=${ENV_QS}"
echo "Mode: $MODE   Endpoint URL: $ENDPOINT_URL"

LIST_JSON="$(stripe webhook_endpoints list --api-key "$KEY" --limit 100 2>&1)" || {
  echo "ERROR listing endpoints:"; echo "$LIST_JSON"; exit 1; }

# Find the endpoint id (and its current events) whose URL matches our webhook path.
MATCH="$(printf '%s' "$LIST_JSON" | python3 - "$WEBHOOK_PATH" "$ENV_QS" <<'PY'
import sys, json
data = json.load(sys.stdin)
path, env = sys.argv[1], sys.argv[2]
best = None
for e in data.get("data", []):
    url = e.get("url", "")
    if path in url:
        # Prefer the one matching this env query string; fall back to any path match.
        if f"env={env}" in url:
            best = e; break
        best = best or e
if best:
    print(best["id"])
    print(",".join(best.get("enabled_events", [])))
PY
)"

EP_ID="$(printf '%s' "$MATCH" | sed -n '1p')"
CUR_EVENTS="$(printf '%s' "$MATCH" | sed -n '2p')"

# Build the -d enabled_events[] args = union(current, WANT).
declare -A seen=()
ARGS=()
add_event() { [ -n "${seen[$1]:-}" ] && return; seen[$1]=1; ARGS+=(-d "enabled_events[]=$1"); }
IFS=',' read -ra _cur <<< "$CUR_EVENTS"
for ev in "${_cur[@]}"; do [ -n "$ev" ] && add_event "$ev"; done
for ev in "${WANT[@]}"; do add_event "$ev"; done

if [ -n "$EP_ID" ]; then
  echo "Found endpoint: $EP_ID"
  echo "Current events: ${CUR_EVENTS:-<none>}"
  echo "Setting union (${#seen[@]} events)…"
  stripe webhook_endpoints update "$EP_ID" --api-key "$KEY" "${ARGS[@]}" >/dev/null
  echo "✔ Updated. Enabled events now:"
  stripe webhook_endpoints retrieve "$EP_ID" --api-key "$KEY" \
    | python3 -c "import sys,json;[print('  -',e) for e in json.load(sys.stdin)['enabled_events']]"
else
  echo "No endpoint found for $WEBHOOK_PATH — creating one with all ${#WANT[@]} events…"
  CREATE_ARGS=(-d "url=$ENDPOINT_URL")
  for ev in "${WANT[@]}"; do CREATE_ARGS+=(-d "enabled_events[]=$ev"); done
  OUT="$(stripe webhook_endpoints create --api-key "$KEY" "${CREATE_ARGS[@]}")"
  echo "$OUT" | python3 -c "import sys,json;d=json.load(sys.stdin);print('✔ Created',d['id']);print('SIGNING SECRET (set in Vercel):',d.get('secret','<only shown once>'))"
  echo
  echo "IMPORTANT: put that signing secret in Vercel as PAYMENTS_${ENV_QS^^}_WEBHOOK_SECRET and redeploy."
fi
