import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

import { en } from '../src/localization/en.ts';
import { it } from '../src/localization/it.ts';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}
const copyAttributes = new Set(['label', 'title', 'placeholder', 'accessibilityLabel', 'accessibilityHint']);
// App branding, version prefix and the invariant SI serving-size unit are data/symbols.
const invariantText = new Set(['bevve', 'v', 'ml', 'ml ·']);

test('native screen/component copy has no untranslated JSX text, literal copy attributes or English templates', () => {
  const untranslated = [];
  for (const file of sources(sourceRoot).filter((file) => file.endsWith('.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const record = (node, text) => {
      const value = text.trim().replace(/\s+/g, ' ');
      if (!/[a-z]/i.test(value) || invariantText.has(value)) return;
      const location = source.getLineAndCharacterOfPosition(node.getStart(source));
      untranslated.push(file.slice(sourceRoot.length) + ':' + (location.line + 1) + ' ' + value);
    };
    const insideJsx = (node) => {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) return true;
      }
      return false;
    };
    function visit(node) {
      if (ts.isJsxText(node)) record(node, node.text);
      if (ts.isJsxAttribute(node) && copyAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) record(node, node.initializer.text);
      if (ts.isTemplateExpression(node) && insideJsx(node)) record(node, node.head.text + node.templateSpans.map((span) => span.literal.text).join(''));
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(untranslated, [], 'Translate UI copy at render time; do not add English-only labels.');
});

test('every static translation call references a key present in both dictionaries', () => {
  const missing = [];
  for (const file of sources(sourceRoot).filter((file) => !file.endsWith('/en.ts') && !file.endsWith('/it.ts'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        if (!Object.hasOwn(en, key) || !Object.hasOwn(it, key)) missing.push({ file, key });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});
