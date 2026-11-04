import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDiscoveries} from '../src/discovery.ts';
import {attentionWindow, searchRepositories} from '../src/github-cli.ts';
import {handleGithubMcpRequest} from '../src/github-mcp.ts';
import {discoveryFixture} from './fixtures/discovery.ts';

test('small rising project and ecosystem recognition pass; old size and unknown trend cannot substitute',()=>{
 const x=discoveryFixture(),r=selectDiscoveries(x);
 assert.deepEqual(r.selected.map(p=>p.fullName),['acme/small','acme/plugin']);
 assert.equal(r.shortfall,3);
 assert.equal(r.excluded.length,2);
 assert.ok(r.excluded.find(p=>p.fullName==='acme/established')?.filterReasons.includes('positive_complete_attention_required'));
 assert.equal(r.selected[0].evidence?.claim,'observed_new_attention');
});
test('same observations select identically regardless of input enumeration',()=>{
 const x=discoveryFixture(),a=selectDiscoveries(x);
 x.items.reverse();x.scopes.reverse();x.scopes.forEach(s=>s.members.reverse());
 assert.deepEqual(selectDiscoveries(x).selected,a.selected);
});
test('unreviewed fields and omitted scope members cannot silently pass',()=>{
 const x=discoveryFixture();x.items[0].verifiedFields=[];
 assert.throws(()=>selectDiscoveries(x),/unverified/);
 const y=discoveryFixture();y.items.pop();assert.throws(()=>selectDiscoveries(y),/complete declared scope/);
});
test('partial, future, stale, and self-declared recognition evidence is excluded',()=>{
 for(const change of [t=>t.coverageComplete=false,t=>t.checkedOn='2026-10-17',t=>t.checkedOn='2026-10-01',t=>t.windowEnd='2026-10-17']){
  const x=discoveryFixture();change(x.items[0].trend);assert.ok(!selectDiscoveries(x).selected.some(p=>p.fullName==='acme/small'));
 }
 const x=discoveryFixture();x.items[3].trend.independentOfProject=false;assert.ok(!selectDiscoveries(x).selected.some(p=>p.fullName==='acme/plugin'));
});
test('baseline must be complete, adjacent and equally long; absolute increment precedes percentage',()=>{
 const x=discoveryFixture();
 x.items[0].trend.baseline={windowStart:'2026-10-02',windowEnd:'2026-10-08',added:100,coverageComplete:true,sourceUrl:'https://example.org/baseline'};
 assert.equal(selectDiscoveries(x).selected[0].evidence?.acceleration,20);
 x.items[1].trend={...x.items[0].trend,added:3,baseline:{...x.items[0].trend.baseline,added:1}};
 assert.equal(selectDiscoveries(x).selected[0].fullName,'acme/small');
 x.items[0].trend.baseline.windowEnd='2026-10-07';
 assert.ok(selectDiscoveries(x).excluded.find(p=>p.fullName==='acme/small')?.filterReasons.includes('baseline_must_be_adjacent_equal_window'));
});
test('dedup cannot be evaded by another source or casing, and does not change local position',()=>{
 const x=discoveryFixture();x.items[1].trend.added=200;x.items[1].dedupEligible=false;
 const r=selectDiscoveries(x);assert.equal(r.selected.find(p=>p.fullName==='acme/small')?.localPosition,2);
 const s={...x.scopes[0],id:'second'};x.scopes.push(s);x.items.push(...x.items.slice(0,3).map(p=>({...p,fullName:p.fullName.toUpperCase(),scopeId:'second'})));
 assert.equal(selectDiscoveries(x).selected.filter(p=>p.fullName.toLowerCase()==='acme/small').length,1);
 x.items.at(-2).dedupEligible=true;assert.throws(()=>selectDiscoveries(x),/conflicting/);
});
test('selection prefers different ecosystems, then fills remaining slots without hard diversity exclusion',()=>{
 const x=discoveryFixture();x.items[1].trend.added=80;
 const r=selectDiscoveries(x);assert.deepEqual(r.selected.map(p=>p.fullName),['acme/small','acme/plugin','acme/established']);
});
test('empty discovery is a valid shortfall and invalid calendar dates fail',()=>{
 assert.equal(selectDiscoveries({asOf:'2026-10-16',scopes:[],items:[]}).shortfall,5);
 assert.throws(()=>selectDiscoveries({...discoveryFixture(),asOf:'2026-02-30'}),/calendar/);
});
test('MCP exposes the discovery contract and executes it',async()=>{
 const r=await handleGithubMcpRequest({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'github_select_discoveries',arguments:discoveryFixture()}});
 assert.equal(JSON.parse(r.result.content[0].text).selected.length,2);
});
test('bounded search is encoded as one read-only API path and discloses truncation',async()=>{
 const run=async(args)=>{assert.equal(args[0],'api');assert.match(args.at(-1),/^search\/repositories\?q=topic%3Aeditor/);return {stdout:JSON.stringify({total_count:100,incomplete_results:false,items:[]}),stderr:''};};
 const r=await searchRepositories('topic:editor',30,'updated',run);assert.equal(r.complete,false);assert.equal(r.totalCount,100);
});
test('window aggregation requires unique complete daily buckets and never invents a baseline',async()=>{
 const run=async()=>({stdout:JSON.stringify([{week:Date.parse('2026-10-09')/1000,days:[1,2,3,4,5,6,7]}]),stderr:''});
 const r=await attentionWindow('acme','tool','2026-10-09','2026-10-15',run);
 assert.equal(r.added,28);assert.equal(r.coverageComplete,true);assert.equal(r.baselineCoverageComplete,false);assert.equal(r.baseline,undefined);
 const incomplete=await attentionWindow('acme','tool','2026-10-08','2026-10-15',run);assert.equal(incomplete.coverageComplete,false);
 const duplicate=async()=>({stdout:JSON.stringify([{week:Date.parse('2026-10-09')/1000,days:[1]},{week:Date.parse('2026-10-09')/1000,days:[1]}]),stderr:''});
 await assert.rejects(attentionWindow('acme','tool','2026-10-09','2026-10-15',duplicate),/overlapping/);
});
