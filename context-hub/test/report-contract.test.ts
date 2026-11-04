import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrendingReport,validateArchivedMarkdown} from '../src/report-contract.ts';
import {parseHtmlReport} from '../src/lib.ts';
import {selectDiscoveries} from '../src/discovery.ts';
import {discoveryFixture,reportFixture} from './fixtures/discovery.ts';
const file='/tmp/ai-trending-2026-10-16.html';
const selection=selectDiscoveries(discoveryFixture());
const html=reportFixture(selection);
test('versioned report extracts projects, summary and canonical links independent of CSS',()=>{
 const r=validateTrendingReport(file,html,selection);assert.equal(r.projects.length,2);
 assert.equal(parseHtmlReport(file,html).summary,r.summary);
 assert.equal(validateTrendingReport(file,html.replace('<head>','<head><style>.exhibit {color: red}</style>'),selection).projects.length,2);
});
test('missing fields, duplicate cards, date drift, and selection drift stop archival',()=>{
 assert.throws(()=>validateTrendingReport(file,html.replace('data-field="limitations"','data-field="other"')),/limitations/);
 assert.throws(()=>validateTrendingReport('/tmp/ai-trending-2026-10-17.html',html),/filename/);
 assert.throws(()=>validateTrendingReport(file,html,{...selection,selected:[...selection.selected].reverse()}),/identities\/order/);
 assert.throws(()=>validateTrendingReport(file,html.replace('data-project="acme/plugin"','data-project="acme/small"')),/duplicate project/);
 assert.throws(()=>validateTrendingReport(file,html.replace('https://example.org/dated-star-observations','https://example.org/other'),selection),/admitted trend/);
});
test('empty reports are explicit, legacy reports remain readable, malformed HTML fails closed',()=>{
 const empty=selectDiscoveries({asOf:'2026-10-16',scopes:[],items:[]});assert.equal(validateTrendingReport(file,reportFixture(empty),empty).projects.length,0);
 assert.equal(parseHtmlReport(file,'<h1>Legacy</h1><p>body</p>').hero,'Legacy');
 assert.throws(()=>validateTrendingReport(file,html.replace('<meta charset="utf-8">','<meta charset="utf-8" charset="utf-8">')),/invalid HTML/);
});
test('ranking hash cannot leak into archive prose; code anchors are preserved',()=>{
 assert.throws(()=>validateTrendingReport(file,html.replace('面向具体工作流','排名 #1 面向具体工作流')),/inline tags/);
 assert.equal(validateTrendingReport(file,html.replace('面向具体工作流','<code>#1</code> 面向具体工作流')).projects.length,2);
});
test('Markdown validation catches lost text or sources',()=>{
 const r=validateTrendingReport(file,html);
 const md=`---\nsource_file: ${JSON.stringify(file)}\n---\n${r.summary}\n`+r.projects.map(p=>`### [${p.title}](${p.url})\n${Object.values(p.fields).join('\n')}\n${p.sources.map(l=>`[${l.label}](${l.url})`).join('\n')}`).join('\n');
 assert.equal(validateArchivedMarkdown(md,r,file).projectCount,2);
 assert.throws(()=>validateArchivedMarkdown(md.replace('实际部署还需验证。',''),r,file),/field missing/);
 assert.throws(()=>validateArchivedMarkdown(md.replace(r.projects[0].sources[0].url,'https://example.org/lost'),r,file),/source link missing/);
});
