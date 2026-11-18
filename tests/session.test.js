const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'synthetic-session-key-'.repeat(4);
process.env.INTERNAL_GATEWAY_TOKEN = 'synthetic-internal-key-'.repeat(4);
const jwt = require('../api_gateway/node_modules/jsonwebtoken');
const { createVerifySession } = require('../api_gateway/session');

function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function request() {
  const token = jwt.sign({id: 9, role: 'student', institution: 'north'}, process.env.JWT_SECRET, {expiresIn: '1h'});
  return {header: () => token};
}

test('gateway accepts a signed session only after the user service confirms it', async () => {
  const req = request(); const res = response(); let next = false;
  await createVerifySession({fetchImpl: async (url, options) => {
    assert.equal(url, 'http://users-service:3000/api/session');
    assert.equal(options.headers['X-Internal-Gateway-Token'], process.env.INTERNAL_GATEWAY_TOKEN);
    assert.equal(options.redirect, 'error');
    return {status: 200, json: async () => ({valid: true})};
  }})(req, res, () => {next = true;});
  assert.equal(next, true); assert.equal(req.user.institution, 'north');
});

test('gateway rejects a user-service-revoked signed session', async () => {
  const res = response(); let next = false;
  await createVerifySession({fetchImpl: async () => ({status: 401})})(request(), res, () => {next = true;});
  assert.equal(res.code, 401); assert.equal(next, false);
});

test('gateway fails closed on unavailable or malformed revocation checks', async () => {
  for (const fetchImpl of [async () => {throw Error('offline');}, async () => ({status: 503}), async () => ({status: 200, json: async () => ({valid: false})})]) {
    const res = response(); let next = false;
    await createVerifySession({fetchImpl})(request(), res, () => {next = true;});
    assert.equal(res.code, 503); assert.equal(next, false);
  }
});

test('gateway rejects an invalid signature before contacting the user service', async () => {
  const res = response(); let contacted = false;
  await createVerifySession({fetchImpl: async () => {contacted = true;}})({header: () => 'invalid'}, res, () => {});
  assert.equal(res.code, 401); assert.equal(contacted, false);
});


test('review proxy strips caller claims and forwards the verified institution', async () => {
 const fs=await import('node:fs');const vm=await import('node:vm');const middlewares=[];const routes=new Map();
 const app={use(...args){if(typeof args[0]==='string')routes.set(args[0],args.at(-1).options);else middlewares.push(args[0]);}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('api_gateway/index.js','utf8'),{module,console,process,require(name){
  if(name==='express')return ()=>app;
  if(name==='cors')return ()=>()=>{};
  if(name==='dotenv')return {config(){}};
  if(name==='./session')return {createVerifySession:()=>()=>{}};
  if(name==='../shared/security')return {gatewayToken:'synthetic-gateway'};
  if(name==='http-proxy-middleware')return {createProxyMiddleware(options){const fn=()=>{};fn.options=options;return fn;}};
  throw Error('Unexpected dependency');
 }});
 const req={headers:{'x-user-institution':'forged','x-user-role':'institution','x-student-id':'other'},user:{id:9,role:'instructor',institution:'north'}};
 middlewares[1](req,{},()=>{});assert.equal(Object.keys(req.headers).length,0);
 const headers={};routes.get('/reviews/reply').onProxyReq({setHeader:(key,value)=>{headers[key]=value;}},req,{});
 assert.equal(headers['x-user-institution'],'north');assert.equal(headers['x-user-role'],'instructor');assert.equal(headers['x-user-id'],9);
});
