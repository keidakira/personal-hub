// Safe unauthenticated smoke test. This script never sends credentials or changes data.
const endpoint = process.env.MCP_URL ?? 'https://dessztjbtsjqsoytuhme.supabase.co/functions/v1/mcp';
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'},
  body: JSON.stringify({jsonrpc:'2.0', id:1, method:'initialize', params:{protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{name:'smoke-test', version:'0.1'}}}),
});
console.log('Unauthenticated MCP response:', response.status);
console.log('WWW-Authenticate:', response.headers.get('www-authenticate'));
if (response.status !== 401) {
  console.error('Expected the MCP endpoint to reject unauthenticated requests.');
  process.exitCode = 1;
}
const discovery = await fetch(endpoint + '/oauth-protected-resource');
console.log('OAuth resource discovery:', discovery.status);
if (discovery.ok) console.log(JSON.stringify(await discovery.json(), null, 2));
else { console.log((await discovery.text()).slice(0,700)); process.exitCode = 1; }
