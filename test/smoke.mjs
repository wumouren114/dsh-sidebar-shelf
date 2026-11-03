// Zero-dependency checks that do not need a browser or a DSH install:
// manifest integrity, bundle shape, locale files, and the slot wiring that
// `apply()` performs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
};

check('package manifest is a DSH bundle with a web client', () => {
  const pkg = json('package.json');
  assert.equal(pkg.name, 'dsh-sidebar-shelf');
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.ok(pkg.dsh.client.inject.includes('slots'));
  assert.ok(pkg.dsh.client.inject.includes('layout'));
  assert.equal(pkg.exports['./client'], './lib/client.js');
  assert.equal(pkg.license, 'MIT');
});

check('bundle patch points at the package entry', () => {
  const patch = read('cordis.patch.yml');
  assert.match(patch, /-\s*insert:/);
  assert.match(patch, /id:\s*dsh-sidebar-shelf/);
  assert.match(patch, /name:\s*'dsh-sidebar-shelf'/);
});

check('host half is a no-op Cordis plugin', () => {
  const host = read('lib/index.js');
  assert.match(host, /export const name = 'dsh-sidebar-shelf'/);
  assert.match(host, /export const inject = \[\]/);
  assert.match(host, /export function apply\(\)/);
});

check('client bundle registers under the module loader', () => {
  const client = read('lib/client.js');
  assert.match(client, /window\.__ModuleLoader__\.load\(\{/);
  assert.match(client, /id: "dsh-sidebar-shelf"/);
  assert.match(client, /factory: \(require\) =>/);
  assert.doesNotMatch(client, /^\s*import\s/m, 'browser bundle must not use ESM imports');
  assert.doesNotMatch(client, /^\s*export\s/m, 'browser bundle must not use ESM exports');
});

check('client requires only platform modules', () => {
  const client = read('lib/client.js');
  const allowed = new Set([
    'react',
    'react-dom',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
  ]);
  const required = [...client.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
  for (const name of required) assert.ok(allowed.has(name), `unexpected require("${name}")`);
});

check('client keeps one native panel row and hides the others', () => {
  const client = read('lib/client.js');
  assert.match(client, /ctx\.slots\.inject\("sidebar\.panellist"/);
  assert.match(client, /name: "sidebar\.panellist"/);
  assert.match(client, /entriesOfSlot\("sidebar\.panellist"\)/);
  assert.match(client, /ctx\.layout\.selectPanel/);
  assert.ok(client.includes('> *:not(['), 'must hide sibling rows, not the whole list');
  assert.ok(client.includes('closest("button")'), 'must attach to the native row button');
});

check('locales carry plugin-list metadata', () => {
  for (const locale of ['en', 'zh']) {
    const data = json(`locale/${locale}.json`);
    assert.equal(typeof data.meta.title, 'string');
    assert.equal(typeof data.meta.description, 'string');
  }
});

check('icon is a small svg', () => {
  const icon = path.join(root, 'icon.svg');
  assert.ok(fs.statSync(icon).size < 256 * 1024);
  assert.match(fs.readFileSync(icon, 'utf8'), /<svg/);
});

check('published files include the runtime pieces', () => {
  const { files } = json('package.json');
  for (const entry of ['lib', 'locale', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
    assert.ok(files.includes(entry), `files[] is missing ${entry}`);
  }
});

check('apply() wires the panel list slot and locale', () => {
  let factory;
  globalThis.window = {
    __ModuleLoader__: {
      load: (definition) => {
        factory = definition.factory;
      },
    },
  };
  const id = 'dsh-sidebar-shelf';
  const source = read('lib/client.js');
  // Execute the bundle with a fake module loader; the factory body only defines
  // components and runs apply() when we ask it to.
  new Function('window', source)(globalThis.window);
  assert.equal(typeof factory, 'function');

  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
  }
  const React = {
    createElement: (...args) => args,
    Component,
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v }),
    useCallback: (fn) => fn,
  };
  const require = (name) => {
    if (name === 'react') return React;
    if (name === 'react-dom') return { createPortal: (node) => node };
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { IconAppsAddOutlineRegular: () => null };
    if (name === '@deepseek-ai/dsh-client-ui-slots') return { resolveSlotLabel: (label) => (typeof label === 'string' ? label : label?.zh ?? label?.en) };
    throw new Error('unexpected require ' + name);
  };

  const exports = factory(require);
  assert.equal(exports.name, id);
  assert.deepEqual(exports.inject, ['slots', 'layout', 'locale']);

  const registrations = [];
  const ctx = {
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    layout: {
      selectPanel: () => {},
      panelInfo: { getSnapshot: () => ({ activePanelId: null }), subscribe: () => () => {} },
    },
    slots: {
      inject: (name, register) => register(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };
  exports.apply(ctx);
  assert.equal(registrations.length, 1);
  const [registration] = registrations;
  assert.equal(registration.options.name, 'sidebar.panellist');
  assert.equal(registration.options.id, 'dsh-sidebar-shelf-entry');
  assert.equal(registration.options.order, -1000);
  assert.equal(typeof registration.options.label, 'function');
  assert.equal(typeof registration.component, 'function');
  const injected = registration.options.inject();
  assert.equal(typeof injected.selectPanel, 'function');
  assert.equal(injected.hooks.activePanel, ctx.layout.panelInfo);
});

console.log(`\n${passed} smoke checks passed`);
