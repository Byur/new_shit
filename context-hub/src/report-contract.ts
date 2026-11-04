import {parse} from 'parse5';
import path from 'node:path';
import {dateMs} from './discovery.ts';

type Node = any;
const fields = ['positioning','capabilities','use-cases','trend','limitations'];
const sectionIds = ['report-summary','report-projects','report-synthesis','report-sources'];
const attr = (node: Node, name: string) => node.attrs?.find((a: any) => a.name === name)?.value;
const text = (node: Node): string => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
const clean = (value: string) => value.replace(/\s+/g,' ').trim();
function descendants(node: Node): Node[] { return (node.childNodes ?? []).flatMap((child: Node) => [child,...descendants(child)]); }
function one(nodes: Node[], predicate: (n: Node) => boolean, label: string): Node {
  const found = nodes.filter(predicate);
  if (found.length !== 1) throw new Error(`report contract: expected exactly one ${label}, found ${found.length}`);
  return found[0];
}
function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(`report contract: ${message}`); }
function publicUrl(value: string) {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function links(node: Node) { return descendants(node).filter(n=>n.tagName==='a').map(n=>({url:attr(n,'href')??'',label:clean(text(n))})); }
export function hasReportContract(html: string) { return descendants(parse(html)).some(n=>attr(n,'name')==='report-schema'||attr(n,'data-report')==='ai-trending'); }

export function validateTrendingReport(sourcePath: string, html: string, selection?: any) {
  const errors: string[] = [];
  const tree = parse(html, {onParseError: e => errors.push(e.code)});
  ensure(errors.length === 0, `invalid HTML: ${[...new Set(errors)].join(', ')}`);
  const all = descendants(tree);
  const schema = one(all,n=>n.tagName==='meta'&&attr(n,'name')==='report-schema','report-schema meta');
  ensure(attr(schema,'content')==='ai-trending/1','unsupported report-schema');
  const date = attr(one(all,n=>n.tagName==='meta'&&attr(n,'name')==='report-date','report-date meta'),'content');
  dateMs(date);
  ensure(path.basename(sourcePath)===`ai-trending-${date}.html`,'filename and report-date must agree');
  const title = clean(text(one(all,n=>n.tagName==='title','title')));
  ensure(title.length>0,'title cannot be empty');
  const root = one(all,n=>attr(n,'data-report')==='ai-trending','data-report root');
  const nodes = descendants(root);
  const h1 = one(all,n=>n.tagName==='h1','h1');
  ensure(nodes.includes(h1)&&clean(text(h1)).length>0,'h1 must be inside report');
  ensure(!all.some(n=>['script','iframe','template'].includes(n.tagName)),'report must be static HTML without script/iframe/template');
  const ids = all.map(n=>attr(n,'id')).filter(Boolean);
  ensure(new Set(ids).size===ids.length,'duplicate HTML id');
  const sections = sectionIds.map(id=>one(nodes,n=>n.tagName==='section'&&attr(n,'id')===id,`section#${id}`));
  ensure(sections.every((s,i)=>i===0||nodes.indexOf(s)>nodes.indexOf(sections[i-1])),'report sections must follow summary, projects, synthesis, sources order');
  for (const s of sections) {
    const heading=one(descendants(s),n=>n.tagName==='h2',`${attr(s,'id')} h2`);
    ensure(clean(text(heading)).length>0,'section heading cannot be empty');
  }
  const summaryNode=one(descendants(sections[0]),n=>n.tagName==='p'&&attr(n,'data-field')==='summary','summary paragraph');
  const summary=clean(text(summaryNode));
  ensure(summary.length>0,'summary cannot be empty');
  const cards=nodes.filter(n=>attr(n,'data-project')!==undefined);
  ensure(cards.length<=20,'too many project cards');
  const names=new Set<string>();
  const projects=cards.map(card=>{
    ensure(card.tagName==='article'&&descendants(sections[1]).includes(card),'project must be an article inside report-projects');
    const fullName=attr(card,'data-project');
    ensure(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName),'invalid data-project');
    ensure(!names.has(fullName.toLowerCase()),'duplicate project'); names.add(fullName.toLowerCase());
    ensure(nonemptyId(attr(card,'id')),'project needs a stable id');
    const inner=descendants(card);
    const heading=one(inner,n=>n.tagName==='h3',`${fullName} h3`);
    const repoLink=one(descendants(heading),n=>n.tagName==='a'&&attr(n,'data-role')==='repository',`${fullName} repository link`);
    const url=`https://github.com/${fullName}`;
    ensure(attr(repoLink,'href')?.toLowerCase()===url.toLowerCase(),'repository href must be canonical and match data-project');
    const content: Record<string,string>={};
    const paragraphs=fields.map(field=>{
      const p=one(inner,n=>n.tagName==='p'&&attr(n,'data-field')===field,`${fullName}.${field}`);
      content[field]=clean(text(p));
      const label=one(descendants(p),n=>n.tagName==='strong',`${fullName}.${field} label`);
      ensure(clean(text(label)).length>0&&content[field].length>clean(text(label)).length,`${field} needs a visible label and body`); return p;
    });
    ensure(paragraphs.every((p,i)=>i===0||inner.indexOf(p)>inner.indexOf(paragraphs[i-1])),'project fields must follow the contract order');
    const sources=one(inner,n=>attr(n,'data-field')==='sources',`${fullName}.sources`);
    ensure(['p','ul'].includes(sources.tagName),'sources must be a paragraph or list');
    const evidenceLinks=links(sources);
    ensure(evidenceLinks.length>=2&&evidenceLinks.every(l=>publicUrl(l.url)&&l.label.length>0),'project sources need at least two labelled original-source links');
    const times=descendants(paragraphs[3]).filter(n=>n.tagName==='time');
    const trendDates=times.map(n=>attr(n,'datetime'));
    ensure(trendDates.length>0,'trend paragraph needs visible time datetime evidence');
    times.forEach(n=>ensure(clean(text(n))===attr(n,'datetime')&&dateMs(attr(n,'datetime'))<=dateMs(date),'trend dates must be visible and not future'));
    return {fullName,url,title:clean(text(heading)),fields:content,sources:evidenceLinks};
  });
  if (!cards.length) ensure(descendants(sections[1]).some(n=>attr(n,'data-field')==='empty-state'&&clean(text(n))),'zero projects requires an explicit empty-state');
  const allLinks=links(root);
  ensure(allLinks.every(l=>publicUrl(l.url)&&l.label.length>0),'all report links must be labelled HTTP(S) sources');
  const visible=all.filter(n=>n.nodeName==='#text'&&!['code','pre','style','script'].includes(n.parentNode?.tagName)).map(text).join(' ');
  ensure(!/(^|\s)#\d+\b/u.test(visible),'write ranks as No. N or 第 N 名, not Obsidian inline tags');
  if (selection!==undefined) {
    ensure(selection.algorithmVersion==='discovery-v1'&&selection.asOf===date&&Array.isArray(selection.selected),'selection must be the matching discovery-v1 response');
    ensure(JSON.stringify(projects.map(p=>p.fullName.toLowerCase()))===JSON.stringify(selection.selected.map((p:any)=>p.fullName.toLowerCase())),'project identities/order differ from service selection');
    projects.forEach((p,i)=>{
      const evidence=selection.selected[i].evidence;
      ensure(evidence&&p.sources.some(l=>l.url===evidence.sourceUrl),`${p.fullName} must cite its admitted trend evidence`);
      ensure(p.fields.trend.includes(evidence.evidenceDate),`${p.fullName} must display its trend evidence date`);
    });
  }
  return {schemaVersion:'ai-trending/1',reportDate:date as string,title,hero:clean(text(h1)),summary,projects,links:allLinks};
}
function nonemptyId(value: unknown) { return typeof value==='string'&&/^project-[a-z0-9_-]+$/.test(value); }

// Validate the actual Importer output; data-* markers may be dropped by MarkItDown.
export function validateArchivedMarkdown(markdown: string, report: ReturnType<typeof validateTrendingReport>, sourcePath: string) {
  const fm=markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  ensure(fm,'Markdown frontmatter missing');
  const source=fm[1].match(/^source_file:\s*(.+)$/m)?.[1];
  ensure(source&&JSON.parse(source)===sourcePath,'Markdown source_file mismatch');
  const headings=[...markdown.matchAll(/^###\s+(.+)$/gm)];
  const normalized = (value:string) => value.replace(/[*_`]/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\s+/g,' ');
  let previous=-1;
  for(const p of report.projects) {
    const index=headings.findIndex(h=>h[1].includes(p.url));
    ensure(index>previous,`${p.fullName} Markdown heading/link missing or reordered`); previous=index;
    const start=headings[index].index!+headings[index][0].length;
    const tail=markdown.slice(start), next=tail.search(/^#{1,3}\s+/m);
    const block=next<0?tail:tail.slice(0,next);
    for(const l of p.sources) ensure(block.includes(`](${l.url})`),`${p.fullName} Markdown source link missing`);
    for(const value of Object.values(p.fields)) ensure(normalized(block).includes(normalized(value)),`${p.fullName} Markdown field missing`);
  }
  const body=normalized(markdown.slice(fm[0].length));
  ensure(body.includes(normalized(report.summary)),'Markdown summary missing');
  return {schemaVersion:report.schemaVersion,projectCount:report.projects.length,sourcePath};
}
