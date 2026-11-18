const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('review_management_microservice/reviewController.js', 'utf8');
function response() { return { code: 200, body: null, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } }; }
function handler(connection) {
 connection = {beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},...connection};
 const module = { exports: {} };
 vm.runInNewContext(source, { module, console: { log(){},error(){} }, URL,
  require(name) { if(name==='./db.js') return {getConnection: async()=>connection}; if(name==='./rabbitmq/rpc') return {sendAndReceive:async()=>({instructor_id:9})}; throw Error('Unexpected dependency'); }
 }); return module.exports;
}
function request(role, institution='north') { return {headers:{'x-user-role':role,'x-user-id':'9','x-student-id':'7','x-user-institution':institution,'x-institution-id':institution},body:{review_request_id:42,status:'accepted',course:'math',period:'spring',id:42,reviewId:42}}; }

test('instructor cannot reply to an unassigned review', async()=>{
 let writes=0; const connection={query:async sql=>{if(sql.trim().startsWith('SELECT'))return []; writes++;return {affectedRows:1};},release(){}};
 const res=response(); await handler(connection).replyToReview(request('instructor'),res);
 assert.equal(res.code,403); assert.equal(writes,0);
});

test('student cannot acknowledge another student review when lookup returns an empty array', async()=>{
 let writes=0;const connection={query:async sql=>{if(sql.trim().startsWith('SELECT'))return [];writes++;return {affectedRows:1};},release(){}};
 const res=response();await handler(connection).acknowledgeReply(request('student'),res);
 assert.equal(res.code,403);assert.equal(writes,0);
});

test('student review lookup includes the institution even for a reused student ID',async()=>{
 const connection={query:async(sql,args)=>sql.includes('FROM review_requests')&&args.includes('north')?[]:[{id:42,message:'private-other-institution'}],release(){}};
 const res=response();await handler(connection).getReviewById(request('student'),res);
 assert.equal(res.code,403);
});

test('authorized review read retains its connection through all queries and releases once',async()=>{
 let released=false,releases=0;const connection={query:async()=>{assert.equal(released,false,'query after pool release');return [{id:42,message:'own-review'}];},release(){released=true;releases++;}};
 const res=response();await handler(connection).getReviewById(request('student'),res);
 assert.equal(res.code,200);assert.equal(releases,1);
});

test('authorized acknowledgement requires an existing reply',async()=>{
 let writes=0;const connection={query:async sql=>{if(sql.includes('FROM review_requests'))return [{id:42}];if(sql.includes('FROM review_replies'))return [];writes++;return {};},release(){}};
 const res=response();await handler(connection).acknowledgeReply(request('student'),res);
 assert.equal(res.code,404);assert.equal(writes,0);
});


test('assigned instructor reply commits both writes before releasing',async()=>{
 let released=false,writes=0,commits=0;
 const connection={beginTransaction:async()=>{},commit:async()=>{commits++;assert.equal(writes,2);},rollback:async()=>{throw Error('Unexpected rollback');},query:async sql=>{assert.equal(released,false);if(sql.trim().startsWith('SELECT'))return [{id:42}];writes++;return {affectedRows:1};},release(){released=true;}};
 const res=response();await handler(connection).replyToReview(request('instructor'),res);
 assert.equal(res.code,201);assert.equal(commits,1);assert.equal(released,true);
});

test('reply write failure rolls back before the connection is released',async()=>{
 let rollbacks=0,released=false;
 const connection={beginTransaction:async()=>{},commit:async()=>{throw Error('Unexpected commit');},rollback:async()=>{assert.equal(released,false);rollbacks++;},query:async sql=>{if(sql.trim().startsWith('SELECT'))return [{id:42}];throw Error('Synthetic write failure');},release(){released=true;}};
 const res=response();await handler(connection).replyToReview(request('instructor'),res);
 assert.equal(res.code,500);assert.equal(rollbacks,1);assert.equal(released,true);
});

test('unsupported role cannot read reviews or replies',async()=>{
 let queries=0;const connection={query:async()=>{queries++;return [{id:42}];},release(){}};
 for(const name of ['getReviewById','getReplyByReviewId']){
  const res=response();await handler(connection)[name](request('institution'),res);assert.equal(res.code,403);
 }
 assert.equal(queries,0);
});

test('reply ownership lookup includes the authenticated institution',async()=>{
 let writes=0;const connection={query:async(sql,args)=>{if(sql.trim().startsWith('SELECT'))return args.includes('north')?[]:[{id:42}];writes++;return {};},release(){}};
 const res=response();await handler(connection).replyToReview(request('instructor'),res);assert.equal(res.code,403);assert.equal(writes,0);
});

test('review request keeps the connection until insertion and scopes duplicate lookup',async()=>{
 let released=false,writes=0;const connection={query:async(sql,args)=>{assert.equal(released,false);if(sql.trim().startsWith('SELECT')){assert.ok(args.includes('north'));return [];}writes++;return {insertId:1};},release(){released=true;}};
 const req=request('student');req.body.message='Synthetic review';const res=response();await handler(connection).requestReview(req,res);
 assert.equal(res.code,201);assert.equal(writes,1);assert.equal(released,true);
});


test('rollback failure still releases the connection without an unhandled rejection',async()=>{
 let released=false;
 const connection={beginTransaction:async()=>{},rollback:async()=>{throw Error('Synthetic disconnected rollback');},query:async sql=>{if(sql.trim().startsWith('SELECT'))return [{id:42}];throw Error('Synthetic write failure');},release(){released=true;}};
 const res=response();await handler(connection).replyToReview(request('instructor'),res);
 assert.equal(res.code,500);assert.equal(released,true);
});
