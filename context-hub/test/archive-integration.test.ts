import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm, realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {selectDiscoveries} from '../src/discovery.ts';
import {validateTrendingReport,validateArchivedMarkdown} from '../src/report-contract.ts';
import {discoveryFixture,reportFixture} from './fixtures/discovery.ts';

// Opt-in host integration: run with the exact Python, CLI and before Hook used by the automation.
// It writes only to an isolated temporary vault, and removes every generated artifact.
test('real MarkItDown CLI and configured rank Hook preserve the report contract', {skip:process.env.CONTEXT_HUB_ARCHIVE_INTEGRATION!=='1'},async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'context-hub-archive-')));
 try {
  const vault=path.join(root,'vault'), plugin=path.join(vault,'.obsidian/plugins/markitdown-importer');
  await mkdir(plugin,{recursive:true});
  const config=JSON.parse(await readFile('/Users/byur/Documents/Obsidian Vault/.obsidian/plugins/markitdown-importer/data.json','utf8'));
  assert.match(config.hooksText,/normalize_obsidian_inline_ranks.py/);
  await writeFile(path.join(plugin,'data.json'),JSON.stringify({hooksText:config.hooksText}));
  const selected=selectDiscoveries(discoveryFixture());
  const source=path.join(root,'ai-trending-2026-10-16.html');
  // Include Unicode, inline code, source fragments and inherited CSS to exercise conversion.
  const html=reportFixture(selected).replace('<head>','<head><style>.exhibit {display:grid}</style>').replace('示例输入和输出可复现。','示例 <code>npm run start</code> 与输出可复现。');
  await writeFile(source,html);
  const report=validateTrendingReport(source,html,selected);
  const before=createHash('sha256').update(await readFile(source)).digest('hex');
  const output=execFileSync('/Users/byur/Documents/Obsidian Vault/.venv/bin/python',['/Volumes/Project/markitdown-obsidian-importer/cli.py',source,'--vault',vault,'--dest','项目卷/AI Trending','--json'],{encoding:'utf8',timeout:120000});
  const result=JSON.parse(output).results;
  assert.equal(result.length,1);assert.equal(result[0].ok,true);
  const expected=path.join(vault,'项目卷/AI Trending/ai-trending-2026-10-16.md');
  assert.equal(result[0].output,expected);
  assert.equal(validateArchivedMarkdown(await readFile(expected,'utf8'),report,source).projectCount,2);
  assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'),before);
 } finally { await rm(root,{recursive:true,force:true}); }
});
