const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// Visible-string auditor (GH#96)
// Walks the TSX/TS AST and flags hardcoded user-visible text that should be
// routed through the i18n t() helper instead of being written as literal.
//
// Blind spots fixed vs the original:
//  1. Object-literal property values (label: 'Geblokkeerd', badgeLabel: 'TAKEN')
//     are visited when the key looks user-visible.
//  2. Capitalised/all-caps single words (Zichtbaarheid, TAKEN) count as visible.
//  3. Template literals with ${} substitutions are inspected via their static
//     parts instead of being blanked by a naive [{}<>] filter.
//  4. A `// i18n-ignore` comment on the same line or the line directly above a
//     candidate suppresses it (intentional/non-translatable strings).
//
// Exit code: 0 when no hits, 1 when hits are found (CI gate).

const rootArg = process.argv[2];
const root = rootArg ? path.resolve(rootArg) : path.join(process.cwd(), 'src');
const ignoreParts = new Set(['i18n', 'locales', '__tests__']);
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!ignoreParts.has(ent.name)) walk(p);
    } else if (/\.(tsx|ts)$/.test(ent.name)) files.push(p);
  }
}
walk(root);

// Non-visible HTML/JSX props (skip subtrees entirely)
const allowedProps = new Set([
  'className', 'type', 'value', 'key', 'id', 'name', 'htmlFor', 'href', 'to',
  'variant', 'size', 'role', 'method', 'target', 'rel', 'accept', 'viewBox',
  'fill', 'stroke', 'strokeLinecap', 'strokeLinejoin', 'strokeWidth', 'd',
  'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'xmlns', 'encoding',
  'download', 'form', 'formAction', 'formMethod', 'inputMode', 'max',
  'maxLength', 'min', 'multiple', 'pattern', 'src', 'srcSet', 'step', 'cols',
  'rows', 'span', 'colSpan', 'rowSpan', 'headers', 'scope', 'start', 'open',
  'defaultChecked', 'defaultValue', 'content', 'httpEquiv', 'media', 'sizes',
  'crossOrigin', 'referrerPolicy', 'loading', 'decoding', 'draggable',
  'spellCheck', 'translate', 'suppressHydrationWarning',
  'suppressContentEditableWarning',
]);
const visibleProps = new Set([
  'title', 'placeholder', 'aria-label', 'alt', 'label', 'badgeLabel',
  'description', 'text', 'message', 'heading', 'tooltip', 'confirmLabel',
  'cancelLabel', 'emptyText', 'hint', 'errorMessage', 'successMessage',
  'subtitle', 'accessibilityLabel', 'accessibilityHint',
]);
const internalWords = /^(GET|POST|PATCH|DELETE|PUT|task|item|human|agent|owner|admin|member|active|blocked|pending_approval|low|medium|high|urgent|none|auto|manual|light|dark|system|en|nl|fr|main|dev|true|false|button|submit|reset|checkbox|radio|dialog|status|alert)$/;
const visibleWord = /[A-Za-zÀ-ÿ]/;
const likelyVisible = /\s|[.!?…:]|^(Generate|Share|Copy|Delete|Edit|Save|Cancel|Create|Add|Remove|Select|Search|Settings|Tasks|Member|Invite|Code|Close|Loading|Failed|Error|No|New|Done|Today|Inbox|Boodschap|Uitnodig|Genereer|Kopieer|Verwijder|Delen|Sluiten|Opslaan|Annuleer)\b/i;
// Capitalised single word (Zichtbaarheid, Geblokkeerd) or ALL-CAPS prose (TAKEN, FOCUS)
const singleWordVisible = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]*$/;
const allCapsVisible = /^[A-ZÀ-Ý]{2,}$/;
// Standalone count/status suffixes that only make sense next to a number or
// dynamic value ('+{n} more', '{n} deleted'). They must be routed through i18n
// keys with {n} interpolation, never written as English literals.
const COUNT_SUFFIX_WORDS = new Set([
  'more', 'deleted', 'added', 'removed', 'updated', 'created',
  'items', 'tasks', 'members', 'subtasks', 'groceries', 'notes',
]);

function clean(s) { return s.replace(/\s+/g, ' ').trim(); }

function isVisibleText(s) {
  if (!s || !visibleWord.test(s)) return false;
  return likelyVisible.test(s) || singleWordVisible.test(s) || allCapsVisible.test(s);
}

function skip(s) {
  if (!s || !visibleWord.test(s)) return true;
  if (internalWords.test(s)) return true;
  if (/^[a-z0-9_-]+$/.test(s)) return true;
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(s)) return true; // i18n key paths (tasks.priorityLow)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  if (/^\d[\d.,:\s]*$/.test(s)) return true; // numbers / durations
  if (/^(https?:|\/api\/|\.\/|\.\.\/|#)/.test(s)) return true;
  if (/[<>]/.test(s)) return true; // markup-ish
  if (/^[A-Z][A-Z0-9_]*[_0-9][A-Z0-9_]*$/.test(s)) return true; // constants: API_URL, NODE_ENV, VITE_FOO
  if (/^[^\p{L}\p{N}]+$/u.test(s)) return true; // pure symbols: ×, •, —, … (Unicode-aware)
  // CSS utility chains (all-lowercase tokens only, e.g. 'items-center gap-2',
  // 'text-[11px] font-medium', 'hover:bg-red-50'). A capitalised multi-word
  // string like 'Remove focus' is user-visible text, not a className, even
  // when it contains a utility word (focus).
  if (/^[a-z0-9_\-\[\].:%#]+(\s+[a-z0-9_\-\[\].:%#]+)*$/.test(s) && /\b(bg|text|flex|grid|rounded|border|hover|focus|disabled|absolute|relative|fixed|w-|h-|px-|py-|gap-|space-y|items-|justify-)\b/.test(s)) return true;
  return false;
}

function staticTextOfTemplate(node) {
  let out = node.head ? node.head.text : '';
  if (node.templateSpans) for (const span of node.templateSpans) out += span.literal ? span.literal.text : '';
  return out;
}

function hasExpressionSibling(node) {
  const parent = node.parent;
  if (!parent || !parent.children) return false;
  return parent.children.some((c) => c !== node && ts.isJsxExpression(c));
}

// A template/JSX fragment whose static parts reduce to a bare count suffix
// (e.g. '+{n} more', '{n} deleted') — English-only unless localized.
function countSuffixOf(text) {
  if (/[/?#=&]/.test(text)) return null; // URL/path fragments are not count suffixes
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return normalized && COUNT_SUFFIX_WORDS.has(normalized) ? normalized : null;
}

function loc(sf, node) {
  const p = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${path.relative(process.cwd(), sf.fileName)}:${p.line + 1}:${p.character + 1}`;
}

const hits = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function hasIgnoreComment(node) {
    const pos = node.getStart(sf);
    const line = sf.getLineAndCharacterOfPosition(pos).line;
    const from = sf.getPositionOfLineAndCharacter(Math.max(0, line - 1), 0);
    const seg = source.slice(from, pos);
    return /i18n-ignore/.test(seg);
  }

  function consider(kind, node, text) {
    const s = clean(text);
    if (!skip(s) && isVisibleText(s) && !hasIgnoreComment(node)) hits.push({ loc: loc(sf, node), kind, text: s });
  }

  function insideNonVisibleAttr(node) {
    let n = node;
    while (n) {
      if (ts.isJsxAttribute(n) && n.name) {
        const p = n.name.getText(sf);
        if (p.startsWith('data-') || allowedProps.has(p)) return true;
        if (visibleProps.has(p)) return false;
      }
      n = n.parent;
    }
    return false;
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      consider('jsx-text', node, node.getText(sf));
      // '+{n} more' / '{n} deleted' — JSX splits these into text fragments
      // around an expression; the Bare suffix alone is invisible to the
      // single-word rules because it is lowercase.
      const text = clean(node.getText(sf));
      if (countSuffixOf(text) && hasExpressionSibling(node) && !hasIgnoreComment(node)) {
        hits.push({ loc: loc(sf, node), kind: 'jsx-fragment-suffix', text });
      }
    }
    // Template literals with substitutions whose static parts reduce to a bare
    // count/status suffix ('{n} deleted', '+{n} more'). No JSX/prop context is
    // required — any such literal is an English-only plural string.
    if (ts.isTemplateExpression(node)) {
      const staticText = clean(staticTextOfTemplate(node));
      if (countSuffixOf(staticText) && !hasIgnoreComment(node)) {
        hits.push({ loc: loc(sf, node), kind: 'tpl-suffix', text: staticText });
      }
    }
    if (ts.isJsxAttribute(node)) {
      const prop = node.name.getText(sf);
      const attrVisibleContext = !(prop.startsWith('data-') || allowedProps.has(prop));
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        if (attrVisibleContext || visibleProps.has(prop)) consider(`attr:${prop}`, node.initializer, node.initializer.text);
      }
      if (node.initializer && ts.isTemplateExpression(node.initializer)) {
        if (attrVisibleContext || visibleProps.has(prop)) consider(`attr-tpl:${prop}`, node.initializer, staticTextOfTemplate(node.initializer));
      }
      if (node.initializer && ts.isJsxExpression(node.initializer)) {
        if (attrVisibleContext || visibleProps.has(prop)) {
          const e = node.initializer.expression;
          if (e) {
            if (ts.isStringLiteral(e)) consider(`attr-expr:${prop}`, e, e.text);
            if (ts.isTemplateExpression(e)) consider(`attr-expr-tpl:${prop}`, e, staticTextOfTemplate(e));
            if (ts.isConditionalExpression(e)) {
              for (const arm of [e.whenTrue, e.whenFalse]) {
                if (ts.isStringLiteral(arm)) consider(`attr-expr:${prop}`, arm, arm.text);
                if (ts.isNoSubstitutionTemplateLiteral(arm)) consider(`attr-expr:${prop}`, arm, arm.text);
              }
            }
            // t('key') || 'Hardcoded fallback' — the fallback leaks into the
            // English bundle whenever the key is missing/empty.
            if (ts.isBinaryExpression(e) && e.operatorToken.getText(sf) === '||') {
              for (const operand of [e.left, e.right]) {
                if (ts.isStringLiteral(operand) || ts.isNoSubstitutionTemplateLiteral(operand)) consider(`attr-expr-||:${prop}`, operand, operand.text);
                if (ts.isTemplateExpression(operand)) consider(`attr-expr-||:${prop}`, operand, staticTextOfTemplate(operand));
              }
            }
          }
        }
      }
    }
    // Skip generic JSX-expression handling when the expression is the direct
    // initializer of a JSX attribute — the attribute branch already handles it
    // with the correct prop context (avoid double-reporting).
    if (ts.isJsxExpression(node) && ts.isJsxAttribute(node.parent)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (!insideNonVisibleAttr(node) && ts.isJsxExpression(node) && node.expression) {
      const e = node.expression;
      if (ts.isStringLiteral(e)) consider('jsx-expression-string', e, e.text);
      if (ts.isNoSubstitutionTemplateLiteral(e)) consider('jsx-expression-template', e, e.text);
      if (ts.isTemplateExpression(e)) consider('jsx-expression-template', e, staticTextOfTemplate(e));
      if (ts.isConditionalExpression(e)) {
        for (const arm of [e.whenTrue, e.whenFalse]) {
          if (ts.isStringLiteral(arm) || ts.isNoSubstitutionTemplateLiteral(arm)) consider('jsx-conditional-string', arm, arm.text);
          if (ts.isTemplateExpression(arm)) consider('jsx-conditional-template', arm, staticTextOfTemplate(arm));
        }
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (/shareData|fallbackText|message|title|text|label/i.test(name)) {
        const e = node.initializer;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) consider(`var:${name}`, e, (e.text || e.getText(sf)).slice(0, 160));
        if (ts.isTemplateExpression(e)) consider(`var-tpl:${name}`, e, staticTextOfTemplate(e).slice(0, 160));
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf);
      const keyLooksVisible = visibleProps.has(key) || /(label|title|text|message|description|placeholder|hint|tooltip|heading|subtitle|badge)$/i.test(key);
      if (keyLooksVisible) {
        const v = node.initializer;
        if (ts.isStringLiteral(v)) consider(`obj:${key}`, v, v.text);
        if (ts.isNoSubstitutionTemplateLiteral(v)) consider(`obj-tpl:${key}`, v, v.text);
        if (ts.isTemplateExpression(v)) consider(`obj-tpl:${key}`, v, staticTextOfTemplate(v));
        // label: cond ? 'A' : 'B' — conditional arms on visible keys.
        if (ts.isConditionalExpression(v)) {
          for (const arm of [v.whenTrue, v.whenFalse]) {
            if (ts.isStringLiteral(arm) || ts.isNoSubstitutionTemplateLiteral(arm)) consider(`obj-cond:${key}`, arm, arm.text);
          }
        }
        // t('key') || 'Fallback' — hardcoded fallback on visible keys.
        if (ts.isBinaryExpression(v) && v.operatorToken.getText(sf) === '||') {
          for (const operand of [v.left, v.right]) {
            if (ts.isStringLiteral(operand) || ts.isNoSubstitutionTemplateLiteral(operand)) consider(`obj-||:${key}`, operand, operand.text);
          }
        }
      }
      // Enum-style label maps ({ low: 'Low', medium: 'Medium', ... }) — the
      // keys are not label-looking but the values are capitalized visible words.
      if (/^(low|medium|high|urgent|none)$/.test(key) && ts.isStringLiteral(node.initializer)) {
        consider(`obj-enum-label:${key}`, node.initializer, node.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

for (const h of hits) console.log(`${h.loc} [${h.kind}] ${h.text}`);
console.error(`visible-string-hits=${hits.length}`);
process.exit(hits.length ? 1 : 0);