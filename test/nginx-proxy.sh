#!/bin/sh
# Real nginx container against a disposable synthetic API. No deployment credentials.
set -eu
image=${1:-passport-ui:ci}
network="passport-proxy-test-$$"
api_name="passport-proxy-api-$$"
ui_name="passport-proxy-ui-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "$ui_name" "$api_name" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT INT TERM
docker network create "$network" >/dev/null
docker run -d --name "$api_name" --network "$network" --network-alias api node:24-alpine node -e 'require("node:http").createServer((req,res)=>{res.writeHead(401,{"Content-Type":"application/json"});res.end(JSON.stringify({code:"synthetic_unauthorized",path:req.url,host:req.headers.host,method:req.method}));}).listen(3000,"0.0.0.0")' >/dev/null
docker run -d --name "$ui_name" --network "$network" -p 127.0.0.1::8080 "$image" >/dev/null
port=$(docker port "$ui_name" 8080/tcp | awk -F: '{print $NF}')
ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if [ "$(curl --silent -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/v2/discord/config" || true)" = 401 ]; then ready=true; break; fi
  sleep 1
done
[ "$ready" = true ]
for route in /v1/auth/session /v2/discord/config /v2/discord/roles/claim; do
  method=GET
  if [ "$route" = /v2/discord/roles/claim ]; then method=POST; fi
  curl --silent --show-error -X "$method" -D "$work/headers" -o "$work/body" -H 'Host: fixture.example:4180' "http://127.0.0.1:$port$route"
  node --input-type=module - "$work/headers" "$work/body" "$route" "$method" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const [headersPath,bodyPath,route,method]=process.argv.slice(2);
const headers=readFileSync(headersPath,'utf8');
assert.match(headers,/^HTTP\/1\.1 401/m);
assert.match(headers,/Content-Type: application\/json/i);
assert.match(headers,/Cache-Control: no-store/i);
assert.match(headers,/Referrer-Policy: no-referrer/i);
assert.match(headers,/Content-Security-Policy:.*frame-ancestors 'none'/i);
assert.deepEqual(JSON.parse(readFileSync(bodyPath,'utf8')),{code:'synthetic_unauthorized',path:route,host:'fixture.example:4180',method});
JS
done
curl --silent --fail "http://127.0.0.1:$port/discord/link/synthetic" -o "$work/spa"
node --input-type=module - "$work/spa" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
assert.match(readFileSync(process.argv[2],'utf8'),/<div id="root"><\/div>/);
JS
printf '%s\n' 'nginx /v1 + /v2 proxy, Host, headers and SPA: PASS'
