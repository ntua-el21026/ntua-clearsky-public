const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const jwt = require('../user_management_microservice/node_modules/jsonwebtoken');
process.env.JWT_SECRET = 'offline-test-jwt-key-'.repeat(4);
process.env.INTERNAL_GATEWAY_TOKEN = 'offline-gateway-test-'.repeat(4);
let connectionFactory;
const db = require.resolve('../user_management_microservice/db');
require.cache[db] = { id: db, filename: db, loaded: true,
 exports: { getConnection: () => connectionFactory() } };
const auth = require('../user_management_microservice/authController');
function response() { return { code: 200, body: null, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; } }; }
function institutionRequest(body) { return { body, header: () => jwt.sign({ id: 1, role: 'institution', institution: 'offline-demo' }, process.env.JWT_SECRET) }; }

test('user service startup rejects absent JWT secret', () => {
 const env = { ...process.env }; delete env.JWT_SECRET;
 const result = spawnSync(process.execPath, ['-e', "const db = require.resolve('./user_management_microservice/db'); require.cache[db] = { exports: {} }; require('./user_management_microservice/authController')"], { env, timeout: 2000, encoding: 'utf8' });
 assert.notEqual(result.status, 0);
 assert.match(result.stderr, /JWT_SECRET/);
});

test('registered passwords use salted scrypt', async () => {
 const writes = [];
 connectionFactory = async () => ({ query: async () => [], execute: async (sql,args) => { writes.push(args); return {}; }, release() {} });
 const res = response();
 await auth.register(institutionRequest({ username:'demo',password:'test-password',role:'instructor' }),res);
 assert.equal(res.code,200);
 assert.match(writes[0][1], /^scrypt\$16384\$8\$1\$/);
});

test('verified legacy login migrates hash', async () => {
 const digest = crypto.createHash('sha256').update('test-password').digest('hex');
 const writes=[];
 connectionFactory = async () => ({ execute: async (sql,args) => {
   if(sql.startsWith('SELECT')) return [{ id: 7,username:'demo',password_hash:digest,user_role:'instructor',institution:'offline-demo' }];
   writes.push(args);return {affectedRows:1};
 }, release() {} });
 const res=response();
 await auth.login({body:{username:'demo',password:'test-password'}},res);
 assert.equal(res.code,200);assert.equal(writes.length,1);assert.match(writes[0][0],/^scrypt\$/);
});

test('password change scopes writes to requester institution', async () => {
 const statements=[];
 connectionFactory=async()=>({query:async(sql,args)=>{statements.push({sql,args});return sql.startsWith('SELECT')?[{id:7}]:{affectedRows:1};},release(){}});
 const res=response();
 await auth.updatePassword(institutionRequest({username:'demo',password:'test-password',role:'instructor'}),res);
 assert.equal(res.code,200);
 const update=statements.find(s=>s.sql.startsWith('UPDATE'));
 assert.match(update.sql,/institution\s*=\s*\?/);
 assert.ok(update.args.includes('offline-demo'));
});

test('internal services reject forged identity headers without gateway authentication', () => {
 const fs=require('node:fs');const path=require('node:path');
 const location=path.join(__dirname,'../shared/security.js');
 assert.ok(fs.existsSync(location),'internal gateway authentication boundary must exist');
 const { trustedGateway }=require(location);
 let next=false;const res=response();
 trustedGateway({header:()=>undefined,headers:{'x-user-role':'institution'}},res,()=>{next=true;});
 assert.equal(next,false);assert.equal(res.code,401);
});

test('only frontend and gateway publish loopback ports', () => {
 const fs=require('node:fs');const source=fs.readFileSync('docker-compose.yml','utf8');
 const sections=[...source.matchAll(/^  ([a-z][a-z-]*):\n([\s\S]*?)(?=^  [a-z][a-z-]*:|^volumes:|$(?![\s\S]))/gm)];
 assert.ok(sections.length>=9);
 for(const [,name,body] of sections) {
   if(['frontend','api-gateway'].includes(name)) assert.ok(/127\.0\.0\.1:/.test(body), `${name} must bind loopback`);
   else assert.ok(!/^    ports:/m.test(body),`${name} must remain internal`);
 }
});


test('authenticated internal gateway request reaches the next handler', () => {
 const { trustedGateway }=require('../shared/security');
 const res=response();let called=false;
 trustedGateway({header:()=>process.env.INTERNAL_GATEWAY_TOKEN},res,()=>{called=true;});
 assert.equal(called,true);
});

test('every service installs caller authentication before request parsing', () => {
 const fs=require('node:fs');
 for(const service of ['user_management_microservice','grades_management_microservice','review_management_microservice']) {
   const source=fs.readFileSync(`${service}/server.js`,'utf8');
   const auth=source.indexOf('app.use(trustedGateway)');
   const parsing=source.indexOf('app.use(express.json())');
   assert.ok(auth>=0 && auth<parsing,`${service} must authenticate before handlers`);
 }
});


test('user service rejects a blacklisted session and releases the connection', async () => {
 let released=false;connectionFactory=async()=>({execute:async()=>[{token:'synthetic-record'}],release(){released=true;}});
 const res=response();await auth.validateSession(institutionRequest({}),res);
 assert.equal(res.code,401);assert.equal(released,true);
});

test('user service confirms only an unrevoked signed session', async () => {
 connectionFactory=async()=>({execute:async()=>[],release(){}});
 const res=response();await auth.validateSession(institutionRequest({}),res);assert.equal(res.code,200);assert.deepEqual(res.body,{valid:true});
});

test('user service session checks fail closed when the database is unavailable', async () => {
 connectionFactory=async()=>{throw Error('Synthetic unavailable database');};
 const res=response();await auth.validateSession(institutionRequest({}),res);assert.equal(res.code,503);
});
