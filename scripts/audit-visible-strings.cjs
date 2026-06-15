const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src');
const ignoreParts = new Set(['i18n', 'locales', '__tests__']);
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!ignoreParts.has(ent.name)) walk(p);
    } else if (/\.(tsx|ts)$/.test(ent.name)) files.push(p);
  }
}
walk(root);

const allowedProps = new Set(['className', 'type', 'value', 'key', 'id', 'name', 'htmlFor', 'href', 'to', 'variant', 'size', 'role', 'method', 'target', 'rel', 'viewBox', 'fill', 'stroke', 'strokeLinecap', 'strokeLinejoin', 'strokeWidth', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'xmlns']);
const visibleProps = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label']);
const internalWords = /^(GET|POST|PATCH|DELETE|PUT|task|item|human|agent|owner|admin|member|active|blocked|pending_approval|low|medium|high|urgent|none|auto|manual|light|dark|system|en|nl|fr|main|dev|true|false|button|submit|reset|checkbox|radio|dialog|status|alert)$/;
const visibleWord = /[A-Za-zÀ-ÿ]/;
const likelyVisible = /\s|[.!?…:]|^(Generate|Share|Copy|Delete|Edit|Save|Cancel|Create|Add|Remove|Select|Search|Settings|Tasks|Member|Invite|Code|Close|Loading|Failed|Error|No|New|Done|Today|Inbox|Boodschap|Uitnodig|Genereer|Kopieer|Verwijder|Delen|Sluiten|Opslaan|Annuleer)\b/i;
function clean(s){return s.replace(/\s+/g,' ').trim();}
function skip(s){
  if (!s || !visibleWord.test(s)) return true;
  if (internalWords.test(s)) return true;
  if (/^[a-z0-9_-]+$/.test(s)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  if (/^(https?:|\/api\/|\.\/|\.\.\/|#|[A-Z_]+$)/.test(s)) return true;
  if (/[{}<>]/.test(s)) return true;
  if (/\b(bg|text|flex|grid|rounded|border|hover|focus|disabled|absolute|relative|fixed|w-|h-|px-|py-|gap-|space-y|items-|justify-)\b/.test(s)) return true;
  return false;
}
function loc(sf,node){const p=sf.getLineAndCharacterOfPosition(node.getStart(sf)); return `${path.relative(process.cwd(), sf.fileName)}:${p.line+1}:${p.character+1}`}
const hits=[];
for (const file of files) {
  const source=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node){
    if (ts.isJsxText(node)) {
      const s=clean(node.getText(sf));
      if (!skip(s) && likelyVisible.test(s)) hits.push({loc:loc(sf,node), kind:'jsx-text', text:s});
    }
    if (ts.isJsxAttribute(node)) {
      const prop=node.name.getText(sf);
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        const s=clean(node.initializer.text);
        if ((visibleProps.has(prop) || !allowedProps.has(prop)) && !skip(s) && likelyVisible.test(s)) hits.push({loc:loc(sf,node), kind:`attr:${prop}`, text:s});
      }
    }
    if (ts.isJsxExpression(node) && node.expression) {
      const e=node.expression;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
        const s=clean(e.text);
        if (!skip(s) && likelyVisible.test(s)) hits.push({loc:loc(sf,e), kind:'jsx-expression-string', text:s});
      }
      if (ts.isConditionalExpression(e)) {
        for (const arm of [e.whenTrue,e.whenFalse]) {
          if (ts.isStringLiteral(arm) || ts.isNoSubstitutionTemplateLiteral(arm)) {
            const s=clean(arm.text);
            if (!skip(s) && likelyVisible.test(s)) hits.push({loc:loc(sf,arm), kind:'jsx-conditional-string', text:s});
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name=node.name.getText(sf);
      if (/shareData|fallbackText|message|title|text|label/i.test(name)) {
        const e=node.initializer;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) {
          const s=clean(e.getText(sf).slice(0,160));
          if (!skip(s) && likelyVisible.test(s)) hits.push({loc:loc(sf,e), kind:`var:${name}`, text:s});
        }
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
}
for (const h of hits) console.log(`${h.loc} [${h.kind}] ${h.text}`);
console.error(`visible-string-hits=${hits.length}`);
process.exit(hits.length ? 1 : 0);
