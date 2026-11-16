import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export const nativeStub = {
  View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput',
  StyleSheet: { create: (styles) => styles },
  Platform: { select: (values) => values.ios ?? values.default },
  Keyboard: { dismiss() {} },
};

// Inspect actual component props/styles without pretending to render native views.
export function loadNativeModule(path, mocks = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    module, exports: module.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : name === 'react-native' ? nativeStub : require(name),
  });
  return module.exports;
}

export const flattenStyle = (styles) => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
export function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); }
  else if (node && typeof node === 'object' && node.props) {
    yield node;
    yield* elements(node.props.children);
  }
}
