import { exec } from 'child_process';

const sharedConfig = {};
function setHydrateContext(context) {
  sharedConfig.context = context;
}

const equalFn = (a, b) => a === b;
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let Listener$1 = null;
let Pending = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener$1,
        owner = Owner,
        unowned = fn.length === 0,
        root = unowned && !false ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: null,
    owner: detachedOwner || owner
  },
        updateFn = unowned ? fn : () => fn(() => cleanNode(root));
  Owner = root;
  Listener$1 = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener$1 = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    pending: NOTPENDING,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.pending !== NOTPENDING ? s.pending : s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.pending = NOTPENDING;
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function batch(fn) {
  if (Pending) return fn();
  let result;
  const q = Pending = [];
  try {
    result = fn();
  } finally {
    Pending = null;
  }
  runUpdates(() => {
    for (let i = 0; i < q.length; i += 1) {
      const data = q[i];
      if (data.pending !== NOTPENDING) {
        const pending = data.pending;
        data.pending = NOTPENDING;
        writeSignal(data, pending);
      }
    }
  }, false);
  return result;
}
function untrack(fn) {
  let result,
      listener = Listener$1;
  Listener$1 = null;
  result = fn();
  Listener$1 = listener;
  return result;
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function readSignal() {
  const runningTransition = Transition ;
  if (this.sources && (this.state || runningTransition )) {
    const updates = Updates;
    Updates = null;
    this.state === STALE || runningTransition  ? updateComputation(this) : lookUpstream(this);
    Updates = updates;
  }
  if (Listener$1) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener$1.sources) {
      Listener$1.sources = [this];
      Listener$1.sourceSlots = [sSlot];
    } else {
      Listener$1.sources.push(this);
      Listener$1.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener$1];
      this.observerSlots = [Listener$1.sources.length - 1];
    } else {
      this.observers.push(Listener$1);
      this.observerSlots.push(Listener$1.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  if (Pending) {
    if (node.pending === NOTPENDING) Pending.push(node);
    node.pending = value;
    return value;
  }
  if (node.comparator) {
    if (node.comparator(node.value, value)) return value;
  }
  let TransitionRunning = false;
  node.value = value;
  if (node.observers && node.observers.length) {
    runUpdates(() => {
      for (let i = 0; i < node.observers.length; i += 1) {
        const o = node.observers[i];
        if (TransitionRunning && Transition.disposed.has(o)) ;
        if (TransitionRunning && !o.tState || !TransitionRunning && !o.state) {
          if (o.pure) Updates.push(o);else Effects.push(o);
          if (o.observers) markDownstream(o);
        }
        if (TransitionRunning) ;else o.state = STALE;
      }
      if (Updates.length > 10e5) {
        Updates = [];
        if (false) ;
        throw new Error();
      }
    }, false);
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
        listener = Listener$1,
        time = ExecCount;
  Listener$1 = Owner = node;
  runComputation(node, node.value, time);
  Listener$1 = listener;
  Owner = owner;
}
function runComputation(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.observers && node.observers.length) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition ;
  if (node.state === 0 || runningTransition ) return;
  if (node.state === PENDING || runningTransition ) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state || runningTransition ) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (node.state === STALE || runningTransition ) {
      updateComputation(node);
    } else if (node.state === PENDING || runningTransition ) {
      const updates = Updates;
      Updates = null;
      lookUpstream(node, ancestors[0]);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!Updates) Effects = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  if (Effects.length) batch(() => {
    runEffects(Effects);
    Effects = null;
  });else {
    Effects = null;
  }
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
      userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);else queue[userLength++] = e;
  }
  if (sharedConfig.context) setHydrateContext();
  const resume = queue.length;
  for (i = 0; i < userLength; i++) runTop(queue[i]);
  for (i = resume; i < queue.length; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition ;
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      if (source.state === STALE || runningTransition ) {
        if (source !== ignore) runTop(source);
      } else if (source.state === PENDING || runningTransition ) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition ;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state || runningTransition ) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
            index = node.sourceSlots.pop(),
            obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
              s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
  node.context = null;
}
function handleError(err) {
  throw err;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
      mapped = [],
      disposers = [],
      len = 0,
      indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
        i,
        j;
    newItems[$TRACK];
    return untrack(() => {
      let newLen = newItems.length,
          newIndices,
          newIndicesNext,
          temp,
          tempdisposers,
          tempIndexes,
          start,
          end,
          newEnd,
          item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}

function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback ? fallback : undefined));
}

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
      aEnd = a.length,
      bEnd = bLength,
      aStart = 0,
      bStart = 0,
      after = a[aEnd - 1].nextSibling,
      map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
              sequence = 1,
              t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  });
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, check, isSVG) {
  const t = document.createElement("template");
  t.innerHTML = html;
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function className(node, value) {
  if (value == null) node.removeAttribute("class");else node.className = value;
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function eventHandler(e) {
  const key = `$$${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done) {
    sharedConfig.done = true;
    document.querySelectorAll("[id^=pl-]").forEach(elem => elem.remove());
  }
  while (node !== null) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node = node.host && node.host !== node && node.host instanceof Node ? node.host : node.parentNode;
  }
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  if (sharedConfig.context && !current) current = [...parent.childNodes];
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
        multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (sharedConfig.context) return current;
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (sharedConfig.context) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (sharedConfig.context) {
      for (let i = 0; i < array.length; i++) {
        if (array[i].parentNode) return current = array;
      }
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value instanceof Node) {
    if (sharedConfig.context && value.parentNode) return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
        prev = current && current[i];
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false) ; else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if ((typeof item) === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], prev) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) {
        normalized.push(prev);
      } else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const e=Symbol("@ts-pattern/matcher"),t="@ts-pattern/anonymous-select-key",n=e=>Boolean(e&&"object"==typeof e),r=t=>t&&!!t[e],o=(t,c,a)=>{if(n(t)){if(r(t)){const n=t[e](),{matched:r,selections:o}=n.match(c);return r&&o&&Object.keys(o).forEach(e=>a(e,o[e])),r}if(!n(c))return !1;if(Array.isArray(t))return !!Array.isArray(c)&&t.length===c.length&&t.every((e,t)=>o(e,c[t],a));if(t instanceof Map)return c instanceof Map&&Array.from(t.keys()).every(e=>o(t.get(e),c.get(e),a));if(t instanceof Set){if(!(c instanceof Set))return !1;if(0===t.size)return 0===c.size;if(1===t.size){const[e]=Array.from(t.values());return r(e)?Array.from(c.values()).every(t=>o(e,t,a)):c.has(e)}return Array.from(t.values()).every(e=>c.has(e))}return Object.keys(t).every(n=>{const s=t[n];return (n in c||r(i=s)&&"optional"===i[e]().matcherType)&&o(s,c[n],a);var i;})}return Object.is(c,t)};const K=e=>new O(e,[]);class O{constructor(e,t){this.value=void 0,this.cases=void 0,this.value=e,this.cases=t;}with(...e){const n=e[e.length-1],r=[e[0]],c=[];return 3===e.length&&"function"==typeof e[1]?(r.push(e[0]),c.push(e[1])):e.length>2&&r.push(...e.slice(1,e.length-1)),new O(this.value,this.cases.concat([{match:e=>{let n={};const a=Boolean(r.some(t=>o(t,e,(e,t)=>{n[e]=t;}))&&c.every(t=>t(e)));return {matched:a,value:a&&Object.keys(n).length?t in n?n[t]:n:e}},handler:n}]))}when(e,t){return new O(this.value,this.cases.concat([{match:t=>({matched:Boolean(e(t)),value:t}),handler:t}]))}otherwise(e){return new O(this.value,this.cases.concat([{match:e=>({matched:!0,value:e}),handler:e}])).run()}exhaustive(){return this.run()}run(){let e,t=this.value;for(let n=0;n<this.cases.length;n++){const r=this.cases[n],o=r.match(this.value);if(o.matched){t=o.value,e=r.handler;break}}if(!e){let e;try{e=JSON.stringify(this.value);}catch(t){e=this.value;}throw new Error(`Pattern matching error: no pattern matches value ${e}`)}return e(t,this.value)}}

/*

Based off glamor's StyleSheet, thanks Sunil ❤️

high performance StyleSheet for css-in-js systems

- uses multiple style tags behind the scenes for millions of rules
- uses `insertRule` for appending in production for *much* faster performance

// usage

import { StyleSheet } from '@emotion/sheet'

let styleSheet = new StyleSheet({ key: '', container: document.head })

styleSheet.insert('#box { border: 1px solid red; }')
- appends a css rule into the stylesheet

styleSheet.flush()
- empties the stylesheet of all its contents

*/
// $FlowFixMe
function sheetForTag(tag) {
  if (tag.sheet) {
    // $FlowFixMe
    return tag.sheet;
  } // this weirdness brought to you by firefox

  /* istanbul ignore next */


  for (var i = 0; i < document.styleSheets.length; i++) {
    if (document.styleSheets[i].ownerNode === tag) {
      // $FlowFixMe
      return document.styleSheets[i];
    }
  }
}

function createStyleElement(options) {
  var tag = document.createElement('style');
  tag.setAttribute('data-emotion', options.key);

  if (options.nonce !== undefined) {
    tag.setAttribute('nonce', options.nonce);
  }

  tag.appendChild(document.createTextNode(''));
  tag.setAttribute('data-s', '');
  return tag;
}

var StyleSheet = /*#__PURE__*/function () {
  // Using Node instead of HTMLElement since container may be a ShadowRoot
  function StyleSheet(options) {
    var _this = this;

    this._insertTag = function (tag) {
      var before;

      if (_this.tags.length === 0) {
        if (_this.insertionPoint) {
          before = _this.insertionPoint.nextSibling;
        } else if (_this.prepend) {
          before = _this.container.firstChild;
        } else {
          before = _this.before;
        }
      } else {
        before = _this.tags[_this.tags.length - 1].nextSibling;
      }

      _this.container.insertBefore(tag, before);

      _this.tags.push(tag);
    };

    this.isSpeedy = options.speedy === undefined ? process.env.NODE_ENV === 'production' : options.speedy;
    this.tags = [];
    this.ctr = 0;
    this.nonce = options.nonce; // key is the value of the data-emotion attribute, it's used to identify different sheets

    this.key = options.key;
    this.container = options.container;
    this.prepend = options.prepend;
    this.insertionPoint = options.insertionPoint;
    this.before = null;
  }

  var _proto = StyleSheet.prototype;

  _proto.hydrate = function hydrate(nodes) {
    nodes.forEach(this._insertTag);
  };

  _proto.insert = function insert(rule) {
    // the max length is how many rules we have per style tag, it's 65000 in speedy mode
    // it's 1 in dev because we insert source maps that map a single rule to a location
    // and you can only have one source map per style tag
    if (this.ctr % (this.isSpeedy ? 65000 : 1) === 0) {
      this._insertTag(createStyleElement(this));
    }

    var tag = this.tags[this.tags.length - 1];

    if (process.env.NODE_ENV !== 'production') {
      var isImportRule = rule.charCodeAt(0) === 64 && rule.charCodeAt(1) === 105;

      if (isImportRule && this._alreadyInsertedOrderInsensitiveRule) {
        // this would only cause problem in speedy mode
        // but we don't want enabling speedy to affect the observable behavior
        // so we report this error at all times
        console.error("You're attempting to insert the following rule:\n" + rule + '\n\n`@import` rules must be before all other types of rules in a stylesheet but other rules have already been inserted. Please ensure that `@import` rules are before all other rules.');
      }
      this._alreadyInsertedOrderInsensitiveRule = this._alreadyInsertedOrderInsensitiveRule || !isImportRule;
    }

    if (this.isSpeedy) {
      var sheet = sheetForTag(tag);

      try {
        // this is the ultrafast version, works across browsers
        // the big drawback is that the css won't be editable in devtools
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production' && !/:(-moz-placeholder|-moz-focus-inner|-moz-focusring|-ms-input-placeholder|-moz-read-write|-moz-read-only|-ms-clear){/.test(rule)) {
          console.error("There was a problem inserting the following rule: \"" + rule + "\"", e);
        }
      }
    } else {
      tag.appendChild(document.createTextNode(rule));
    }

    this.ctr++;
  };

  _proto.flush = function flush() {
    // $FlowFixMe
    this.tags.forEach(function (tag) {
      return tag.parentNode && tag.parentNode.removeChild(tag);
    });
    this.tags = [];
    this.ctr = 0;

    if (process.env.NODE_ENV !== 'production') {
      this._alreadyInsertedOrderInsensitiveRule = false;
    }
  };

  return StyleSheet;
}();

var MS = '-ms-';
var MOZ = '-moz-';
var WEBKIT = '-webkit-';

var COMMENT = 'comm';
var RULESET = 'rule';
var DECLARATION = 'decl';
var IMPORT = '@import';
var KEYFRAMES = '@keyframes';

/**
 * @param {number}
 * @return {number}
 */
var abs = Math.abs;

/**
 * @param {number}
 * @return {string}
 */
var from = String.fromCharCode;

/**
 * @param {object}
 * @return {object}
 */
var assign$1 = Object.assign;

/**
 * @param {string} value
 * @param {number} length
 * @return {number}
 */
function hash (value, length) {
	return (((((((length << 2) ^ charat(value, 0)) << 2) ^ charat(value, 1)) << 2) ^ charat(value, 2)) << 2) ^ charat(value, 3)
}

/**
 * @param {string} value
 * @return {string}
 */
function trim (value) {
	return value.trim()
}

/**
 * @param {string} value
 * @param {RegExp} pattern
 * @return {string?}
 */
function match (value, pattern) {
	return (value = pattern.exec(value)) ? value[0] : value
}

/**
 * @param {string} value
 * @param {(string|RegExp)} pattern
 * @param {string} replacement
 * @return {string}
 */
function replace (value, pattern, replacement) {
	return value.replace(pattern, replacement)
}

/**
 * @param {string} value
 * @param {string} search
 * @return {number}
 */
function indexof (value, search) {
	return value.indexOf(search)
}

/**
 * @param {string} value
 * @param {number} index
 * @return {number}
 */
function charat (value, index) {
	return value.charCodeAt(index) | 0
}

/**
 * @param {string} value
 * @param {number} begin
 * @param {number} end
 * @return {string}
 */
function substr (value, begin, end) {
	return value.slice(begin, end)
}

/**
 * @param {string} value
 * @return {number}
 */
function strlen (value) {
	return value.length
}

/**
 * @param {any[]} value
 * @return {number}
 */
function sizeof (value) {
	return value.length
}

/**
 * @param {any} value
 * @param {any[]} array
 * @return {any}
 */
function append (value, array) {
	return array.push(value), value
}

/**
 * @param {string[]} array
 * @param {function} callback
 * @return {string}
 */
function combine$1 (array, callback) {
	return array.map(callback).join('')
}

var line = 1;
var column = 1;
var length = 0;
var position = 0;
var character = 0;
var characters = '';

/**
 * @param {string} value
 * @param {object | null} root
 * @param {object | null} parent
 * @param {string} type
 * @param {string[] | string} props
 * @param {object[] | string} children
 * @param {number} length
 */
function node (value, root, parent, type, props, children, length) {
	return {value: value, root: root, parent: parent, type: type, props: props, children: children, line: line, column: column, length: length, return: ''}
}

/**
 * @param {object} root
 * @param {object} props
 * @return {object}
 */
function copy (root, props) {
	return assign$1(node('', null, null, '', null, null, 0), root, {length: -root.length}, props)
}

/**
 * @return {number}
 */
function char () {
	return character
}

/**
 * @return {number}
 */
function prev () {
	character = position > 0 ? charat(characters, --position) : 0;

	if (column--, character === 10)
		column = 1, line--;

	return character
}

/**
 * @return {number}
 */
function next () {
	character = position < length ? charat(characters, position++) : 0;

	if (column++, character === 10)
		column = 1, line++;

	return character
}

/**
 * @return {number}
 */
function peek () {
	return charat(characters, position)
}

/**
 * @return {number}
 */
function caret () {
	return position
}

/**
 * @param {number} begin
 * @param {number} end
 * @return {string}
 */
function slice$1 (begin, end) {
	return substr(characters, begin, end)
}

/**
 * @param {number} type
 * @return {number}
 */
function token (type) {
	switch (type) {
		// \0 \t \n \r \s whitespace token
		case 0: case 9: case 10: case 13: case 32:
			return 5
		// ! + , / > @ ~ isolate token
		case 33: case 43: case 44: case 47: case 62: case 64: case 126:
		// ; { } breakpoint token
		case 59: case 123: case 125:
			return 4
		// : accompanied token
		case 58:
			return 3
		// " ' ( [ opening delimit token
		case 34: case 39: case 40: case 91:
			return 2
		// ) ] closing delimit token
		case 41: case 93:
			return 1
	}

	return 0
}

/**
 * @param {string} value
 * @return {any[]}
 */
function alloc (value) {
	return line = column = 1, length = strlen(characters = value), position = 0, []
}

/**
 * @param {any} value
 * @return {any}
 */
function dealloc (value) {
	return characters = '', value
}

/**
 * @param {number} type
 * @return {string}
 */
function delimit (type) {
	return trim(slice$1(position - 1, delimiter(type === 91 ? type + 2 : type === 40 ? type + 1 : type)))
}

/**
 * @param {number} type
 * @return {string}
 */
function whitespace (type) {
	while (character = peek())
		if (character < 33)
			next();
		else
			break

	return token(type) > 2 || token(character) > 3 ? '' : ' '
}

/**
 * @param {number} index
 * @param {number} count
 * @return {string}
 */
function escaping (index, count) {
	while (--count && next())
		// not 0-9 A-F a-f
		if (character < 48 || character > 102 || (character > 57 && character < 65) || (character > 70 && character < 97))
			break

	return slice$1(index, caret() + (count < 6 && peek() == 32 && next() == 32))
}

/**
 * @param {number} type
 * @return {number}
 */
function delimiter (type) {
	while (next())
		switch (character) {
			// ] ) " '
			case type:
				return position
			// " '
			case 34: case 39:
				if (type !== 34 && type !== 39)
					delimiter(character);
				break
			// (
			case 40:
				if (type === 41)
					delimiter(type);
				break
			// \
			case 92:
				next();
				break
		}

	return position
}

/**
 * @param {number} type
 * @param {number} index
 * @return {number}
 */
function commenter (type, index) {
	while (next())
		// //
		if (type + character === 47 + 10)
			break
		// /*
		else if (type + character === 42 + 42 && peek() === 47)
			break

	return '/*' + slice$1(index, position - 1) + '*' + from(type === 47 ? type : next())
}

/**
 * @param {number} index
 * @return {string}
 */
function identifier (index) {
	while (!token(peek()))
		next();

	return slice$1(index, position)
}

/**
 * @param {string} value
 * @return {object[]}
 */
function compile (value) {
	return dealloc(parse('', null, null, null, [''], value = alloc(value), 0, [0], value))
}

/**
 * @param {string} value
 * @param {object} root
 * @param {object?} parent
 * @param {string[]} rule
 * @param {string[]} rules
 * @param {string[]} rulesets
 * @param {number[]} pseudo
 * @param {number[]} points
 * @param {string[]} declarations
 * @return {object}
 */
function parse (value, root, parent, rule, rules, rulesets, pseudo, points, declarations) {
	var index = 0;
	var offset = 0;
	var length = pseudo;
	var atrule = 0;
	var property = 0;
	var previous = 0;
	var variable = 1;
	var scanning = 1;
	var ampersand = 1;
	var character = 0;
	var type = '';
	var props = rules;
	var children = rulesets;
	var reference = rule;
	var characters = type;

	while (scanning)
		switch (previous = character, character = next()) {
			// (
			case 40:
				if (previous != 108 && characters.charCodeAt(length - 1) == 58) {
					if (indexof(characters += replace(delimit(character), '&', '&\f'), '&\f') != -1)
						ampersand = -1;
					break
				}
			// " ' [
			case 34: case 39: case 91:
				characters += delimit(character);
				break
			// \t \n \r \s
			case 9: case 10: case 13: case 32:
				characters += whitespace(previous);
				break
			// \
			case 92:
				characters += escaping(caret() - 1, 7);
				continue
			// /
			case 47:
				switch (peek()) {
					case 42: case 47:
						append(comment(commenter(next(), caret()), root, parent), declarations);
						break
					default:
						characters += '/';
				}
				break
			// {
			case 123 * variable:
				points[index++] = strlen(characters) * ampersand;
			// } ; \0
			case 125 * variable: case 59: case 0:
				switch (character) {
					// \0 }
					case 0: case 125: scanning = 0;
					// ;
					case 59 + offset:
						if (property > 0 && (strlen(characters) - length))
							append(property > 32 ? declaration(characters + ';', rule, parent, length - 1) : declaration(replace(characters, ' ', '') + ';', rule, parent, length - 2), declarations);
						break
					// @ ;
					case 59: characters += ';';
					// { rule/at-rule
					default:
						append(reference = ruleset(characters, root, parent, index, offset, rules, points, type, props = [], children = [], length), rulesets);

						if (character === 123)
							if (offset === 0)
								parse(characters, root, reference, reference, props, rulesets, length, points, children);
							else
								switch (atrule) {
									// d m s
									case 100: case 109: case 115:
										parse(value, reference, reference, rule && append(ruleset(value, reference, reference, 0, 0, rules, points, type, rules, props = [], length), children), rules, children, length, points, rule ? props : children);
										break
									default:
										parse(characters, reference, reference, reference, [''], children, 0, points, children);
								}
				}

				index = offset = property = 0, variable = ampersand = 1, type = characters = '', length = pseudo;
				break
			// :
			case 58:
				length = 1 + strlen(characters), property = previous;
			default:
				if (variable < 1)
					if (character == 123)
						--variable;
					else if (character == 125 && variable++ == 0 && prev() == 125)
						continue

				switch (characters += from(character), character * variable) {
					// &
					case 38:
						ampersand = offset > 0 ? 1 : (characters += '\f', -1);
						break
					// ,
					case 44:
						points[index++] = (strlen(characters) - 1) * ampersand, ampersand = 1;
						break
					// @
					case 64:
						// -
						if (peek() === 45)
							characters += delimit(next());

						atrule = peek(), offset = length = strlen(type = characters += identifier(caret())), character++;
						break
					// -
					case 45:
						if (previous === 45 && strlen(characters) == 2)
							variable = 0;
				}
		}

	return rulesets
}

/**
 * @param {string} value
 * @param {object} root
 * @param {object?} parent
 * @param {number} index
 * @param {number} offset
 * @param {string[]} rules
 * @param {number[]} points
 * @param {string} type
 * @param {string[]} props
 * @param {string[]} children
 * @param {number} length
 * @return {object}
 */
function ruleset (value, root, parent, index, offset, rules, points, type, props, children, length) {
	var post = offset - 1;
	var rule = offset === 0 ? rules : [''];
	var size = sizeof(rule);

	for (var i = 0, j = 0, k = 0; i < index; ++i)
		for (var x = 0, y = substr(value, post + 1, post = abs(j = points[i])), z = value; x < size; ++x)
			if (z = trim(j > 0 ? rule[x] + ' ' + y : replace(y, /&\f/g, rule[x])))
				props[k++] = z;

	return node(value, root, parent, offset === 0 ? RULESET : type, props, children, length)
}

/**
 * @param {number} value
 * @param {object} root
 * @param {object?} parent
 * @return {object}
 */
function comment (value, root, parent) {
	return node(value, root, parent, COMMENT, from(char()), substr(value, 2, -2), 0)
}

/**
 * @param {string} value
 * @param {object} root
 * @param {object?} parent
 * @param {number} length
 * @return {object}
 */
function declaration (value, root, parent, length) {
	return node(value, root, parent, DECLARATION, substr(value, 0, length), substr(value, length + 1, -1), length)
}

/**
 * @param {string} value
 * @param {number} length
 * @return {string}
 */
function prefix (value, length) {
	switch (hash(value, length)) {
		// color-adjust
		case 5103:
			return WEBKIT + 'print-' + value + value
		// animation, animation-(delay|direction|duration|fill-mode|iteration-count|name|play-state|timing-function)
		case 5737: case 4201: case 3177: case 3433: case 1641: case 4457: case 2921:
		// text-decoration, filter, clip-path, backface-visibility, column, box-decoration-break
		case 5572: case 6356: case 5844: case 3191: case 6645: case 3005:
		// mask, mask-image, mask-(mode|clip|size), mask-(repeat|origin), mask-position, mask-composite,
		case 6391: case 5879: case 5623: case 6135: case 4599: case 4855:
		// background-clip, columns, column-(count|fill|gap|rule|rule-color|rule-style|rule-width|span|width)
		case 4215: case 6389: case 5109: case 5365: case 5621: case 3829:
			return WEBKIT + value + value
		// appearance, user-select, transform, hyphens, text-size-adjust
		case 5349: case 4246: case 4810: case 6968: case 2756:
			return WEBKIT + value + MOZ + value + MS + value + value
		// flex, flex-direction
		case 6828: case 4268:
			return WEBKIT + value + MS + value + value
		// order
		case 6165:
			return WEBKIT + value + MS + 'flex-' + value + value
		// align-items
		case 5187:
			return WEBKIT + value + replace(value, /(\w+).+(:[^]+)/, WEBKIT + 'box-$1$2' + MS + 'flex-$1$2') + value
		// align-self
		case 5443:
			return WEBKIT + value + MS + 'flex-item-' + replace(value, /flex-|-self/, '') + value
		// align-content
		case 4675:
			return WEBKIT + value + MS + 'flex-line-pack' + replace(value, /align-content|flex-|-self/, '') + value
		// flex-shrink
		case 5548:
			return WEBKIT + value + MS + replace(value, 'shrink', 'negative') + value
		// flex-basis
		case 5292:
			return WEBKIT + value + MS + replace(value, 'basis', 'preferred-size') + value
		// flex-grow
		case 6060:
			return WEBKIT + 'box-' + replace(value, '-grow', '') + WEBKIT + value + MS + replace(value, 'grow', 'positive') + value
		// transition
		case 4554:
			return WEBKIT + replace(value, /([^-])(transform)/g, '$1' + WEBKIT + '$2') + value
		// cursor
		case 6187:
			return replace(replace(replace(value, /(zoom-|grab)/, WEBKIT + '$1'), /(image-set)/, WEBKIT + '$1'), value, '') + value
		// background, background-image
		case 5495: case 3959:
			return replace(value, /(image-set\([^]*)/, WEBKIT + '$1' + '$`$1')
		// justify-content
		case 4968:
			return replace(replace(value, /(.+:)(flex-)?(.*)/, WEBKIT + 'box-pack:$3' + MS + 'flex-pack:$3'), /s.+-b[^;]+/, 'justify') + WEBKIT + value + value
		// (margin|padding)-inline-(start|end)
		case 4095: case 3583: case 4068: case 2532:
			return replace(value, /(.+)-inline(.+)/, WEBKIT + '$1$2') + value
		// (min|max)?(width|height|inline-size|block-size)
		case 8116: case 7059: case 5753: case 5535:
		case 5445: case 5701: case 4933: case 4677:
		case 5533: case 5789: case 5021: case 4765:
			// stretch, max-content, min-content, fill-available
			if (strlen(value) - 1 - length > 6)
				switch (charat(value, length + 1)) {
					// (m)ax-content, (m)in-content
					case 109:
						// -
						if (charat(value, length + 4) !== 45)
							break
					// (f)ill-available, (f)it-content
					case 102:
						return replace(value, /(.+:)(.+)-([^]+)/, '$1' + WEBKIT + '$2-$3' + '$1' + MOZ + (charat(value, length + 3) == 108 ? '$3' : '$2-$3')) + value
					// (s)tretch
					case 115:
						return ~indexof(value, 'stretch') ? prefix(replace(value, 'stretch', 'fill-available'), length) + value : value
				}
			break
		// position: sticky
		case 4949:
			// (s)ticky?
			if (charat(value, length + 1) !== 115)
				break
		// display: (flex|inline-flex)
		case 6444:
			switch (charat(value, strlen(value) - 3 - (~indexof(value, '!important') && 10))) {
				// stic(k)y
				case 107:
					return replace(value, ':', ':' + WEBKIT) + value
				// (inline-)?fl(e)x
				case 101:
					return replace(value, /(.+:)([^;!]+)(;|!.+)?/, '$1' + WEBKIT + (charat(value, 14) === 45 ? 'inline-' : '') + 'box$3' + '$1' + WEBKIT + '$2$3' + '$1' + MS + '$2box$3') + value
			}
			break
		// writing-mode
		case 5936:
			switch (charat(value, length + 11)) {
				// vertical-l(r)
				case 114:
					return WEBKIT + value + MS + replace(value, /[svh]\w+-[tblr]{2}/, 'tb') + value
				// vertical-r(l)
				case 108:
					return WEBKIT + value + MS + replace(value, /[svh]\w+-[tblr]{2}/, 'tb-rl') + value
				// horizontal(-)tb
				case 45:
					return WEBKIT + value + MS + replace(value, /[svh]\w+-[tblr]{2}/, 'lr') + value
			}

			return WEBKIT + value + MS + value + value
	}

	return value
}

/**
 * @param {object[]} children
 * @param {function} callback
 * @return {string}
 */
function serialize (children, callback) {
	var output = '';
	var length = sizeof(children);

	for (var i = 0; i < length; i++)
		output += callback(children[i], i, children, callback) || '';

	return output
}

/**
 * @param {object} element
 * @param {number} index
 * @param {object[]} children
 * @param {function} callback
 * @return {string}
 */
function stringify (element, index, children, callback) {
	switch (element.type) {
		case IMPORT: case DECLARATION: return element.return = element.return || element.value
		case COMMENT: return ''
		case KEYFRAMES: return element.return = element.value + '{' + serialize(element.children, callback) + '}'
		case RULESET: element.value = element.props.join(',');
	}

	return strlen(children = serialize(element.children, callback)) ? element.return = element.value + '{' + children + '}' : ''
}

/**
 * @param {function[]} collection
 * @return {function}
 */
function middleware (collection) {
	var length = sizeof(collection);

	return function (element, index, children, callback) {
		var output = '';

		for (var i = 0; i < length; i++)
			output += collection[i](element, index, children, callback) || '';

		return output
	}
}

/**
 * @param {function} callback
 * @return {function}
 */
function rulesheet (callback) {
	return function (element) {
		if (!element.root)
			if (element = element.return)
				callback(element);
	}
}

/**
 * @param {object} element
 * @param {number} index
 * @param {object[]} children
 * @param {function} callback
 */
function prefixer (element, index, children, callback) {
	if (element.length > -1)
		if (!element.return)
			switch (element.type) {
				case DECLARATION: element.return = prefix(element.value, element.length);
					break
				case KEYFRAMES:
					return serialize([copy(element, {value: replace(element.value, '@', '@' + WEBKIT)})], callback)
				case RULESET:
					if (element.length)
						return combine$1(element.props, function (value) {
							switch (match(value, /(::plac\w+|:read-\w+)/)) {
								// :read-(only|write)
								case ':read-only': case ':read-write':
									return serialize([copy(element, {props: [replace(value, /:(read-\w+)/, ':' + MOZ + '$1')]})], callback)
								// :placeholder
								case '::placeholder':
									return serialize([
										copy(element, {props: [replace(value, /:(plac\w+)/, ':' + WEBKIT + 'input-$1')]}),
										copy(element, {props: [replace(value, /:(plac\w+)/, ':' + MOZ + '$1')]}),
										copy(element, {props: [replace(value, /:(plac\w+)/, MS + 'input-$1')]})
									], callback)
							}

							return ''
						})
			}
}

function memoize(fn) {
  var cache = Object.create(null);
  return function (arg) {
    if (cache[arg] === undefined) cache[arg] = fn(arg);
    return cache[arg];
  };
}

var last = function last(arr) {
  return arr.length ? arr[arr.length - 1] : null;
}; // based on https://github.com/thysultan/stylis.js/blob/e6843c373ebcbbfade25ebcc23f540ed8508da0a/src/Tokenizer.js#L239-L244


var identifierWithPointTracking = function identifierWithPointTracking(begin, points, index) {
  var previous = 0;
  var character = 0;

  while (true) {
    previous = character;
    character = peek(); // &\f

    if (previous === 38 && character === 12) {
      points[index] = 1;
    }

    if (token(character)) {
      break;
    }

    next();
  }

  return slice$1(begin, position);
};

var toRules = function toRules(parsed, points) {
  // pretend we've started with a comma
  var index = -1;
  var character = 44;

  do {
    switch (token(character)) {
      case 0:
        // &\f
        if (character === 38 && peek() === 12) {
          // this is not 100% correct, we don't account for literal sequences here - like for example quoted strings
          // stylis inserts \f after & to know when & where it should replace this sequence with the context selector
          // and when it should just concatenate the outer and inner selectors
          // it's very unlikely for this sequence to actually appear in a different context, so we just leverage this fact here
          points[index] = 1;
        }

        parsed[index] += identifierWithPointTracking(position - 1, points, index);
        break;

      case 2:
        parsed[index] += delimit(character);
        break;

      case 4:
        // comma
        if (character === 44) {
          // colon
          parsed[++index] = peek() === 58 ? '&\f' : '';
          points[index] = parsed[index].length;
          break;
        }

      // fallthrough

      default:
        parsed[index] += from(character);
    }
  } while (character = next());

  return parsed;
};

var getRules = function getRules(value, points) {
  return dealloc(toRules(alloc(value), points));
}; // WeakSet would be more appropriate, but only WeakMap is supported in IE11


var fixedElements = /* #__PURE__ */new WeakMap();
var compat = function compat(element) {
  if (element.type !== 'rule' || !element.parent || // positive .length indicates that this rule contains pseudo
  // negative .length indicates that this rule has been already prefixed
  element.length < 1) {
    return;
  }

  var value = element.value,
      parent = element.parent;
  var isImplicitRule = element.column === parent.column && element.line === parent.line;

  while (parent.type !== 'rule') {
    parent = parent.parent;
    if (!parent) return;
  } // short-circuit for the simplest case


  if (element.props.length === 1 && value.charCodeAt(0) !== 58
  /* colon */
  && !fixedElements.get(parent)) {
    return;
  } // if this is an implicitly inserted rule (the one eagerly inserted at the each new nested level)
  // then the props has already been manipulated beforehand as they that array is shared between it and its "rule parent"


  if (isImplicitRule) {
    return;
  }

  fixedElements.set(element, true);
  var points = [];
  var rules = getRules(value, points);
  var parentRules = parent.props;

  for (var i = 0, k = 0; i < rules.length; i++) {
    for (var j = 0; j < parentRules.length; j++, k++) {
      element.props[k] = points[i] ? rules[i].replace(/&\f/g, parentRules[j]) : parentRules[j] + " " + rules[i];
    }
  }
};
var removeLabel = function removeLabel(element) {
  if (element.type === 'decl') {
    var value = element.value;

    if ( // charcode for l
    value.charCodeAt(0) === 108 && // charcode for b
    value.charCodeAt(2) === 98) {
      // this ignores label
      element["return"] = '';
      element.value = '';
    }
  }
};
var ignoreFlag = 'emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason';

var isIgnoringComment = function isIgnoringComment(element) {
  return !!element && element.type === 'comm' && element.children.indexOf(ignoreFlag) > -1;
};

var createUnsafeSelectorsAlarm = function createUnsafeSelectorsAlarm(cache) {
  return function (element, index, children) {
    if (element.type !== 'rule') return;
    var unsafePseudoClasses = element.value.match(/(:first|:nth|:nth-last)-child/g);

    if (unsafePseudoClasses && cache.compat !== true) {
      var prevElement = index > 0 ? children[index - 1] : null;

      if (prevElement && isIgnoringComment(last(prevElement.children))) {
        return;
      }

      unsafePseudoClasses.forEach(function (unsafePseudoClass) {
        console.error("The pseudo class \"" + unsafePseudoClass + "\" is potentially unsafe when doing server-side rendering. Try changing it to \"" + unsafePseudoClass.split('-child')[0] + "-of-type\".");
      });
    }
  };
};

var isImportRule = function isImportRule(element) {
  return element.type.charCodeAt(1) === 105 && element.type.charCodeAt(0) === 64;
};

var isPrependedWithRegularRules = function isPrependedWithRegularRules(index, children) {
  for (var i = index - 1; i >= 0; i--) {
    if (!isImportRule(children[i])) {
      return true;
    }
  }

  return false;
}; // use this to remove incorrect elements from further processing
// so they don't get handed to the `sheet` (or anything else)
// as that could potentially lead to additional logs which in turn could be overhelming to the user


var nullifyElement = function nullifyElement(element) {
  element.type = '';
  element.value = '';
  element["return"] = '';
  element.children = '';
  element.props = '';
};

var incorrectImportAlarm = function incorrectImportAlarm(element, index, children) {
  if (!isImportRule(element)) {
    return;
  }

  if (element.parent) {
    console.error("`@import` rules can't be nested inside other rules. Please move it to the top level and put it before regular rules. Keep in mind that they can only be used within global styles.");
    nullifyElement(element);
  } else if (isPrependedWithRegularRules(index, children)) {
    console.error("`@import` rules can't be after other rules. Please put your `@import` rules before your other rules.");
    nullifyElement(element);
  }
};

var defaultStylisPlugins = [prefixer];

var createCache = function createCache(options) {
  var key = options.key;

  if (process.env.NODE_ENV !== 'production' && !key) {
    throw new Error("You have to configure `key` for your cache. Please make sure it's unique (and not equal to 'css') as it's used for linking styles to your cache.\n" + "If multiple caches share the same key they might \"fight\" for each other's style elements.");
  }

  if ( key === 'css') {
    var ssrStyles = document.querySelectorAll("style[data-emotion]:not([data-s])"); // get SSRed styles out of the way of React's hydration
    // document.head is a safe place to move them to(though note document.head is not necessarily the last place they will be)
    // note this very very intentionally targets all style elements regardless of the key to ensure
    // that creating a cache works inside of render of a React component

    Array.prototype.forEach.call(ssrStyles, function (node) {
      // we want to only move elements which have a space in the data-emotion attribute value
      // because that indicates that it is an Emotion 11 server-side rendered style elements
      // while we will already ignore Emotion 11 client-side inserted styles because of the :not([data-s]) part in the selector
      // Emotion 10 client-side inserted styles did not have data-s (but importantly did not have a space in their data-emotion attributes)
      // so checking for the space ensures that loading Emotion 11 after Emotion 10 has inserted some styles
      // will not result in the Emotion 10 styles being destroyed
      var dataEmotionAttribute = node.getAttribute('data-emotion');

      if (dataEmotionAttribute.indexOf(' ') === -1) {
        return;
      }
      document.head.appendChild(node);
      node.setAttribute('data-s', '');
    });
  }

  var stylisPlugins = options.stylisPlugins || defaultStylisPlugins;

  if (process.env.NODE_ENV !== 'production') {
    // $FlowFixMe
    if (/[^a-z-]/.test(key)) {
      throw new Error("Emotion key must only contain lower case alphabetical characters and - but \"" + key + "\" was passed");
    }
  }

  var inserted = {};
  var container;
  var nodesToHydrate = [];

  {
    container = options.container || document.head;
    Array.prototype.forEach.call( // this means we will ignore elements which don't have a space in them which
    // means that the style elements we're looking at are only Emotion 11 server-rendered style elements
    document.querySelectorAll("style[data-emotion^=\"" + key + " \"]"), function (node) {
      var attrib = node.getAttribute("data-emotion").split(' '); // $FlowFixMe

      for (var i = 1; i < attrib.length; i++) {
        inserted[attrib[i]] = true;
      }

      nodesToHydrate.push(node);
    });
  }

  var _insert;

  var omnipresentPlugins = [compat, removeLabel];

  if (process.env.NODE_ENV !== 'production') {
    omnipresentPlugins.push(createUnsafeSelectorsAlarm({
      get compat() {
        return cache.compat;
      }

    }), incorrectImportAlarm);
  }

  {
    var currentSheet;
    var finalizingPlugins = [stringify, process.env.NODE_ENV !== 'production' ? function (element) {
      if (!element.root) {
        if (element["return"]) {
          currentSheet.insert(element["return"]);
        } else if (element.value && element.type !== COMMENT) {
          // insert empty rule in non-production environments
          // so @emotion/jest can grab `key` from the (JS)DOM for caches without any rules inserted yet
          currentSheet.insert(element.value + "{}");
        }
      }
    } : rulesheet(function (rule) {
      currentSheet.insert(rule);
    })];
    var serializer = middleware(omnipresentPlugins.concat(stylisPlugins, finalizingPlugins));

    var stylis = function stylis(styles) {
      return serialize(compile(styles), serializer);
    };

    _insert = function insert(selector, serialized, sheet, shouldCache) {
      currentSheet = sheet;

      if (process.env.NODE_ENV !== 'production' && serialized.map !== undefined) {
        currentSheet = {
          insert: function insert(rule) {
            sheet.insert(rule + serialized.map);
          }
        };
      }

      stylis(selector ? selector + "{" + serialized.styles + "}" : serialized.styles);

      if (shouldCache) {
        cache.inserted[serialized.name] = true;
      }
    };
  }

  var cache = {
    key: key,
    sheet: new StyleSheet({
      key: key,
      container: container,
      nonce: options.nonce,
      speedy: options.speedy,
      prepend: options.prepend,
      insertionPoint: options.insertionPoint
    }),
    nonce: options.nonce,
    inserted: inserted,
    registered: {},
    insert: _insert
  };
  cache.sheet.hydrate(nodesToHydrate);
  return cache;
};

/* eslint-disable */
// Inspired by https://github.com/garycourt/murmurhash-js
// Ported from https://github.com/aappleby/smhasher/blob/61a0530f28277f2e850bfc39600ce61d02b518de/src/MurmurHash2.cpp#L37-L86
function murmur2(str) {
  // 'm' and 'r' are mixing constants generated offline.
  // They're not really 'magic', they just happen to work well.
  // const m = 0x5bd1e995;
  // const r = 24;
  // Initialize the hash
  var h = 0; // Mix 4 bytes at a time into the hash

  var k,
      i = 0,
      len = str.length;

  for (; len >= 4; ++i, len -= 4) {
    k = str.charCodeAt(i) & 0xff | (str.charCodeAt(++i) & 0xff) << 8 | (str.charCodeAt(++i) & 0xff) << 16 | (str.charCodeAt(++i) & 0xff) << 24;
    k =
    /* Math.imul(k, m): */
    (k & 0xffff) * 0x5bd1e995 + ((k >>> 16) * 0xe995 << 16);
    k ^=
    /* k >>> r: */
    k >>> 24;
    h =
    /* Math.imul(k, m): */
    (k & 0xffff) * 0x5bd1e995 + ((k >>> 16) * 0xe995 << 16) ^
    /* Math.imul(h, m): */
    (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  } // Handle the last few bytes of the input array


  switch (len) {
    case 3:
      h ^= (str.charCodeAt(i + 2) & 0xff) << 16;

    case 2:
      h ^= (str.charCodeAt(i + 1) & 0xff) << 8;

    case 1:
      h ^= str.charCodeAt(i) & 0xff;
      h =
      /* Math.imul(h, m): */
      (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  } // Do a few final mixes of the hash to ensure the last few
  // bytes are well-incorporated.


  h ^= h >>> 13;
  h =
  /* Math.imul(h, m): */
  (h & 0xffff) * 0x5bd1e995 + ((h >>> 16) * 0xe995 << 16);
  return ((h ^ h >>> 15) >>> 0).toString(36);
}

var unitlessKeys = {
  animationIterationCount: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
};

var ILLEGAL_ESCAPE_SEQUENCE_ERROR = "You have illegal escape sequence in your template literal, most likely inside content's property value.\nBecause you write your CSS inside a JavaScript string you actually have to do double escaping, so for example \"content: '\\00d7';\" should become \"content: '\\\\00d7';\".\nYou can read more about this here:\nhttps://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#ES2018_revision_of_illegal_escape_sequences";
var UNDEFINED_AS_OBJECT_KEY_ERROR = "You have passed in falsy value as style object's key (can happen when in example you pass unexported component as computed key).";
var hyphenateRegex = /[A-Z]|^ms/g;
var animationRegex = /_EMO_([^_]+?)_([^]*?)_EMO_/g;

var isCustomProperty = function isCustomProperty(property) {
  return property.charCodeAt(1) === 45;
};

var isProcessableValue = function isProcessableValue(value) {
  return value != null && typeof value !== 'boolean';
};

var processStyleName = /* #__PURE__ */memoize(function (styleName) {
  return isCustomProperty(styleName) ? styleName : styleName.replace(hyphenateRegex, '-$&').toLowerCase();
});

var processStyleValue = function processStyleValue(key, value) {
  switch (key) {
    case 'animation':
    case 'animationName':
      {
        if (typeof value === 'string') {
          return value.replace(animationRegex, function (match, p1, p2) {
            cursor = {
              name: p1,
              styles: p2,
              next: cursor
            };
            return p1;
          });
        }
      }
  }

  if (unitlessKeys[key] !== 1 && !isCustomProperty(key) && typeof value === 'number' && value !== 0) {
    return value + 'px';
  }

  return value;
};

if (process.env.NODE_ENV !== 'production') {
  var contentValuePattern = /(var|attr|counters?|url|(((repeating-)?(linear|radial))|conic)-gradient)\(|(no-)?(open|close)-quote/;
  var contentValues = ['normal', 'none', 'initial', 'inherit', 'unset'];
  var oldProcessStyleValue = processStyleValue;
  var msPattern = /^-ms-/;
  var hyphenPattern = /-(.)/g;
  var hyphenatedCache = {};

  processStyleValue = function processStyleValue(key, value) {
    if (key === 'content') {
      if (typeof value !== 'string' || contentValues.indexOf(value) === -1 && !contentValuePattern.test(value) && (value.charAt(0) !== value.charAt(value.length - 1) || value.charAt(0) !== '"' && value.charAt(0) !== "'")) {
        throw new Error("You seem to be using a value for 'content' without quotes, try replacing it with `content: '\"" + value + "\"'`");
      }
    }

    var processed = oldProcessStyleValue(key, value);

    if (processed !== '' && !isCustomProperty(key) && key.indexOf('-') !== -1 && hyphenatedCache[key] === undefined) {
      hyphenatedCache[key] = true;
      console.error("Using kebab-case for css properties in objects is not supported. Did you mean " + key.replace(msPattern, 'ms-').replace(hyphenPattern, function (str, _char) {
        return _char.toUpperCase();
      }) + "?");
    }

    return processed;
  };
}

var noComponentSelectorMessage = 'Component selectors can only be used in conjunction with ' + '@emotion/babel-plugin, the swc Emotion plugin, or another Emotion-aware ' + 'compiler transform.';

function handleInterpolation(mergedProps, registered, interpolation) {
  if (interpolation == null) {
    return '';
  }

  if (interpolation.__emotion_styles !== undefined) {
    if (process.env.NODE_ENV !== 'production' && interpolation.toString() === 'NO_COMPONENT_SELECTOR') {
      throw new Error(noComponentSelectorMessage);
    }

    return interpolation;
  }

  switch (typeof interpolation) {
    case 'boolean':
      {
        return '';
      }

    case 'object':
      {
        if (interpolation.anim === 1) {
          cursor = {
            name: interpolation.name,
            styles: interpolation.styles,
            next: cursor
          };
          return interpolation.name;
        }

        if (interpolation.styles !== undefined) {
          var next = interpolation.next;

          if (next !== undefined) {
            // not the most efficient thing ever but this is a pretty rare case
            // and there will be very few iterations of this generally
            while (next !== undefined) {
              cursor = {
                name: next.name,
                styles: next.styles,
                next: cursor
              };
              next = next.next;
            }
          }

          var styles = interpolation.styles + ";";

          if (process.env.NODE_ENV !== 'production' && interpolation.map !== undefined) {
            styles += interpolation.map;
          }

          return styles;
        }

        return createStringFromObject(mergedProps, registered, interpolation);
      }

    case 'function':
      {
        if (mergedProps !== undefined) {
          var previousCursor = cursor;
          var result = interpolation(mergedProps);
          cursor = previousCursor;
          return handleInterpolation(mergedProps, registered, result);
        } else if (process.env.NODE_ENV !== 'production') {
          console.error('Functions that are interpolated in css calls will be stringified.\n' + 'If you want to have a css call based on props, create a function that returns a css call like this\n' + 'let dynamicStyle = (props) => css`color: ${props.color}`\n' + 'It can be called directly with props or interpolated in a styled call like this\n' + "let SomeComponent = styled('div')`${dynamicStyle}`");
        }

        break;
      }

    case 'string':
      if (process.env.NODE_ENV !== 'production') {
        var matched = [];
        var replaced = interpolation.replace(animationRegex, function (match, p1, p2) {
          var fakeVarName = "animation" + matched.length;
          matched.push("const " + fakeVarName + " = keyframes`" + p2.replace(/^@keyframes animation-\w+/, '') + "`");
          return "${" + fakeVarName + "}";
        });

        if (matched.length) {
          console.error('`keyframes` output got interpolated into plain string, please wrap it with `css`.\n\n' + 'Instead of doing this:\n\n' + [].concat(matched, ["`" + replaced + "`"]).join('\n') + '\n\nYou should wrap it with `css` like this:\n\n' + ("css`" + replaced + "`"));
        }
      }

      break;
  } // finalize string values (regular strings and functions interpolated into css calls)


  if (registered == null) {
    return interpolation;
  }

  var cached = registered[interpolation];
  return cached !== undefined ? cached : interpolation;
}

function createStringFromObject(mergedProps, registered, obj) {
  var string = '';

  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      string += handleInterpolation(mergedProps, registered, obj[i]) + ";";
    }
  } else {
    for (var _key in obj) {
      var value = obj[_key];

      if (typeof value !== 'object') {
        if (registered != null && registered[value] !== undefined) {
          string += _key + "{" + registered[value] + "}";
        } else if (isProcessableValue(value)) {
          string += processStyleName(_key) + ":" + processStyleValue(_key, value) + ";";
        }
      } else {
        if (_key === 'NO_COMPONENT_SELECTOR' && process.env.NODE_ENV !== 'production') {
          throw new Error(noComponentSelectorMessage);
        }

        if (Array.isArray(value) && typeof value[0] === 'string' && (registered == null || registered[value[0]] === undefined)) {
          for (var _i = 0; _i < value.length; _i++) {
            if (isProcessableValue(value[_i])) {
              string += processStyleName(_key) + ":" + processStyleValue(_key, value[_i]) + ";";
            }
          }
        } else {
          var interpolated = handleInterpolation(mergedProps, registered, value);

          switch (_key) {
            case 'animation':
            case 'animationName':
              {
                string += processStyleName(_key) + ":" + interpolated + ";";
                break;
              }

            default:
              {
                if (process.env.NODE_ENV !== 'production' && _key === 'undefined') {
                  console.error(UNDEFINED_AS_OBJECT_KEY_ERROR);
                }

                string += _key + "{" + interpolated + "}";
              }
          }
        }
      }
    }
  }

  return string;
}

var labelPattern = /label:\s*([^\s;\n{]+)\s*(;|$)/g;
var sourceMapPattern;

if (process.env.NODE_ENV !== 'production') {
  sourceMapPattern = /\/\*#\ssourceMappingURL=data:application\/json;\S+\s+\*\//g;
} // this is the cursor for keyframes
// keyframes are stored on the SerializedStyles object as a linked list


var cursor;
var serializeStyles = function serializeStyles(args, registered, mergedProps) {
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && args[0].styles !== undefined) {
    return args[0];
  }

  var stringMode = true;
  var styles = '';
  cursor = undefined;
  var strings = args[0];

  if (strings == null || strings.raw === undefined) {
    stringMode = false;
    styles += handleInterpolation(mergedProps, registered, strings);
  } else {
    if (process.env.NODE_ENV !== 'production' && strings[0] === undefined) {
      console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR);
    }

    styles += strings[0];
  } // we start at 1 since we've already handled the first arg


  for (var i = 1; i < args.length; i++) {
    styles += handleInterpolation(mergedProps, registered, args[i]);

    if (stringMode) {
      if (process.env.NODE_ENV !== 'production' && strings[i] === undefined) {
        console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR);
      }

      styles += strings[i];
    }
  }

  var sourceMap;

  if (process.env.NODE_ENV !== 'production') {
    styles = styles.replace(sourceMapPattern, function (match) {
      sourceMap = match;
      return '';
    });
  } // using a global regex with .exec is stateful so lastIndex has to be reset each time


  labelPattern.lastIndex = 0;
  var identifierName = '';
  var match; // https://esbench.com/bench/5b809c2cf2949800a0f61fb5

  while ((match = labelPattern.exec(styles)) !== null) {
    identifierName += '-' + // $FlowFixMe we know it's not null
    match[1];
  }

  var name = murmur2(styles) + identifierName;

  if (process.env.NODE_ENV !== 'production') {
    // $FlowFixMe SerializedStyles type doesn't have toString property (and we don't want to add it)
    return {
      name: name,
      styles: styles,
      map: sourceMap,
      next: cursor,
      toString: function toString() {
        return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop).";
      }
    };
  }

  return {
    name: name,
    styles: styles,
    next: cursor
  };
};

var isBrowser = "object" !== 'undefined';
function getRegisteredStyles(registered, registeredStyles, classNames) {
  var rawClassName = '';
  classNames.split(' ').forEach(function (className) {
    if (registered[className] !== undefined) {
      registeredStyles.push(registered[className] + ";");
    } else {
      rawClassName += className + " ";
    }
  });
  return rawClassName;
}
var registerStyles = function registerStyles(cache, serialized, isStringTag) {
  var className = cache.key + "-" + serialized.name;

  if ( // we only need to add the styles to the registered cache if the
  // class name could be used further down
  // the tree but if it's a string tag, we know it won't
  // so we don't have to add it to registered cache.
  // this improves memory usage since we can avoid storing the whole style string
  (isStringTag === false || // we need to always store it if we're in compat mode and
  // in node since emotion-server relies on whether a style is in
  // the registered cache to know whether a style is global or not
  // also, note that this check will be dead code eliminated in the browser
  isBrowser === false ) && cache.registered[className] === undefined) {
    cache.registered[className] = serialized.styles;
  }
};
var insertStyles = function insertStyles(cache, serialized, isStringTag) {
  registerStyles(cache, serialized, isStringTag);
  var className = cache.key + "-" + serialized.name;

  if (cache.inserted[serialized.name] === undefined) {
    var current = serialized;

    do {
      cache.insert(serialized === current ? "." + className : '', current, cache.sheet, true);

      current = current.next;
    } while (current !== undefined);
  }
};

function insertWithoutScoping(cache, serialized) {
  if (cache.inserted[serialized.name] === undefined) {
    return cache.insert('', serialized, cache.sheet, true);
  }
}

function merge(registered, css, className) {
  var registeredStyles = [];
  var rawClassName = getRegisteredStyles(registered, registeredStyles, className);

  if (registeredStyles.length < 2) {
    return className;
  }

  return rawClassName + css(registeredStyles);
}

var createEmotion = function createEmotion(options) {
  var cache = createCache(options); // $FlowFixMe

  cache.sheet.speedy = function (value) {
    if (process.env.NODE_ENV !== 'production' && this.ctr !== 0) {
      throw new Error('speedy must be changed before any rules are inserted');
    }

    this.isSpeedy = value;
  };

  cache.compat = true;

  var css = function css() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var serialized = serializeStyles(args, cache.registered, undefined);
    insertStyles(cache, serialized, false);
    return cache.key + "-" + serialized.name;
  };

  var keyframes = function keyframes() {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var serialized = serializeStyles(args, cache.registered);
    var animation = "animation-" + serialized.name;
    insertWithoutScoping(cache, {
      name: serialized.name,
      styles: "@keyframes " + animation + "{" + serialized.styles + "}"
    });
    return animation;
  };

  var injectGlobal = function injectGlobal() {
    for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    var serialized = serializeStyles(args, cache.registered);
    insertWithoutScoping(cache, serialized);
  };

  var cx = function cx() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    return merge(cache.registered, css, classnames(args));
  };

  return {
    css: css,
    cx: cx,
    injectGlobal: injectGlobal,
    keyframes: keyframes,
    hydrate: function hydrate(ids) {
      ids.forEach(function (key) {
        cache.inserted[key] = true;
      });
    },
    flush: function flush() {
      cache.registered = {};
      cache.inserted = {};
      cache.sheet.flush();
    },
    // $FlowFixMe
    sheet: cache.sheet,
    cache: cache,
    getRegisteredStyles: getRegisteredStyles.bind(null, cache.registered),
    merge: merge.bind(null, cache.registered, css)
  };
};

var classnames = function classnames(args) {
  var cls = '';

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    if (arg == null) continue;
    var toAdd = void 0;

    switch (typeof arg) {
      case 'boolean':
        break;

      case 'object':
        {
          if (Array.isArray(arg)) {
            toAdd = classnames(arg);
          } else {
            toAdd = '';

            for (var k in arg) {
              if (arg[k] && k) {
                toAdd && (toAdd += ' ');
                toAdd += k;
              }
            }
          }

          break;
        }

      default:
        {
          toAdd = arg;
        }
    }

    if (toAdd) {
      cls && (cls += ' ');
      cls += toAdd;
    }
  }

  return cls;
};

var _createEmotion = createEmotion({
  key: 'css'
}),
    css = _createEmotion.css;

const _tmpl$ = /*#__PURE__*/template(`<ul></ul>`),
      _tmpl$2 = /*#__PURE__*/template(`<li></li>`),
      _tmpl$3 = /*#__PURE__*/template(`<input autofocus placeholder="Search">`),
      _tmpl$4 = /*#__PURE__*/template(`<div></div>`);
const container = css`
  --border-color: #eee;
  --padding:10px;
  border-radius: 6px;
  overflow:hidden;
  padding: var(--padding);
  border: 1px solid var(--border-color);
  background-color: white;
`;
const input = css`
  box-sizing: border-box;
  width: 100%;
  font-size: 20px;
  border:none;
  border-bottom: 1px solid var(--border-color);
  padding-block: 6px;
  &:active, &:focus {
    outline: none;
  }
  margin-bottom: 10px;
`;
const selectedItem = css`
  background-color: #eee;
`;
const list = css`
  max-height: 300px;
  overflow: auto;
  padding: 0;
  margin: 0;
  li {
  display: block;
  text-align: left;
    padding-block: 6px;
  }
`;
const SearchList = props => {
  const [preselected, setPreselected] = createSignal(0);
  const [keywords, setKeywords] = createSignal('');

  const filtered = () => {
    return props.data.filter(i => props.isMatch(keywords(), i));
  };

  const ul = (() => {
    const _el$ = _tmpl$.cloneNode(true);

    className(_el$, list);

    insert(_el$, createComponent(For, {
      get each() {
        return filtered();
      },

      children: (item, index) => {
        return (() => {
          const _el$2 = _tmpl$2.cloneNode(true);

          insert(_el$2, () => props.text(item));

          createRenderEffect(_p$ => {
            const _v$ = index() === preselected() ? selectedItem : '',
                  _v$2 = index();

            _v$ !== _p$._v$ && className(_el$2, _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$2, "data-index", _p$._v$2 = _v$2);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined
          });

          return _el$2;
        })();
      }
    }));

    return _el$;
  })(); //sync preselected with filtered


  createEffect(() => {
    const length = filtered().length;
    const index = preselected();

    if (index >= length) {
      setPreselected(Math.max(length - 1, 0));
    }
  });
  createEffect(() => {
    const index = preselected();
    ul.querySelector(`li[data-index="${index}"]`)?.scrollIntoView();
  });
  onMount(() => {
    const keydown = e => {
      if (e.key === 'Escape') {
        props.onCancel?.();
        e.stopPropagation();
        return;
      }

      updatePreselectedByKeydown(e);
    };

    document.addEventListener('keydown', keydown, {
      capture: true
    });
    onCleanup(() => {
      document.removeEventListener('keydown', keydown);
    });
  });

  const updatePreselectedByKeydown = e => {
    const newIndex = K(e.key).with("ArrowDown", () => {
      e.stopPropagation();
      const current = preselected();
      const newIndex = current + 1;

      if (newIndex >= filtered().length) {
        return current;
      }

      return newIndex;
    }).with("ArrowUp", () => {
      e.stopPropagation();
      const current = preselected();
      const newIndex = current - 1;

      if (newIndex <= 0) {
        return 0;
      }

      return newIndex;
    }).otherwise(() => preselected());
    setPreselected(newIndex);
  };

  const select = () => {
    const index = preselected();
    const items = filtered();
    const item = items[index];

    if (item) {
      props.onSelect(item);
    }
  };

  const inputEl = (() => {
    const _el$3 = _tmpl$3.cloneNode(true);

    _el$3.$$keydown = e => {
      if (e.key === 'Enter') {
        setTimeout(select);
      }
    };

    _el$3.$$input = e => setKeywords(e.currentTarget.value);

    className(_el$3, input);

    createRenderEffect(() => _el$3.value = keywords());

    return _el$3;
  })();

  onMount(() => {
    inputEl.focus();
  });
  return (() => {
    const _el$4 = _tmpl$4.cloneNode(true);

    insert(_el$4, inputEl, null);

    insert(_el$4, ul, null);

    createRenderEffect(() => className(_el$4, container + ' ' + props.class));

    return _el$4;
  })();
};

delegateEvents(["input", "keydown"]);

var webPinyin = {exports: {}};

var dictZiWeb = {
"a":"",
"ā":"吖锕錒",
"á":"嗄",
"ǎ":"",
"à":"",
"āi":"哎哀埃娭溾嗳銰锿噯諰鎄",
"ái":"啀娾捱皑凒隑嵦溰嘊敱敳皚磑癌",
"ǎi":"毐昹娾欸絠嗳矮蔼躷噯濭藹譪霭靄",
"ài":"艾伌欬爱砹硋堨焥隘嗌嗳塧嫒愛碍叆暧瑷僾噯壒嬡懓薆鴱懝曖璦賹餲皧瞹馤礙譺鑀鱫靉",
"ān":"安侒峖桉氨偣庵菴谙啽媕萻葊痷腤裺鹌蓭誝鞍鞌盦諳馣鮟盫鵪韽鶕",
"án":"玵啽雸儑",
"ǎn":"垵俺唵埯铵揞晻罯銨",
"àn":"厈屵屽犴岸咹按洝荌案胺豻堓隌晻暗貋儑錌闇黯",
"āng":"肮骯",
"áng":"卬岇昂昻",
"ǎng":"",
"àng":"枊盎醠",
"āo":"泑柪眑梎軪熝爊",
"áo":"敖厫隞嗷嗸嶅廒慠滶獓蔜遨骜摮獒璈磝墽翱聱螯翶謷謸翺鳌鏕鏖鰲鷔鼇",
"ǎo":"艹抝芺袄眑郩镺媪媼襖",
"ào":"岙扷抝坳垇岰柪傲奡軪奧嫯嶅慠澚隩墺嶴懊擙澳鏊驁",
"ba":"罷",
"bā":"丷八仈巴叭朳玐夿岜扷芭峇柭疤哱哵捌笆粑羓蚆釟豝鲃魞",
"bá":"叐犮抜妭拔茇炦癹胈菝詙跋軷颰魃鼥",
"bǎ":"钯鈀靶",
"bà":"坝弝爸皅垻跁鲃魞鲅鲌罷鮁鮊覇矲霸壩灞欛",
"bāi":"挀掰擘",
"bái":"白",
"bǎi":"百佰栢瓸捭竡粨絔摆擺襬",
"bài":"呗庍拝败拜唄敗猈稗粺薭贁韛",
"bān":"扳攽朌肦班般颁斑搬斒頒搫瘢鳻螌褩癍辬",
"bǎn":"阪坂岅昄板版瓪钣粄舨鈑蝂魬闆",
"bàn":"办半伴扮坢姅怑绊柈秚湴絆跘鉡靽辦瓣",
"bāng":"邦垹帮捠梆浜邫幇幚縍幫鞤",
"bǎng":"绑綁牓膀髈",
"bàng":"玤挷蚄傍棒棓硥谤塝搒稖蒡蛖蜯镑縍艕謗鎊",
"bāo":"勹包佨孢苞枹胞剝笣煲龅裦蕔褒襃闁齙",
"báo":"窇雹",
"bǎo":"宝怉饱保鸨宲珤堢媬葆寚飹飽褓駂鳵緥鴇賲藵寳寶靌",
"bào":"勽犳报怉抱豹趵铇菢蚫袌報鉋鲍骲髱虣鮑儤曓嚗曝爆犦忁鑤",
"bei":"呗唄",
"bēi":"陂卑杯柸盃庳桮悲揹棓椑碑鹎箄諀鞞藣鵯",
"běi":"鉳",
"bèi":"贝孛狈貝邶备昁杮牬苝郥钡俻倍悖狽偝偹梖珼鄁備僃惫棑棓焙琲軰辈愂碚禙蓓蛽犕褙誖鞁骳輩鋇憊糒鞴鐾",
"bēn":"泍贲栟喯犇賁锛漰錛蟦",
"běn":"夲本苯奙畚翉楍",
"bèn":"坋坌泍炃倴捹桳渀笨逩撪",
"bēng":"伻祊奟崩絣閍嗙嵭痭嘣綳繃",
"béng":"甮甭",
"běng":"埄埲菶琣琫綳繃鞛",
"bèng":"泵迸堋逬揼跰塴綳甏镚繃蹦鏰",
"bī":"皀屄偪毴逼楅榌豍螕鵖鲾鎞鰏",
"bí":"荸鼻嬶",
"bǐ":"匕比夶朼佊吡妣沘疕纰彼毞肶柀秕俾娝笔粃紕舭啚崥筆鄙聛貏",
"bì":"币必毕闬闭佖坒庇芘诐邲咇妼怭怶畁畀肶苾哔柲毖珌畐疪祕胇荜贲陛毙狴畢笓粊袐铋婢敝旇梐紴翍萆萞閇閈閉堛弼弻愊愎湢皕禆筚詖貱賁赑嗶彃滗滭煏痺痹睤睥腷蓖蓽蜌裨跸鉍閟飶幣弊熚獙碧稫箅箆綼蔽鄪馝幤潷獘罼襅駜髲壁嬖廦篦篳縪薜觱避鮅斃濞蹕鞞髀奰璧鄨鎞鏎饆繴襣襞鞸韠魓躃躄驆鶝朇贔鐴鷝鷩鼊",
"biān":"辺边炞砭笾猵编萹煸牑甂箯糄編臱蝙鞕獱邉鍽鳊邊鞭鯾鯿籓籩",
"biǎn":"贬疺窆匾貶惼揙碥稨褊糄鴘藊覵鶣",
"biàn":"卞弁忭抃汳汴苄釆变峅玣変昪覍徧缏遍閞辡緶艑諚辧辨辩辫辮辯變",
"biāo":"灬杓标飑骉髟彪淲猋脿颩僄墂幖摽滮蔈颮骠標熛膔膘麃瘭磦镖飚飙儦檦篻颷瀌藨謤爂臕贆鏢穮镳飈飆飊飇鑣驫",
"biáo":"嫑",
"biǎo":"表婊裱諘褾錶檦",
"biào":"俵摽鳔",
"biē":"柭憋蟞癟鳖鱉鼈虌龞",
"bié":"別柲莂蛂徶襒蟞蹩",
"biě":"癟",
"biè":"別彆",
"bīn":"汃邠玢砏宾彬梹傧斌椕滨缤槟瑸豩賓賔镔儐濒頻濱濵虨豳檳璸瀕霦繽鑌顮",
"bǐn":"",
"bìn":"摈殡膑髩儐擯鬂殯臏髌鬓髕鬢",
"bīng":"冫仌仒氷冰兵幷栟掤梹蛃絣槟鋲檳",
"bǐng":"丙邴陃怲抦秉苪昞昺柄炳饼眪偋屛寎棅琕禀稟鈵鉼鞆餅餠鞞鞸",
"bìng":"並併幷枋垪庰倂栤病窉竝偋傡寎摒誁鮩靐",
"bo":"啵蔔噃",
"bō":"癶拨波癷玻剝哱盋砵趵钵饽紴缽菠袰溊碆鉢僠嶓撥播餑磻礡蹳皪驋鱍",
"bó":"仢彴肑驳帛狛瓝苩侼柭胉郣亳挬浡瓟秡袯钹铂桲淿脖舶萡袹博殕渤葧鹁愽搏猼鉑鈸馎鲌僰榑煿牔箔膊艊誖馛駁踣鋍镈壆馞駮鮊穛襏謈嚗懪簙鎛餺鵓糪髆髉欂襮礴鑮",
"bǒ":"癷蚾跛",
"bò":"孹擗擘檗檘譒蘗",
"bū":"峬庯逋钸晡鈽誧餔錻鯆鵏",
"bú":"鳪轐醭",
"bǔ":"卟补哺捕捬補鸔",
"bù":"布佈吥步咘怖抪歩歨柨钚勏埔埗悑捗荹部埠婄瓿鈈廍蔀箁踄郶篰餢",
"cā":"嚓擦攃",
"cǎ":"礤礸",
"cà":"遪囃",
"cāi":"偲猜",
"cái":"才扐材财財裁纔",
"cǎi":"毝倸啋埰婇寀彩採棌睬跴綵踩",
"cài":"埰寀菜蔡縩",
"cān":"參叄飡骖叅喰湌傪嬠餐爘驂囋",
"cán":"残蚕惭殘慚摲蝅慙蠺蠶",
"cǎn":"惨朁慘憯穇篸黪黲",
"càn":"灿孱傪粲嘇摻儏澯薒燦璨謲鏒",
"cāng":"仓仺伧沧苍玱鸧倉舱傖凔嵢滄獊蒼瑲濸篬艙螥鶬",
"cáng":"匨臧欌鑶",
"càng":"賶",
"cāo":"撡操糙",
"cáo":"曺曹傮嘈嶆慒漕蓸槽褿艚螬鏪",
"cǎo":"屮艸草愺慅懆騲",
"cào":"肏鄵襙鼜",
"cè":"夨冊册厕恻拺测荝敇畟側厠笧粣萗廁惻測策萴筞筴蓛箣憡簎",
"cēn":"參叄叅嵾穇篸",
"cén":"岑汵埁涔笒",
"cēng":"噌",
"céng":"层曽層嶒橧竲驓",
"cèng":"蹭",
"cī":"呰呲玼疵趀偨跐縒骴髊蠀齹",
"cí":"词珁兹垐柌祠茨瓷粢詞辝慈甆辞磁雌鹚糍辤飺餈嬨濨薋鴜礠辭鷀鶿",
"cǐ":"此佌泚玼皉啙跐鮆",
"cì":"朿次佽刾庛茦栨莿絘蛓赐螆賜",
"cōng":"匆囪囱苁忩枞茐怱悤棇焧葱楤漗聡蓯蔥骢暰樅樬潨熜瑽璁聦聪瞛篵聰蟌鍯繱鏓鏦騘驄",
"cóng":"丛徔従婃孮徖從悰淙琮碂慒漎潀潈誴賨賩樷錝藂叢灇欉爜",
"cǒng":"",
"còng":"愡憁謥",
"cōu":"",
"cóu":"",
"cǒu":"",
"còu":"凑湊傶楱腠辏輳",
"cū":"怚粗觕麁麄橻麆麤",
"cú":"徂殂",
"cǔ":"皻",
"cù":"促猝脨媨瘄蔟誎趗噈憱踧醋瘯踿簇縬趨鼀蹙蹵蹴顣",
"cuān":"汆撺鋑镩蹿攛躥鑹",
"cuán":"濽櫕巑攢灒欑穳",
"cuàn":"窜殩熶窽篡窾簒竄爨",
"cuī":"隹崔脺催凗嵟缞墔慛摧榱漼槯磪縗鏙",
"cuǐ":"漼熣璀趡皠",
"cuì":"伜忰疩倅粋紣翆脃脆啐啛崒悴淬萃椊毳焠琗瘁粹綷翠膵膬濢竁襊顇臎",
"cūn":"邨村皴踆澊竴膥",
"cún":"存侟拵壿澊",
"cǔn":"刌忖",
"cùn":"寸吋籿",
"cuō":"搓瑳遳磋蹉醝鎈",
"cuó":"虘嵯嵳痤睉矬蒫瘥蔖鹾酂鹺酇",
"cuǒ":"脞",
"cuò":"剉剒厝夎挫莡莝庴措逪锉蓌错縒諎銼錯",
"chā":"扠扱芆臿挿偛嗏插揷馇銟锸艖疀嚓鍤鎈餷",
"chá":"秅苴垞査茬茶捈梌嵖搽猹靫楂槎詧察摖檫",
"chǎ":"紁蹅镲鑔",
"chà":"仛奼汊岔侘衩诧剎姹紁詫",
"chāi":"芆肞钗釵",
"chái":"犲侪柴豺祡喍儕",
"chǎi":"茝",
"chài":"虿袃訍瘥蠆囆",
"chān":"辿觇梴搀覘裧摻緂鋓幨襜攙",
"chán":"苂婵谗單孱棎湹禅馋煘缠僝嶃嶄獑蝉誗鋋儃嬋廛潹潺緾澶磛禪毚螹蟐鄽瀍繟蟬儳劖繵蟾酁嚵壥巉瀺欃纏纒躔镵艬讒鑱饞",
"chǎn":"产刬旵丳斺浐剗谄啴產産铲阐蒇剷嵼摌滻嘽幝蕆諂閳骣燀簅冁繟醦譂鏟闡囅灛讇",
"chàn":"忏刬剗硟摲幝幨燀懴儳懺羼韂顫",
"chāng":"伥昌倀娼淐猖菖阊椙琩裮锠錩閶鲳闛鯧鼚",
"cháng":"仩仧兏肠苌镸長尝偿常徜瓺萇場甞腸嘗塲嫦瑺膓償嚐鲿鱨",
"chǎng":"昶惝場敞僘厰塲廠氅鋹",
"chàng":"怅玚畅鬯唱悵焻瑒暢畼誯韔",
"chāo":"抄弨怊欩钞訬焯超鈔勦摷綽劋樔窼",
"cháo":"牊晁巣巢鄛鼌漅樔潮窲罺鼂轈謿",
"chǎo":"炒眧粆焣煼槱麨巐",
"chào":"仦仯耖觘",
"chē":"伡車俥砗唓莗硨蛼",
"ché":"",
"chě":"扯偖撦奲",
"chè":"屮彻呫坼迠烢烲焎聅掣揊硩頙徹摰撤澈勶瞮爡",
"chen":"伧傖",
"chēn":"肜抻郴捵棽琛嗔綝瘨瞋諃賝謓",
"chén":"尘臣忱沉辰陈迧茞宸栕莀莐陳敐晨桭梣訦谌軙愖跈鈂煁蔯塵敶樄瘎霃螴諶薼麎曟鷐",
"chěn":"趻硶碜墋夦磣踸鍖贂醦",
"chèn":"衬爯疢龀偁趂趁榇稱齓齔儭嚫穪谶櫬襯讖",
"chēng":"朾阷泟柽爯凈棦浾琤偁淨碀蛏晿牚搶赪僜憆摚稱靗撐撑緽橖橕瞠赬頳檉竀罉鎗矃穪蟶鏿鐣饓鐺",
"chéng":"氶丞成朾呈承枨诚郕乗城埩娍宬峸洆荿埕挰晟浧珹掁珵窚脭铖堘惩揨棖椉程筬絾裎塍塖溗誠畻酲鋮憕撜澂橙檙鯎瀓懲騬",
"chěng":"侱徎悜逞骋庱睈裎騁",
"chèng":"秤牚稱竀穪",
"chi":"麶",
"chī":"吃妛哧彨胵蚩鸱瓻眵笞粚喫訵嗤媸摛痴絺樆噄殦瞝誺噭螭鴟鵄癡魑齝攡彲黐",
"chí":"弛池驰迟坻沶狋茌迡持柢竾荎俿歭耛菭蚳赿筂貾遅跢遟馳箈箎墀徲漦踟遲篪謘鍉邌鶗鶙",
"chǐ":"叺伬扡呎肔侈卶齿垑奓拸胣恥耻蚇袳豉欼歯袲裭誃鉹褫齒",
"chì":"彳叱斥佁杘灻赤饬侙抶勅恜柅炽勑捇眙翄翅敕烾啻湁飭傺痸腟誃鉓雴憏瘈翤遫銐慗慸瘛翨熾懘趩鶒鷘",
"chōng":"充忡沖茺浺珫翀舂嘃摏徸憃憧衝罿艟蹖",
"chóng":"虫崈崇痋隀漴褈緟蝩蟲爞",
"chǒng":"宠埫寵",
"chòng":"铳揰銃",
"chou":"鮘",
"chōu":"抽牰婤掫紬搊跾瘳篘醔犨犫",
"chóu":"怞俦诪帱栦惆梼畤紬绸菗椆畴絒愁皗稠筹裯詶酧酬綢踌儔雔嚋嬦幬懤盩薵檮燽雠疇籌躊醻讐讎雦",
"chǒu":"丒丑吜杽杻偢瞅醜矁魗",
"chòu":"臰遚殠",
"chu":"橻",
"chū":"出岀初榋摢摴樗貙櫖齣",
"chú":"刍除芻耝厨滁蒢豠锄媰耡蒭蜍趎鉏雏犓廚篨鋤橱幮櫉藸蟵躇雛櫥蹰鶵躕",
"chǔ":"処杵础椘處储楮禇楚褚濋儲檚璴礎齭齼",
"chù":"亍処竌怵泏绌豖欪炪竐俶敊埱珿絀菆傗鄐慉搐滀触閦儊嘼諔憷斶歜臅黜觸矗",
"chuā":"欻",
"chuǎ":"",
"chuà":"",
"chuāi":"搋",
"chuái":"膗",
"chuǎi":"",
"chuài":"啜欼膪踹",
"chuān":"巛川氚穿猭瑏",
"chuán":"舡舩剶船圌遄傳椯椽歂暷篅膞輲",
"chuǎn":"舛荈喘堾歂僢踳",
"chuàn":"汌串玔钏釧猭賗鶨",
"chuāng":"刅疮窓創窗牎摐牕瘡窻",
"chuáng":"床牀喠噇朣橦",
"chuǎng":"闯傸磢闖",
"chuàng":"怆刱剏剙創愴",
"chuī":"吹炊龡",
"chuí":"垂倕埀桘陲捶菙圌搥棰腄槌硾锤箠錘鎚顀",
"chuǐ":"",
"chuì":"惙",
"chūn":"芚旾杶春萅媋暙椿槆瑃箺蝽橁輴櫄鰆鶞",
"chún":"纯肫陙唇浱純莼脣湻犉滣蒓鹑漘蓴膞醇醕錞鯙鶉",
"chǔn":"朐偆萶惷睶賰蠢",
"chuō":"逴趠踔戳繛",
"chuò":"辶吷辵拺哾娖娕啜婥婼惙涰淖辍酫綽踀箹輟鋜龊擉磭餟繛歠鏃嚽齪鑡孎",
"da":"繨",
"dā":"咑哒耷笚嗒搭褡噠墶撘鎝鎉",
"dá":"达迏迖迚呾妲怛沓垯炟羍荅荙畗剳匒惮畣笪逹溚詚達跶靼憚薘鞑燵蟽鐽韃龖龘",
"dǎ":"",
"dà":"亣汏眔",
"dāi":"呆呔獃懛",
"dǎi":"歹逮傣",
"dài":"代诒轪侢垈岱帒甙绐迨带怠柋殆玳贷帯貣軑埭帶紿蚮袋軚逮釱棣詒貸軩瑇跢廗箉叇曃緿蝳駘鮘鴏戴艜黛簤蹛瀻霴襶黱靆",
"dān":"丹妉単眈砃耼耽郸聃躭酖單媅愖殚瘅匰箪褝鄲頕儋勯擔殫甔癉襌簞聸",
"dǎn":"伔刐抌玬瓭胆衴疸紞赕亶馾撢撣賧燀黕膽皽黵",
"dàn":"旦但帎呾沊泹狚诞唌柦疍訑啗啖惔惮淡萏蛋啿弾氮腅蜑觛亶瘅窞蓞誕僤噉馾髧儋嘾彈憚醈憺擔澹禫餤駳鴠癉膻癚嚪繵贉霮饏黮",
"dāng":"珰裆筜當儅噹澢璫襠簹艡蟷鐺闣",
"dǎng":"党谠當擋譡黨攩灙欓讜",
"dàng":"氹凼圵宕砀垱荡档偒菪婸崵愓瓽逿嵣當雼潒碭儅瞊蕩趤壋擋檔璗盪礑簜蘯闣",
"dāo":"刀刂忉朷氘舠釖鱽裯魛螩",
"dáo":"捯",
"dǎo":"导岛陦島捣祷禂搗隝嘄嶋嶌槝導隯壔嶹擣蹈檮禱",
"dào":"辺到帱悼梼焘盗菿椡盜絩道稲箌翢噵稻艔衜檤衟幬燾翿軇瓙纛",
"de":"旳",
"dē":"嘚",
"dé":"恴淂蚮悳惪棏锝徳德鍀",
"dēi":"嘚",
"děi":"",
"dèn":"扥扽",
"dēng":"灯登豋僜噔嬁燈璒竳簦艠蹬",
"děng":"等戥",
"dèng":"邓凳鄧隥墱嶝憕瞪磴镫櫈瀓覴鐙",
"dī":"氐仾低奃岻彽秪袛啲埞羝隄堤渧趆滴碮樀磾鞮鏑",
"dí":"扚廸旳狄肑籴苖迪唙敌浟涤荻啇梑笛觌靮滌蓧馰髢嘀嫡翟蔋蔐頔敵篴镝嚁藡豴蹢鏑糴覿鸐",
"dǐ":"氐厎坘诋邸阺呧坻弤抵拞枑柢牴砥掋菧觝詆軧楴聜骶鯳",
"dì":"坔旳杕玓怟枤苐俤哋埅帝埊娣逓递偙梊焍珶眱祶第菂谛釱媂揥棣渧睇缔蒂遆僀楴禘腣遞鉪墆墑墬嵽摕疐碲蔕蝃遰慸甋締蝭嶳諦諟踶螮",
"diǎ":"嗲",
"diān":"佔敁掂傎厧嵮滇槇槙瘨窴颠蹎巅顚顛癫巓攧巔癲齻",
"dián":"",
"diǎn":"典奌点婰敟椣跕碘蒧蕇踮點嚸",
"diàn":"电阽坫店垫扂玷痁钿婝惦淀奠琔殿痶蜔鈿電墊壂橂橝澱靛磹癜簟驔",
"diāo":"刁叼汈刟虭凋奝弴彫蛁椆琱貂碉鳭瞗錭雕鮉鲷簓鼦鯛鵰",
"diǎo":"扚屌鳥",
"diào":"弔伄吊钓盄窎訋掉釣铞铫絩鈟竨蓧誂銚銱雿魡調瘹窵鋽藋鑃",
"diē":"爹跌褺",
"dié":"佚怢泆苵迭咥垤峌恎挕昳柣绖胅瓞眣耊啑戜眰谍喋堞崼幉惵揲畳絰耋臷詄趃跕軼镻叠楪殜牃牒跮嵽碟蜨褋槢艓蝶疂諜蹀鴩螲鲽鞢曡疉鰈疊氎",
"diě":"",
"diè":"哋",
"dīng":"仃叮奵帄玎甼町疔盯耵虰酊釘靪",
"dǐng":"奵艼顶酊頂鼎嵿鼑濎薡鐤",
"dìng":"订忊饤矴定訂釘飣啶掟萣铤椗腚碇锭碠聢蝊鋌錠磸顁",
"diū":"丟丢铥颩銩",
"dōng":"东冬咚岽東苳昸氡倲鸫埬娻崬崠涷笗菄徚氭蝀鮗鼕鯟鶇鶫",
"dǒng":"揰董墥嬞懂箽蕫諌",
"dòng":"动冻侗垌姛峒恫挏栋洞狪胨迵凍戙烔胴動娻崠硐棟湩絧腖働勭燑駧霘",
"dōu":"吺枓侸唗兜兠蔸橷瞗篼",
"dóu":"唞",
"dǒu":"乧阧抖钭陡蚪鈄",
"dòu":"吋豆郖浢狵荳逗饾鬥梪毭渎脰酘痘閗窦鬦鋀餖斣瀆闘竇鬪鬬鬭",
"dū":"厾剢阇嘟督醏闍",
"dú":"独涜渎椟牍犊裻読獨錖凟匵嬻瀆櫝殰牘犢瓄皾騳黩讀豄贕韣髑鑟韇韥黷讟",
"dǔ":"竺笃堵暏琽赌睹覩賭篤",
"dù":"芏妒杜妬姤荰秺晵渡靯镀螙斁殬鍍蠧蠹",
"duān":"耑偳剬媏端褍鍴",
"duǎn":"短",
"duàn":"段断塅缎葮椴煅瑖腶碫锻緞毈簖鍛斷躖籪",
"duī":"垖堆塠痽磓镦鴭鐓鐜",
"duǐ":"啍頧",
"duì":"队对兊兌対杸祋怼陮敓敚隊碓綐對憞憝濧濻薱懟瀢瀩譈譵轛",
"dūn":"吨惇蜳墪墫墩撴獤噸撉橔犜礅蹾蹲驐",
"dǔn":"盹趸躉",
"dùn":"伅坉庉忳沌炖盾砘逇钝顿遁鈍楯頓碷遯憞潡燉踲",
"duo":"",
"duō":"夛多咄哆畓剟掇敠敪毲裰跢嚉",
"duó":"仛夺沰铎剫敓敚喥痥鈬奪凙踱鐸",
"duǒ":"朵朶哚垜挆埵崜缍袳椯硾趓躱躲綞亸軃鬌嚲奲",
"duò":"杕杝刴剁枤沲陊陏饳垜尮挆挅柁柂柮桗舵隋媠惰隓跢跥跺飿馱墮憜駄墯隳鵽",
"ē":"妸妿娿婀屙痾",
"é":"讹吪囮迗俄峉哦娥峩峨涐莪珴訛皒睋鈋锇鹅磀誐鋨頟额魤額鵞鵝譌",
"ě":"枙娿砨惡頋噁騀鵈",
"è":"厄戹歺岋阨呃扼苊阸呝枙砐轭咢咹垩姶洝砈匎敋蚅饿偔卾堊娾悪硆谔軛鄂阏堮堨崿惡愕湂萼豟軶遌遏鈪廅搕搤搹琧痷腭僫蝁锷鹗蕚遻頞颚餓噩擜覨諤閼餩鍔鳄歞顎礘櫮鰐鶚鰪讍齃鑩齶鱷",
"ēi":"诶欸誒",
"éi":"诶欸誒",
"ěi":"诶欸誒",
"èi":"诶欸誒",
"ēn":"奀恩蒽煾",
"ěn":"峎",
"èn":"摁",
"ēng":"鞥",
"ér":"儿而児杒侕兒陑峏洏耏荋栭胹唲梕袻鸸粫聏輀鲕隭髵鮞鴯轜",
"ěr":"尒尓尔耳迩洱饵栮毦珥铒衈爾鉺餌駬薾邇趰",
"èr":"二弍弐佴刵咡贰貮貳誀樲髶",
"fā":"冹沷発發彂醗醱",
"fá":"乏伐姂坺垡浌疺罚茷阀栰笩傠筏瞂罰閥墢罸橃藅",
"fǎ":"佱法峜砝鍅灋",
"fà":"珐琺髪蕟髮",
"fān":"帆忛犿拚畨勫噃嬏幡憣旙旛繙翻藩轓颿籓飜鱕",
"fán":"凢凣凡匥杋柉矾籵钒舤烦舧笲釩棥煩緐墦樊蕃燔璠膰薠襎羳蹯瀿礬蘩鐇鐢蠜鷭",
"fǎn":"反払仮返橎",
"fàn":"氾犯奿汎泛饭范贩畈訉軓婏桳梵盕笵販軬飰飯滼嬎範輽瀪",
"fāng":"匚方邡汸芳枋牥祊钫淓蚄堏趽鈁錺鴋",
"fáng":"防妨房肪埅鲂魴",
"fǎng":"仿访彷纺昉昘瓬眆倣旊眪紡舫訪髣鶭",
"fàng":"放趽",
"fēi":"飞妃非飛啡婓婔渄绯扉斐暃猆靟裶緋蜚霏鲱餥馡騑騛鯡飝",
"féi":"肥疿淝腓痱蜰",
"fěi":"朏胐匪诽奜悱斐棐榧翡蕜誹篚",
"fèi":"吠犻芾废杮柹沸狒肺胏昲胇费俷剕厞疿砩陫屝笰萉廃費痱镄廢曊橃橨癈鼣濷蟦櫠鐨靅",
"fēn":"吩帉纷芬昐氛玢砏竕衯紛翂梤棻訜躮酚鈖雰馚朆餴饙",
"fén":"坆坟妢岎汾朌枌炃羒蚠蚡棼焚蒶隫墳幩濆獖蕡魵鳻橨燌燓豮鼢羵鼖豶轒鐼馩黂",
"fěn":"粉黺",
"fèn":"坋弅奋忿秎偾愤粪僨憤獖瞓奮橨膹糞鲼瀵鱝",
"fēng":"丰仹凨凬夆妦沣沨凮枫炐封疯盽砜風埄峰峯莑偑桻烽琒堼崶渢猦葑锋楓犎蜂熢瘋碸僼篈鄷鋒檒豐鎽鏠酆寷灃蘴霻蠭靊飌麷",
"féng":"夆浲逢堸溄馮摓漨綘艂縫",
"fěng":"讽風覂唪諷",
"fèng":"凤奉俸桻湗焨煈赗鳯鳳鴌縫賵",
"fó":"仏仸坲梻",
"fōu":"",
"fóu":"紑",
"fǒu":"缶妚炰缹缻殕雬鴀",
"fū":"伕邞呋妋抙姇枎玞肤怤柎砆胕荂衭娐尃捊荴旉琈紨趺酜麸稃跗鈇筟綒鄜孵粰蓲敷膚鳺麩糐麬麱懯璷",
"fú":"乀巿弗払伏凫甶刜孚扶芣芙芾咈姇宓岪帗怫枎泭绂绋苻茀俘垘枹柫柭氟洑炥玸畉畐祓罘胕茯郛韨鳬哹垺栿浮畗砩莩蚨袚匐桴涪烰琈符笰紱紼翇艴菔虙袱幅棴絥罦葍福綍艀蜉辐鉘鉜颫鳧榑稪箁箙粰褔豧韍颰幞澓蝠髴鴔諨踾輻鮄癁襆鮲黻襥鵩纀鶝",
"fǔ":"阝呒抚甫乶府弣拊斧俌俛柎郙俯蚥釡釜捬脯辅椨焤盙腑滏蜅腐輔嘸撫頫鬴簠黼",
"fù":"讣付妇负附咐坿彿竎阜驸复峊柎洑祔訃負赴蚥袝偩冨婏婦捬紨蚹傅媍富復秿萯蛗覄詂赋椱缚腹鲋榑禣複褔赙緮蕧蝜蝮賦駙嬔縛輹鮒賻鍑鍢鳆覆馥鰒",
"gā":"旮伽夾嘎嘠",
"gá":"钆軋尜釓嘎嘠噶錷",
"gǎ":"尕玍朒嘎嘠",
"gà":"尬魀",
"gāi":"侅该郂陔垓姟峐荄晐赅畡祴絯隑該豥賅賌",
"gǎi":"忋改絠",
"gài":"丐乢匄匃杚钙摡溉葢鈣戤概槩蓋漑槪瓂",
"gān":"甘忓迀攼玕肝咁坩泔矸苷柑玵竿疳酐粓凲尲尴筸漧鳱尶尷魐",
"gǎn":"仠芉皯秆衦赶敢桿稈感澉趕橄擀澸篢簳鳡鱤",
"gàn":"佄旰汵盰绀倝凎淦紺詌骭幹榦檊簳贑赣贛灨",
"gāng":"冈冮刚纲肛岡牨疘矼缸剛罡堈崗掆釭棡犅堽摃碙綱罁鋼鎠",
"gǎng":"岗犺崗",
"gàng":"焵焹筻槓鋼戅戆戇",
"gāo":"皋羔羙高皐髙臯睪槔睾槹獋橰篙糕餻櫜韟鷎鼛鷱",
"gǎo":"夰杲菒稁搞缟槀槁稾稿镐縞藁檺藳鎬",
"gào":"吿告勂诰郜峼祮祰锆筶禞誥鋯",
"gē":"戈仡圪扢犵纥戓肐牫咯紇饹哥袼鸽割彁滒戨歌鴚擱謌鴿鎶",
"gé":"呄佮佫匌挌阁革敋格鬲愅猲臵蛒裓隔颌嗝塥滆觡搿槅膈閣閤獦镉鞈韐骼臈諽輵擱鮥鮯櫊鎑鎘韚轕鞷騔",
"gě":"個哿笴舸嘅嗰蓋鲄",
"gè":"亇吤茖虼個硌铬箇鉻",
"gěi":"給",
"gēn":"根跟",
"gén":"哏",
"gěn":"",
"gèn":"亙亘艮茛揯搄",
"gēng":"刯庚畊浭耕菮椩焿絙絚赓鹒緪縆羮賡羹鶊",
"gěng":"郠哽埂峺挭绠耿莄梗綆鲠骾鯁",
"gèng":"堩緪縆",
"gōng":"工弓公厷功攻杛侊糿糼肱宫紅宮恭躬龚匑塨幊愩觥躳慐匔碽篢髸觵龏龔",
"gǒng":"廾巩汞拱唝拲栱珙嗊輁澒銾鞏",
"gòng":"贡羾唝貢嗊愩慐熕",
"gōu":"佝沟芶钩痀袧缑鈎溝鉤緱褠篝簼鞲韝",
"gǒu":"芶岣狗苟枸玽耉耇笱耈蚼豿",
"gòu":"呴坸构诟购垢姤冓啂夠够傋訽媾彀搆詬遘雊構煹觏撀糓覯購",
"gū":"杚呱咕姑孤沽泒苽巭巬柧轱唃唂罛鸪笟菇菰蛄蓇觚軱軲辜酤稒鈲磆箍箛嫴篐橭鮕鴣",
"gú":"",
"gǔ":"夃古扢抇汩诂谷股牯罟羖逧钴傦啒淈脵蛊嗗尳愲詁馉毂賈鈷鼔鼓嘏榖皷鹘穀縎糓薣濲皼臌轂餶櫎瀔盬瞽鶻蠱",
"gù":"固怘故凅顾堌崓崮梏牿棝祻雇榾痼锢僱錮鲴鯝顧",
"guā":"瓜刮呱胍栝桰铦鸹歄煱颪趏劀緺銛諣踻銽颳鴰騧",
"guá":"",
"guǎ":"冎叧呙呱咼剐剮寡",
"guà":"卦坬诖挂啩掛罣袿絓罫褂詿",
"guāi":"乖",
"guái":"叏",
"guǎi":"拐枴柺罫箉",
"guài":"夬怪恠",
"guān":"关纶官矜覌倌矝莞涫棺蒄窤閞綸関瘝癏観闗鳏關鰥觀鱞",
"guǎn":"莞馆琯痯筦斡管輨璭舘錧館鳤",
"guàn":"卝毌丱贯泴覌悺惯掼淉貫悹祼慣摜潅遦樌盥罆雚観躀鏆灌爟瓘矔礶鹳罐觀鑵欟鱹鸛",
"guāng":"光灮炚炛炗咣垙姯挄洸茪桄烡珖胱硄僙輄潢銧黆",
"guǎng":"広犷廣獷臩",
"guàng":"俇桄逛臦撗",
"guī":"归圭妫规邽皈茥闺帰珪胿亀硅窐袿規媯廆椝瑰郌嫢摫閨鲑嬀嶲槣槻槼鳺璝瞡龜鮭巂歸雟鬶騩櫰櫷瓌蘬鬹",
"guǐ":"宄氿朹轨庋佹匦诡陒垝姽恑攱癸軌鬼庪祪軓匭晷湀蛫觤詭厬簋蟡",
"guì":"攰刿刽昋炅攱贵桂桧匮眭硊趹椢猤筀貴溎蓕跪匱瞆劊劌嶡撌槶螝樻檜瞶禬簂櫃癐襘鐀鳜鞼鑎鱖鱥",
"gǔn":"丨衮惃硍绲袞辊滚蓘裷滾緄蔉磙緷輥鲧鮌鯀",
"gùn":"睔謴",
"guo":"",
"guō":"呙咼咶埚郭啯堝崞渦猓楇聒鈛锅墎瘑嘓彉濄蝈鍋彍蟈懖矌",
"guó":"囗囯囶囻国圀敋喐國帼掴腘摑幗慖漍聝蔮膕虢簂馘",
"guǒ":"果惈淉菓馃椁褁槨粿綶蜾裹輠餜櫎",
"guò":"過腂鐹",
"hā":"虾紦铪鉿蝦",
"há":"",
"hǎ":"奤",
"hà":"",
"hāi":"咍嗨",
"hái":"郂孩骸還嚡",
"hǎi":"海胲烸塰酼醢",
"hài":"亥妎拸骇害氦猲絯嗐餀駭駴饚",
"han":"兯爳",
"hān":"犴佄顸哻蚶酣頇嫨谽憨馠魽歛鼾",
"hán":"邗含汵邯函肣凾虷唅圅娢浛笒崡晗梒涵焓琀寒嵅韩椷甝筨馯蜬澏鋡韓",
"hǎn":"丆罕浫喊豃闞",
"hàn":"仠厈汉屽忓扞闬攼旰旱肣唅垾悍捍涆猂莟晘焊菡釬閈皔睅傼蛿颔馯撖漢蔊蜭鳱暵熯輚銲鋎憾撼翰螒頷顄駻譀雗瀚鶾",
"hāng":"",
"háng":"邟妔苀迒斻杭垳绗桁笐航蚢颃裄貥筕絎頏魧",
"hàng":"忼沆笐",
"hāo":"茠蒿嚆薅薧",
"háo":"乚毜呺竓皋蚝毫椃嗥獆號貉噑獔豪嘷獋諕儫嚎壕濠籇蠔譹",
"hǎo":"郝",
"hào":"昊侴昦秏哠恏悎浩耗晧淏傐皓鄗滈滜聕號暠暤暭澔皜皞镐曍皡薃皥藃鎬颢灏顥鰝灝",
"hē":"诃抲欱訶嗬蠚",
"hé":"禾纥呙劾咊咼姀河郃峆曷柇狢盇籺紇阂饸敆盉盍荷釛啝涸渮盒菏萂龁喛惒粭訸颌楁毼澕蓋詥貈貉鉌阖鲄朅熆閡閤餄鹖麧噈頜篕翮螛魺礉闔鞨齕覈鶡皬鑉龢",
"hě":"",
"hè":"咊抲垎贺哬袔隺寉焃惒猲賀嗃煂碋熇褐赫鹤翯嚇壑癋謞燺爀鶮鶴靍靎鸖靏",
"hēi":"黒黑嗨潶",
"hén":"拫痕鞎",
"hěn":"佷哏很狠詪噷",
"hèn":"恨噷",
"hēng":"亨哼悙涥脝",
"héng":"姮恆恒桁烆珩胻鸻撗橫衡鴴鵆蘅鑅",
"hèng":"悙啈橫",
"hng":"哼",
"hōng":"叿吽呍灴轰訇烘軣揈渹焢硡谾薨輷嚝鍧巆轟",
"hóng":"厷仜弘叿妅屸吰宏汯玒瓨纮闳宖泓玜苰垬娂沗洪竑紅羾荭虹浤浲紘翃耾硔紭谹鸿渱溄竤粠葓葒鈜閎綋翝谼潂鉷鞃魟篊鋐彋霐黉霟鴻黌",
"hǒng":"唝晎嗊愩慐",
"hòng":"讧訌閧撔澒銾蕻闂鬨闀",
"hōu":"齁",
"hóu":"矦鄇喉帿猴葔瘊睺銗篌糇翭骺翵鍭餱鯸",
"hǒu":"吼吽犼呴",
"hòu":"后郈厚垕後洉矦茩逅候堠豞鲎鲘鮜鱟",
"hū":"乎乯匢虍芴呼垀忽昒曶泘苸恗烀芔轷匫唿惚淴虖軤雽嘑寣滹雐幠戯歑戱膴戲謼",
"hú":"囫抇弧狐瓳胡壶隺壷斛焀喖壺媩搰湖猢絗葫鹄楜煳瑚瓡嘝蔛鹕鹘槲箶縎蝴衚魱縠螜醐頶觳鍸餬礐鵠瀫鬍鰗鶘鶦鶻鶮",
"hǔ":"乕汻虎浒俿淲萀琥虝滸錿鯱",
"hù":"互弖戶戸户冱芐帍护沍沪岵怙戽昈曶枑姱怘祜笏粐婟扈瓠楛嗃嗀綔鄠雽嫭嫮摢滬蔰槴熩鳸濩簄豰鍙嚛鹱觷護鳠頀鱯鸌",
"huā":"吪芲花砉埖婲華椛硴蒊嘩糀誮錵蘤",
"huá":"呚姡骅華釪釫铧滑猾嘩搳撶劃磆蕐螖鋘譁鏵驊鷨",
"huà":"夻杹枠画话崋桦華婳畫嬅畵觟話劃摦樺嫿槬澅諙諣黊繣舙譮",
"huái":"怀佪徊淮槐褢踝懐褱懷瀤櫰耲蘹",
"huài":"咶壊壞蘾",
"huān":"欢犿狟貆歓鴅懁鵍酄嚾孉懽獾歡讙貛驩",
"huán":"环郇峘洹狟荁垸桓萈萑堚寏絙雈獂綄羦蒝貆锾瞏圜嬛寰澴缳還阛環豲鍰雚镮鹮糫繯鐶闤鬟瓛",
"huǎn":"睆缓緩",
"huàn":"幻奂肒奐宦唤换浣涣烉患梙焕逭喚喛嵈愌換渙痪煥瑍綄豢漶瘓槵鲩擐澣藧鯇攌嚾轘鯶鰀",
"huāng":"巟肓荒衁宺朚塃慌",
"huáng":"皇偟凰隍黄喤堭媓崲徨惶揘湟葟遑黃楻煌瑝墴潢獚锽熿璜篁艎蝗癀磺穔諻簧蟥鍠餭鳇趪韹鐄騜鰉鱑鷬",
"huǎng":"汻怳恍炾宺晄奛谎幌詤熀熿縨謊兤櫎爌",
"huàng":"愰滉榥曂皝鎤皩",
"hui":"",
"huī":"灰灳诙咴恢拻挥洃虺袆晖烣珲豗婎媈揮翚辉隓暉椲楎煇琿睢禈詼墮幑睳褘噅噕撝翬輝麾徽隳瀈蘳孈鰴",
"huí":"囘回囬佪廻廽恛洄茴迴烠蚘逥痐缋蛕蛔蜖藱鮰繢",
"huǐ":"虺悔烠毀毁螝毇檓燬譭",
"huì":"卉屷屶汇讳泋哕浍绘芔荟诲恚恵桧烩贿彗晦秽喙廆惠湏絵缋翙阓匯彚彙會滙詯賄颒僡嘒瘣蔧誨銊圚寭慧憓暳槥潓潰蕙噦嬒徻橞殨澮濊獩璤薈薉諱頮檅檜燴璯篲藱餯嚖懳瞺穢繢蟪櫘繪翽譓儶鏸闠鐬靧譿顪",
"hūn":"昏昬荤婚惛涽焄阍棔殙湣葷睧睯蔒閽轋",
"hún":"忶浑珲馄渾湷琿魂餛鼲",
"hǔn":"",
"hùn":"诨俒眃倱圂婫掍焝溷尡慁睴觨諢",
"huō":"吙秴耠劐攉騞",
"huó":"佸姡活秮秳趏",
"huǒ":"灬火伙邩钬鈥漷煷夥",
"huò":"沎或货咟俰捇眓获閄剨喐掝祸貨惑旤湱禍漷窢蒦锪嚄奯擭濊濩獲篧鍃霍檴謋雘矆礊穫镬嚯彟瀖耯艧藿蠖嚿曤臛癨矐鑊韄靃彠",
"jī":"丌讥击刉叽饥乩刏圾机玑肌芨矶鸡枅苙咭剞唧姬屐积笄飢基庴喞嵆嵇幾攲敧朞犄筓缉赍嗘畸稘跻鳮僟毄箕綨緁銈嘰撃槣樭畿緝觭諅賫踑躸齑墼撽機激璣禨積錤隮懠擊磯簊羁賷櫅耭雞譏韲鶏譤鐖饑癪躋鞿魕鶺鷄羇虀鑇覉鑙齏羈鸄覊",
"jí":"乁亽亼及尐伋吉岌彶忣汲级即极皀亟佶诘郆卽叝姞急皍笈級堲揤疾觙偮卙唶楖淁焏谻戢棘極殛湒集塉嫉愱楫蒺蝍趌辑槉耤膌銡嶯潗濈瘠箿蕀蕺諔趞踖鞊鹡檝螏輯磼簎藉襋蹐鍓艥籍轚鏶霵齎躤雧",
"jǐ":"己丮妀屰犱泲虮挤脊掎済鱾幾戟給嵴麂魢撠憿橶擠濟穖蟣",
"jì":"彐彑旡计记伎坖妓忌技汥芰际剂季哜垍既洎紀茍茤荠計迹剤畟紒继觊記偈寄寂帺徛悸旣梞済绩塈惎臮葪蔇兾勣痵継蓟裚跡際鬾魝摖暨漃漈禝稩穊誋跽霁魥鲚暩瞉稷諅鲫冀劑曁禨穄薊襀髻嚌懠檕濟穖績繋罽薺覬鮆檵櫅櫭璾蹟鯽鵋齌廭懻癠穧繫蘎骥鯚瀱繼蘮鱀蘻霽鰶鰿鷑鱭驥",
"jia":"",
"jiā":"加乫伽夾宊抸佳拁泇徍枷毠浃珈哿埉挾浹痂梜笳耞袈傢猳葭跏椵犌腵鉫嘉擖镓糘豭貑鴐鎵麚",
"jiá":"圿夾忦扴郏拮荚郟唊恝莢戛脥袷铗戞猰蛱裌颉颊蛺鋏頬頰鴶鵊",
"jiǎ":"甲岬叚玾胛斚钾婽徦斝椵賈鉀榎槚瘕檟",
"jià":"驾架嫁幏賈榢價稼駕",
"jiān":"戋奸尖幵坚歼冿戔玪肩艰姧姦兼堅帴惤猏笺菅菺豜傔揃湔牋犍缄葌閒間雃靬搛椷椾煎瑊睷碊缣蒹豣漸監箋蔪樫熞稴緘蕑蕳鋑鲣鳽鹣熸篯縑鋻艱鞬餰馢麉瀐濺鞯鳒鵑殱礛籈鵳攕瀸鰔櫼殲譼鰜鶼礷籛韀鰹囏虃鑯韉",
"jiǎn":"囝拣枧俭柬茧倹挸捡笕减剪帴揵梘检湕趼堿揀揃検減睑硷裥詃锏弿暕瑐筧简絸谫彅戩戬碱儉翦鋄撿橏篯檢藆襇襉謇蹇瞼礆簡繭謭鎫鬋鰎鹸瀽蠒鐗鐧鹻籛譾襺鹼",
"jiàn":"件見侟建饯剑洊牮荐贱俴健剣栫涧珔舰剱徤揵袸谏釰釼寋旔朁楗毽腱臶跈践閒間賎鉴键僣僭榗槛漸監劎劍墹澗箭糋諓賤趝踐踺劒劔薦諫鋻鍵餞瞷瞯磵礀螹鍳鞬擶檻濺繝瀳覵覸譛鏩聻艦轞鐱鑒鑑鑬鑳",
"jiāng":"江姜茳畕豇將葁畺摪翞僵漿螀壃缰薑橿殭螿鳉疅礓繮韁鱂",
"jiǎng":"讲奖桨傋塂蒋奨奬蔣槳獎耩膙講顜",
"jiàng":"匞匠夅弜洚绛將弶強絳畺酱勥滰嵹摾漿彊犟糡醤糨醬櫤謽",
"jiāo":"艽交郊姣娇峧浇茮茭骄胶敎喬椒焦蛟跤僬嘐虠鲛嬌嶕嶣憍憢澆膠蕉燋膲礁穚鮫鵁鹪簥蟭轇鐎驕鷦鷮",
"jiáo":"矯",
"jiǎo":"臫佼恔挢狡绞饺捁晈烄笅皎脚釥铰搅湫筊絞勦敫湬煍腳賋僥摎摷暞踋鉸餃儌劋徺撟撹樔徼憿敽敿燞曒璬矯皦蟜繳譑孂纐攪灚鱎龣",
"jiào":"叫呌峤挍訆悎珓窌笅轿较敎斍覐窖筊覚滘較嘂嘄嘦斠漖酵噍嶠潐噭嬓徼獥癄藠趭轎醮灂覺譥皭釂",
"jie":"價",
"jiē":"阶疖哜皆袓接掲痎秸菨階喈喼嗟堦媘嫅椄湝結脻街裓楬煯瑎稭鞂擑蝔嚌癤謯鶛",
"jié":"卩卪孑尐讦扢刧刦劫岊昅杢刼劼杰疌衱诘拮洁狤迼倢桀桔桝洯紒莭訐偈偼啑婕崨捷掶袷袺傑媫嵑結絜蛣颉嵥搩楶滐睫節蜐詰趌跲鉣截榤碣竭蓵鲒嶱潔羯誱踕镼鞊頡幯擳嶻擮礍鍻鮚巀蠞蠘蠽",
"jiě":"姐毑媎觧飷檞",
"jiè":"丯介吤妎岕庎戒屆届斺玠畍界疥砎衸诫借悈紒蚧唶徣堺楐琾蛶觧骱犗耤誡褯魪嶰藉鎅鶡",
"jīn":"巾今仐斤钅竻釒金津矜砛荕衿觔埐珒矝紟惍琎菳堻琻筋釿璡鹶黅襟",
"jǐn":"侭卺巹紧堇婜菫僅厪谨锦嫤廑慬漌緊蓳馑槿瑾儘錦謹饉",
"jìn":"伒劤妗近进枃勁浕荩晉晋浸烬笒紟赆唫祲進煡臸僅寖搢溍缙靳墐嫤慬榗瑨盡馸僸凚歏殣觐噤嬐濅縉賮嚍壗嬧濜藎燼璶覲贐齽",
"jīng":"坕坙巠京泾经茎亰秔荊荆涇粇婛惊旍旌猄経菁晶稉腈葏睛粳經兢箐精綡聙鋞橸鲸鯨鶁鶄麖鼱驚麠",
"jǐng":"井丼阱刭坓宑汫汬肼剄穽殌儆頚幜憬擏澋璄憼暻璟璥頸蟼警",
"jìng":"劤妌弪径迳俓勁婙浄胫倞凈弳徑痉竞莖逕婧桱梷殑淨竟竫脛敬痙竧靓傹靖境獍誩踁静靚憼曔镜靜瀞鵛鏡競竸",
"jiōng":"冂冋坰扃埛扄浻絅銄駉駫蘏蘔",
"jiǒng":"冏囧泂炅迥侰炯逈浻烱絅煚窘颎綗臦僒煛熲澃褧燛顈臩",
"jiòng":"",
"jiū":"丩勼纠朻牞究糺鸠糾赳阄萛啾揂揪剹揫鳩摎稵樛鬏鬮",
"jiú":"",
"jiǔ":"九乆久乣氿奺汣杦灸玖糺舏韭紤酒镹韮",
"jiù":"匛旧臼咎疚柩柾倃捄桕匓厩救就廄廐舅僦廏慦殧舊鹫匶鯦麔欍齨鷲",
"jū":"凥伡抅車匊居岨泃狙苴驹俥毩疽眗砠罝陱娵婮崌掬梮涺揟椐毱琚腒趄跔跙锔裾雎艍蜛諊踘躹鋦駒據鋸鮈鴡檋鞠鞫鶋",
"jú":"局泦侷狊挶桔啹婅淗焗菊郹椈湨犑輂僪粷蓻跼閰趜鋦橘駶繘鵙蹫鵴巈蘜鶪鼰鼳驧",
"jǔ":"咀岨弆举枸矩莒挙椇筥榉榘蒟龃聥舉踽擧櫸齟欅襷",
"jù":"巨乬巪讵姖岠怇拒洰苣邭具怐怚拠昛歫炬珇秬钜俱倨倶剧烥粔耟蚷袓埧埾惧詎距焣犋跙鉅飓蒩虡豦锯寠愳窭聚駏劇勮屦踞鮔壉懅據澽窶螶遽鋸屨颶瞿貗簴躆醵忂懼鐻",
"juān":"姢勌娟捐涓朘梋焆瓹脧圏裐鹃勬鋑鋗镌鞙鎸鐫蠲",
"juǎn":"呟巻帣埍捲菤锩臇錈闂",
"juàn":"奆劵奍巻帣弮倦勌悁桊狷绢隽婘惓淃瓹眷鄄圏棬椦睊絭罥腃雋睠絹飬慻蔨嶲鋗餋獧縳巂羂讂",
"juē":"噘撅撧屩屫",
"jué":"亅孒孓决刔氒诀吷妜弡抉決芵叕泬玨玦挗珏疦砄绝虳埆捔欮蚗袦崫崛掘斍桷覐觖訣赽趹傕厥焳矞絕絶覚趉鈌劂瑴谲駃噊嶡嶥憰撅熦爴獗瘚蕝蕨觮鴂鴃噱壆憠橜橛燋璚爵臄镢櫭繘蟨蟩爑譎蹷蹶髉匷矍覺鐍鐝鳜灍爝觼穱彏戄攫玃鷢矡貜躩钁",
"juě":"蹶",
"juè":"誳",
"jūn":"军君均汮姰袀軍钧莙蚐桾皲鈞碅筠皸皹覠銁銞鲪頵麇龜鍕鮶麏麕",
"jǔn":"",
"jùn":"呁俊郡陖埈峻捃浚隽馂骏晙焌珺棞畯竣葰雋儁箘箟蜠賐寯懏餕燇濬駿鵘鵔鵕攈攟",
"kā":"喀",
"kǎ":"佧咔咯垰胩裃鉲",
"kāi":"开奒揩锎開鐦",
"kǎi":"凯剀垲恺闿豈铠凱剴嘅慨蒈塏嵦愷輆暟锴鍇鎧闓颽",
"kài":"忾炌欯欬烗勓愒愾濭鎎",
"kān":"刊栞勘龛堪嵁戡龕",
"kǎn":"凵冚坎扻侃砍莰偘埳惂欿歁槛輡檻顑竷轗",
"kàn":"衎崁墈阚瞰磡闞竷鬫矙",
"kāng":"忼闶砊粇康閌嫝嵻慷漮槺穅糠躿鏮鱇",
"káng":"",
"kǎng":"",
"kàng":"亢伉匟邟囥抗犺闶炕钪鈧閌",
"kāo":"尻嵪髛",
"kǎo":"丂攷考拷洘栲烤薧",
"kào":"洘铐犒銬鲓靠鮳鯌",
"kē":"匼柯牁牱珂科轲疴砢趷钶蚵铪嵙棵痾萪軻颏嗑搕犐稞窠鈳榼薖鉿颗樖瞌磕蝌頦窼醘顆髁礚",
"ké":"殻揢殼翗",
"kě":"岢炣渇嵑敤渴軻閜磆嶱",
"kè":"克刻剋勀勊客峇恪娔尅悈袔课堁氪骒愘硞缂衉嗑愙歁溘锞碦緙艐課濭錁礊騍",
"kēi":"剋尅",
"kēn":"",
"kěn":"肎肯肻垦恳啃龂豤貇龈墾錹懇",
"kèn":"珢掯硍裉褃",
"kēng":"劥阬坈坑妔挳硁殸牼揁硜铿硻摼誙銵鍞鏗",
"kěng":"硻",
"kōng":"倥埪崆悾涳椌硿箜躻錓鵼",
"kǒng":"孔倥恐悾",
"kòng":"矼控羫鞚",
"kōu":"抠芤眍眗剾彄摳瞘",
"kǒu":"口劶竘",
"kòu":"叩扣佝怐敂冦宼寇釦窛筘滱蔲蔻瞉簆鷇",
"kū":"扝刳矻郀朏枯胐哭桍秙窋堀圐跍窟骷鮬",
"kú":"",
"kǔ":"狜苦楛",
"kù":"库俈绔庫捁秙焅袴喾硞絝裤瘔酷廤褲嚳",
"kuā":"咵姱恗晇絓舿誇",
"kuǎ":"侉垮楇銙",
"kuà":"胯趶誇跨骻",
"kuǎi":"蒯擓",
"kuài":"巜凷圦块快侩郐哙浍狯脍欳塊蒉會筷駃鲙儈墤鄶噲廥澮獪璯膾旝糩鱠",
"kuān":"宽寛寬臗髋鑧髖",
"kuǎn":"梡欵款歀窽窾",
"kuàn":"",
"kuāng":"匡迋劻诓邼匩哐恇洭硄筐筺誆軭",
"kuáng":"忹抂狅狂诳軖軠誑鵟",
"kuǎng":"夼儣懭",
"kuàng":"卝丱邝圹纩况旷岲況矿昿贶框眖砿眶絋絖貺軦鉱鋛鄺壙黋懬曠爌矌礦穬纊鑛",
"kuī":"亏刲岿悝盔窥聧窺虧顝闚巋",
"kuí":"奎晆逵鄈隗馗喹揆葵骙戣暌楏楑魁睽蝰頯櫆藈鍨鍷騤夔蘷巙虁犪躨",
"kuǐ":"尯煃跬頍磈蹞",
"kuì":"尯胿匮喟媿愧愦蒉馈匱瞆嘳嬇憒潰篑聭聩蕢殨膭謉瞶餽簣聵籄饋",
"kūn":"坤昆堃堒婫崑崐晜猑菎裈焜琨髠裩貇锟髡鹍潉蜫褌髨熴瑻醌錕鲲騉鯤鵾鶤",
"kǔn":"悃捆阃壸梱祵硱稇裍壼稛綑閫閸",
"kùn":"困涃睏",
"kuò":"扩拡挄适秮秳铦筈萿葀蛞阔廓漷銛噋銽頢髺擴濶闊鞟韕霩鞹鬠",
"la":"鞡",
"lā":"垃柆砬菈搚磖邋",
"lá":"旯剌砬揦磖嚹",
"lǎ":"喇藞",
"là":"剌翋揦溂揧楋瘌蜡蝋辢辣蝲臈擸攋爉臘鬎櫴瓎镴鯻蠟鑞",
"lái":"来來俫倈崃徕涞莱郲婡崍庲徠梾淶猍萊逨棶琜筙铼箂錸騋鯠鶆麳",
"lǎi":"襰",
"lài":"疠娕徕唻婡徠赉睐睞赖誺賚濑賴頼癘顂癞鵣攋瀨瀬籁藾櫴癩籟",
"lán":"兰岚拦栏啉婪惏嵐葻阑暕蓝谰厱澜褴儖斓篮懢燣燷藍襕镧闌璼幱襤譋攔瀾灆籃繿蘫蘭斕欄襴囒灡籣欗讕躝襽鑭韊",
"lǎn":"览浨揽缆榄漤罱醂壈懒覧擥嬾懶孄覽孏攬灠欖爦顲纜",
"làn":"坔烂滥燗嚂壏濫爁爛瓓爤爦糷钄",
"lāng":"啷",
"láng":"勆郞哴欴狼嫏廊斏桹琅蓈榔瑯硠稂锒筤艆蜋郒樃螂躴鋃鎯駺",
"lǎng":"崀朗朖烺塱蓢誏朤",
"làng":"埌浪莨阆筤蒗誏閬",
"lāo":"捞粩撈",
"láo":"労劳牢窂哰崂浶勞痨铹僗嘮嶗憦憥朥癆磱簩蟧醪鐒顟髝",
"lǎo":"耂老佬咾恅狫荖栳珯硓铑蛯銠鮱轑",
"lào":"涝絡嗠耢酪嫪嘮憦樂澇躼橯耮軂",
"le":"饹",
"lē":"嘞",
"lè":"仂阞叻忇扐氻艻牞玏泐竻砳楽韷餎樂簕鳓鰳鱳",
"lei":"嘞",
"lēi":"",
"léi":"絫雷嫘缧蔂樏畾磥檑縲攂礌镭櫑瓃羸礧纍罍蘲鐳轠儽鑘靁虆鱩欙纝鼺",
"lěi":"厽耒诔垒洡塁絫傫誄瘣樏磊蕌磥蕾儡壘癗礌藟櫑櫐矋礨礧灅蠝蘽讄壨鑸鸓",
"lèi":"泪洡类涙淚祱絫酹銇頛頪錑攂颣類礧纇蘱禷",
"lēng":"稜",
"léng":"唥崚塄楞碐稜薐",
"lěng":"冷",
"lèng":"倰堎愣睖踜",
"li":"",
"lī":"",
"lí":"刕杝厘柂剓狸离荲骊悡梨梸犁琍菞喱棃犂鹂剺漓睝筣缡艃蓠嫠孷樆璃盠竰貍犛糎蔾褵鋫鲡黎篱縭罹錅蟍謧醨嚟藜邌釐離鯏斄瓈蟸鏫鯬鵹麗黧囄灕蘺蠫孋廲劙鑗穲籬纚驪鱺鸝",
"lǐ":"礼李里俚峛峢娌峲悝浬逦理裡锂粴裏豊鋰鲤澧禮鯉醴蠡鳢邐鱧欚纚鱱",
"lì":"力历厉屴扐立吏扚朸利励叓呖坜杝沥苈例叕岦戾枥沴沵疠苙迣俐俪栃栎疬砅茘荔赲轹郦唎娳悧栛栗浰涖猁珕砬砺砾秝莉莅鬲唳婯悷笠粒粝脷蚸蛎傈凓厤棙痢蛠詈跞雳厯塛慄搮溧睙蒞蒚蜊鉝鳨厲暦歴瑮綟蜧銐蝷镉勵曆歷篥隷鴗巁檪濿癘磿隸鬁儮擽曞櫔爄犡禲蠇鎘嚦壢攊櫟瀝瓅礪藶麗櫪爏瓑皪盭礫糲蠣儷癧礰纅酈鷅麜囇孋攦觻躒轢欐讈轣攭瓥靂靋",
"liǎ":"俩倆",
"lián":"奁连帘怜涟莲連梿联裢亷嗹廉慩溓漣蓮匲奩槏槤熑覝劆匳噒嫾憐磏聨聫褳鲢濂濓縺翴聮薕螊櫣燫聯臁謰蹥檶鎌镰瀮簾蠊鬑鐮鰱籢籨",
"liǎn":"莶敛梿琏脸裣慩摙溓槤璉蔹嬚薟斂櫣歛臉鄻襝羷蘞蘝醶",
"liàn":"练炼恋殓僆堜媡湅萰链摙楝煉瑓潋稴練澰錬殮鍊鏈瀲鰊戀纞",
"liāng":"",
"liáng":"良俍莨梁涼椋辌粱粮墚踉樑輬駺糧",
"liǎng":"両两兩俩倆唡啢掚脼裲緉蜽魉魎",
"liàng":"亮倞哴悢谅涼辆喨晾湸靓輌踉諒輛鍄",
"liāo":"蹽",
"liáo":"辽疗窌聊尞僚寥嵺憀摎漻膋嘹嫽寮嶚嶛憭敹樛獠缭遼暸橑璙膫療竂鹩屪廫簝繚藔蟟蟧豂賿蹘爎爒飂髎飉鷯",
"liǎo":"钌釕鄝缪蓼憭繆曢爎镽爒",
"liào":"尥尦钌炓料釕廖撂窷镣鐐",
"lie":"",
"liē":"",
"lié":"",
"liě":"忚毟挘",
"liè":"列劣劦冽劽姴挒洌茢迾哷埓埒栵浖烈烮捩猎猟脟棙蛚煭聗趔綟巤獦颲燤儠巁鮤鴷擸爄獵爉犣躐鬛鬣鱲",
"līn":"拎",
"lín":"厸邻阾林临冧啉崊惏晽琳粦碄箖粼綝鄰隣嶙潾獜遴斴暽燐璘辚霖疄瞵磷臨繗翷麐轔壣瀶鏻鳞驎鱗麟",
"lǐn":"菻亃僯箖凜凛撛廩廪懍懔澟檁檩癝癛",
"lìn":"吝恡悋赁焛亃痳賃蔺獜橉甐膦閵疄藺蹸躏躙躪轥",
"líng":"伶刢灵呤囹坽夌姈岺彾泠狑苓昤朎柃玲瓴〇凌皊砱秢竛羐袊铃陵鸰婈崚掕棂淩琌笭紷绫羚翎聆舲菱蛉衑祾詅跉軨稜蓤裬鈴閝零龄綾蔆輘霊駖澪蕶錂霗魿鲮鴒鹷燯霝霛齢酃鯪孁齡櫺醽靈欞爧麢龗",
"lǐng":"岺袊领領嶺",
"lìng":"另炩蘦",
"liū":"熘澑蹓",
"liú":"刘畄斿浏流留旈琉畱硫裗媹嵧旒蒥蓅骝摎榴漻瑠飗劉瑬瘤磂镏駠鹠橊璢疁镠癅蟉駵嚠懰瀏藰鎏鎦麍鏐飀鐂騮飅鰡鶹驑",
"liǔ":"柳栁桞珋桺绺锍綹熮罶鋶橮嬼懰羀藰",
"liù":"窌翏塯廇遛澑磂磟鹨鎦霤餾雡飂鬸鷚",
"lo":"咯",
"lóng":"龙屸尨咙泷茏昽栊珑胧眬砻竜聋隆湰滝嶐槞漋癃窿篭龍儱蘢鏧霳嚨巃巄瀧曨朧櫳爖瓏襱矓礲礱蠬蠪龓龒籠聾豅躘靇鑨驡鸗",
"lǒng":"陇垅垄拢篢篭龍隴儱徿壟壠攏竉龓籠躘",
"lòng":"哢梇硦儱徿贚",
"lou":"喽嘍瞜",
"lōu":"摟",
"lóu":"剅娄偻婁喽溇蒌僂楼嘍寠廔慺漊蔞遱樓熡耧蝼瞜耬艛螻謱貗軁髅鞻髏鷜",
"lǒu":"嵝塿嶁摟甊篓簍",
"lòu":"陋屚漏瘘镂瘻瘺鏤",
"lū":"噜撸謢嚕擼",
"lú":"卢庐芦垆枦泸炉栌胪轳舮鸬玈舻颅鈩鲈馿魲盧嚧壚廬攎瀘獹璷蘆曥櫨爐瓐臚矑籚纑罏艫蠦轤鑪顱髗鱸鸕黸",
"lǔ":"卤虏掳鹵硵鲁虜塷滷蓾樐澛魯擄橹氇磠穞镥瀂櫓氌艣鏀艪鐪鑥",
"lù":"圥甪陆侓坴彔录峍勎赂辂陸娽淕淥渌硉菉逯鹿椂琭祿禄僇剹勠盝睩稑賂路輅塶廘摝漉箓粶緑蓼蔍戮樚熝膔趢踛辘醁潞穋蕗錄錴録璐簏螰鴼簶蹗轆騄鹭簬簵鏕鯥鵦鵱麓鏴騼籙觻虂鷺",
"luán":"娈孪峦挛栾鸾脔滦銮鵉圝奱孌孿巒攣曫欒灓羉臡臠圞灤虊鑾癴癵鸞",
"luǎn":"卵覶",
"luàn":"乱釠乿亂薍灓",
"lūn":"掄",
"lún":"仑伦囵沦纶芲侖轮倫陯圇婨崘崙掄淪菕棆腀碖綸耣蜦論踚輪磮錀鯩",
"lǔn":"埨惀碖稐耣",
"lùn":"惀溣碖論",
"luo":"囉囖",
"luō":"捋頱囉囖",
"luó":"寽罗猡脶萝逻椤腡锣箩骡镙螺攎羅覶鏍儸覼騾囉攞玀蘿邏欏驘鸁籮鑼饠囖",
"luǒ":"剆倮砢捰蓏裸躶瘰蠃臝曪攭癳",
"luò":"泺咯峈洛荦骆洜珞捰渃硌硦笿絡蛒跞詻摞漯犖雒駱磱鮥鵅擽濼攊皪躒纙",
"lǘ":"驴闾榈閭氀膢瞜櫚藘驢",
"lǚ":"吕呂侣郘侶挔捛捋旅梠焒祣偻稆铝屡絽缕僂屢慺膂褛鋁履膐褸儢縷穭鷜",
"lǜ":"垏律哷虑嵂氯葎滤綠緑慮箻膟勴繂濾櫖爈卛鑢",
"lüè":"寽掠畧略锊稤圙鋢鋝",
"ma":"嗎嘛麽",
"mā":"亇妈孖庅媽嫲榪螞",
"má":"菻麻嗎痲痳嘛嫲蔴犘蟇",
"mǎ":"马犸杩玛码馬嗎溤獁遤瑪碼螞鎷鰢鷌",
"mà":"杩祃閁骂傌睰嘜榪禡罵螞駡鬕",
"mái":"薶霾",
"mǎi":"买荬買嘪蕒鷶",
"mài":"劢迈佅売麦卖唛脈麥衇勱賣邁霡霢",
"mān":"颟顢",
"mán":"姏悗蛮絻谩慲摱馒樠瞞鞔謾饅鳗鬘鬗鰻矕蠻",
"mǎn":"娨屘満满滿螨襔蟎鏋矕",
"màn":"曼僈鄤墁嫚幔慢摱漫獌缦蔄槾澫熳澷镘縵鏝蘰",
"māng":"牤",
"máng":"邙吂忙汒芒尨杗杧盲盳厖恾笀茫哤娏庬浝狵朚牻硭釯铓痝蛖鋩駹蘉",
"mǎng":"莽莾硥茻壾漭蟒蠎",
"màng":"",
"māo":"貓",
"máo":"毛矛芼枆牦茅茆旄罞渵軞酕堥嵍楙锚緢鉾髦氂犛蝥貓髳錨蟊鶜",
"mǎo":"冇卯夘乮峁戼泖昴铆笷蓩鉚",
"mào":"冃皃芼冐茂柕眊秏贸旄耄袤覒媢帽萺貿鄚愗暓毷瑁瞀貌鄮蝐懋",
"me":"庅麽麼嚜",
"mē":"嚒",
"mè":"濹嚰",
"méi":"坆沒枚玫苺栂眉脄莓梅珻脢郿堳媒嵋湄湈猸睂葿楣楳煤瑂禖腜塺槑酶镅鹛鋂霉穈徾鎇攗鶥黴",
"měi":"毎每凂美挴浼羙媄嵄渼媺镁嬍燘躾鎂黣",
"mèi":"妹抺沬旀昧祙袂眛媚寐殙痗跊鬽煝睸韎魅篃蝞嚜櫗",
"mēn":"悶椚",
"mén":"门们扪汶怋玧钔門們閅捫菛璊瞞穈鍆亹斖虋",
"mèn":"悗惛焖悶暪燜鞔懑懣",
"mēng":"掹擝矇",
"méng":"尨甿虻庬莔萌溕盟雺甍鄳儚橗瞢蕄蝱鄸鋂髳幪懜懞濛獴曚朦檬氋礞鯍鹲艨矒靀霿饛顭鸏",
"měng":"黾冡勐猛黽锰艋蜢瞢懜懞蟒錳懵蠓鯭矒鼆",
"mèng":"孟梦夢夣懜霥癦",
"mī":"咪瞇",
"mí":"冞祢迷袮猕谜蒾詸摵瞇謎醚彌擟瞴縻藌麊麋麿檷禰靡瀰獼蘪麛镾戂攠瓕蘼爢醾醿鸍釄",
"mǐ":"米芈侎沵羋弭洣敉粎脒渳葞蔝銤彌濔孊攠灖",
"mì":"冖糸汨沕宓怽枈觅峚祕宻密淧覔覓幂谧塓幎覛嘧榓滵漞熐蔤蜜鼏冪樒幦濗謐櫁簚羃",
"mián":"宀芇杣眠婂绵媔棉綿緜臱蝒嬵檰櫋矈矊矏",
"miǎn":"丏汅免沔黾勉眄娩莬偭冕勔渑喕媔愐湎睌缅葂黽絻腼澠緬靦鮸",
"miàn":"靣面牑糆麫麪麺麵",
"miāo":"喵",
"miáo":"苗媌描瞄鹋嫹緢鶓",
"miǎo":"厸仯劰杪眇秒淼渺缈篎緲藐邈",
"miào":"妙庙玅竗庿缪廟繆",
"miē":"乜吀咩哶孭",
"mié":"",
"miè":"灭烕眜覕搣滅蔑薎鴓幭懱瀎篾櫗簚礣蠛衊鑖鱴",
"mín":"民忟垊姄岷忞怋旻旼玟苠珉盿砇罠崏捪渂琘琝缗暋瑉痻碈鈱緍緡賯錉鴖鍲",
"mǐn":"皿冺刡忟闵呡忞抿泯黾勄敃闽悯敏笢笽惽湏湣閔黽愍敯暋僶閩慜憫潣簢鳘蠠鰵",
"míng":"名明鸣洺眀茗冥朙眳铭鄍嫇溟猽蓂詺暝榠銘鳴瞑螟覭",
"mǐng":"佲姳凕嫇慏酩",
"mìng":"命掵",
"miǔ":"",
"miù":"谬缪繆謬",
"mō":"摸嚤",
"mó":"庅尛谟嫫馍摹膜骳麽麼魹橅糢嬤嬷謨謩擵饃蘑髍魔劘戂攠饝",
"mǒ":"懡",
"mò":"末圽沒妺帓殁歿歾沫茉陌帞昩枺狢皌眜眿砞秣莈眽絈袹絔蛨貃嗼塻寞漠獏蓦貈貊貉銆靺墨嫼瘼瞐瞙镆魩黙縸默瀎貘嚜藦蟔鏌爅驀礳纆耱",
"mōu":"哞",
"móu":"牟侔劺呣恈敄桙眸谋堥蛑缪踎謀繆鍪鴾麰鞪",
"mǒu":"厶某",
"mòu":"",
"mú":"毪氁",
"mǔ":"母亩牡坶姆拇畂峔牳畆畒胟娒畝畞砪畮鉧踇",
"mù":"木仫目凩朷牟沐狇坶炑牧苜毣莯蚞钼募雮墓幙幕慔楘睦鉬慕暯暮缪樢艒霂穆縸繆鞪",
"n":"",
"ń":"唔嗯",
"ň":"嗯",
"na":"",
"nā":"",
"ná":"秅拏拿挐嗱蒘搻誽镎鎿",
"nǎ":"乸雫",
"nà":"吶妠抐纳肭郍衲钠納袦捺笚笝豽軜貀鈉蒳靹魶",
"nái":"腉搱摨孻",
"nǎi":"乃奶艿氖疓妳廼迺倷釢嬭",
"nài":"佴奈柰耏耐萘渿鼐褦螚錼",
"nān":"囝囡",
"nán":"男抩枏侽柟娚畘莮喃遖暔楠諵難",
"nǎn":"赧揇湳萳煵腩嫨蝻戁",
"nàn":"妠婻諵難",
"nāng":"儾囔",
"náng":"乪涳搑憹嚢蠰饟馕欜饢",
"nǎng":"搑擃瀼曩攮灢馕",
"nàng":"儾齉",
"nāo":"孬",
"náo":"呶怓挠峱桡硇铙猱蛲詉碙摎撓嶩憹橈獶蟯夒譊鐃巎獿",
"nǎo":"垴恼悩脑匘脳堖惱嫐瑙腦碯憹獶",
"nào":"闹婥淖閙鬧臑",
"ne":"",
"né":"",
"nè":"疒讷吶抐眲訥",
"néi":"",
"něi":"娞浽馁脮腇餒鮾鯘",
"nèi":"內氝氞錗",
"nèn":"恁媆嫩嫰",
"néng":"",
"něng":"螚",
"nèng":"",
"ńg":"唔嗯",
"ňg":"嗯",
"nī":"妮",
"ní":"尼坭怩抳籾倪屔秜郳铌埿婗淣猊蚭棿蛪跜鈮聣蜺馜觬貎輗霓鲵鯢麑齯臡",
"nǐ":"伱伲你拟妳抳狔苨柅婗掜旎晲棿孴儞儗隬懝擬濔薿檷聻",
"nì":"屰氼伲抐昵胒逆匿眤秜堄惄嫟愵睨腻暱縌誽膩嬺",
"niān":"拈蔫",
"nián":"年秊哖姩秥粘溓鲇鮎鲶鵇黏鯰",
"niǎn":"涊淰焾辇榐辗撚撵碾輦簐蹍攆蹨躎",
"niàn":"卄廿念姩唸埝悥惗艌",
"niáng":"娘嬢孃釀",
"niǎng":"",
"niàng":"酿醸釀",
"niǎo":"鸟茑袅鳥嫋裊蔦樢嬝褭嬲",
"niào":"脲",
"niē":"捏揑",
"nié":"苶",
"niě":"",
"niè":"乜帇圼峊枿陧涅痆聂臬啮掜菍隉敜湼嗫嵲踂噛摰槷踗踙銸镊镍嶭篞臲鋷錜颞蹑嚙聶鎳闑孼孽櫱籋蘖囁攝齧巕糱糵蠥鑈囐囓讘躡鑷顳钀",
"nín":"囜恁脌您",
"nǐn":"拰",
"níng":"咛狞苧柠聍寍寕甯寗寜寧儜凝橣嚀嬣擰獰薴檸聹鑏鬡鸋",
"nǐng":"擰矃",
"nìng":"佞侫泞倿寍寕甯寗寜寧澝擰濘",
"niū":"妞孧",
"niú":"牜牛汼怓",
"niǔ":"忸扭沑狃纽杻炄钮紐莥鈕靵",
"niù":"抝",
"nóng":"农侬哝浓脓秾農儂辳噥濃蕽檂燶禯膿癑穠襛譨醲欁鬞",
"nǒng":"繷",
"nòng":"挊挵癑齈",
"nóu":"羺",
"nǒu":"",
"nòu":"搙槈耨獳檽鎒鐞",
"nú":"奴伮孥帑驽笯駑",
"nǔ":"伮努弩砮胬",
"nù":"怒傉搙",
"nuán":"奻渜",
"nuǎn":"渜湪暖煖煗餪",
"nuàn":"",
"nuó":"挪梛傩橠難儺",
"nuǒ":"袳袲",
"nuò":"耎诺喏掿毭逽愞搙搦锘搻榒稬諾蹃糑鍩懧懦糥穤糯",
"nǘ":"",
"nǚ":"钕籹釹",
"nǜ":"沑衂恧朒衄聏",
"nüè":"虐婩硸瘧",
"o":"筽",
"ō":"喔噢",
"ó":"哦",
"ǒ":"嚄",
"ò":"哦",
"ou":"",
"ōu":"讴吽沤欧殴瓯鸥區嘔塸漚歐毆熰甌膒鴎櫙藲謳鏂鷗",
"óu":"",
"ǒu":"吘禺偶腢嘔熰耦蕅藕",
"òu":"怄沤嘔慪漚",
"pā":"汃妑苩皅趴舥啪葩",
"pá":"杷爬钯掱琶筢潖",
"pǎ":"",
"pà":"汃帊帕怕袙",
"pāi":"拍",
"pái":"俳徘猅棑牌箄輫簲簰犤",
"pǎi":"廹",
"pài":"沠哌派渒湃蒎鎃",
"pān":"眅畨萠潘攀籓",
"pán":"丬爿肨柈洀胖眫湴盘跘媻幋蒰搫槃盤磐縏膰磻蹒瀊蟠蹣鎜鞶",
"pǎn":"坢盻",
"pàn":"冸判沜拚泮炍肨叛牉盼胖畔聁袢詊溿頖鋬闆鵥襻鑻",
"pāng":"乓汸沗胮雱滂膖霶",
"páng":"厐夆尨彷庞逄庬趽舽嫎徬膀篣螃鳑龎龐鰟",
"pǎng":"嗙耪覫",
"pàng":"炐肨胖眫",
"pāo":"抛拋脬萢藨穮",
"páo":"咆垉庖狍炰爮瓟袍铇匏烰袌跁軳鉋鞄褜麃麅",
"pǎo":"",
"pào":"奅疱皰砲袌靤麭嚗礟礮",
"pēi":"妚呸怌抷肧柸胚衃醅",
"péi":"阫陪培婄毰赔锫裵裴賠錇",
"pěi":"俖琣",
"pèi":"伂妃沛犻佩帔姵斾柭旆浿珮配淠棑媐蓜辔馷嶏霈攈轡",
"pēn":"噴濆歕",
"pén":"瓫盆湓葐",
"pěn":"呠翸",
"pèn":"喯噴",
"pēng":"亨匉怦抨泙恲胓砰梈烹硑絣軯剻閛漰嘭駍磞",
"péng":"芃朋挷竼倗捀莑堋弸淜袶棚椖傰塜塳搒漨痭硼稝蓬鹏樥熢憉澎輣篣篷膨錋韸髼蟚蟛鬅纄蘕韼鵬騯鬔鑝",
"pěng":"捧淎皏摓",
"pèng":"掽椪碰閛槰踫磞",
"pi":"榌",
"pī":"丕伓伾妚批纰邳坯岯怶披抷枈炋狉狓砒悂秛秠紕铍陴旇翍耚豾釽鈚鉟銔磇駓髬噼錃錍魾憵礕礔鎞霹",
"pí":"皮仳阰纰芘陂枇肶毘毗疲笓紕蚍郫铍啤埤崥猈蚾蚽豼焷琵禆脾腗裨鈹鲏罴膍蜱罷隦魮壀螕鮍篺螷貔鞞鵧羆朇鼙蠯",
"pǐ":"匹庀疋仳圮吡苉悂脴痞銢嶏諀鴄擗噽癖嚭",
"pì":"屁埤淠揊嫓媲睥潎稫僻澼嚊濞甓疈譬闢鷿鸊",
"piān":"囨偏媥楄犏篇翩鍂鶣",
"pián":"骈胼缏腁楩賆跰瑸緶骿蹁駢璸騈",
"piǎn":"覑谝貵諞",
"piàn":"猵骗魸獱騗騙",
"piāo":"剽勡嘌嫖彯慓缥飘旚縹翲螵犥飃飄魒",
"piáo":"嫖瓢薸闝",
"piǎo":"莩殍缥瞟篻縹醥皫顠",
"piào":"僄彯徱骠驃鰾",
"piē":"氕覕潎撆暼瞥",
"piě":"丿苤鐅",
"piè":"嫳",
"pīn":"拚姘拼砏礗穦馪驞",
"pín":"玭贫娦貧琕嫔嬪薲嚬矉蘋蠙颦顰",
"pǐn":"品榀",
"pìn":"牝汖聘",
"pīng":"乒甹俜娉涄砯聠艵頩",
"píng":"平评凭呯坪岼泙郱帡庰枰洴玶胓荓瓶帲淜硑萍蚲塀幈焩甁缾蓱蛢評馮軿鲆凴竮鉼慿箳輧憑鮃檘簈蘋",
"pǐng":"屛",
"pìng":"",
"pō":"钋陂坡岥泺泼釙翍颇溌酦頗潑醗濼醱鏺",
"pó":"婆嘙搫蔢鄱皤櫇嚩",
"pǒ":"叵尀钷笸鉕箥駊髲",
"pò":"廹岶敀昢洦珀哱烞砶破粕奤湐猼蒪魄",
"pōu":"抙剖娝捊",
"póu":"抔抙垺捊掊裒箁",
"pǒu":"咅哣婄掊棓犃",
"pū":"攵攴扑抪炇柨陠痡秿噗撲潽鋪鯆",
"pú":"圤匍捗莆菩菐葡蒲蒱僕箁酺墣獛璞濮瞨穙镤贌纀鏷",
"pǔ":"圃埔浦烳普圑溥暜谱諩擈樸氆檏镨譜蹼鐠",
"pù":"痡舗舖鋪曝",
"qi":"啐",
"qī":"七迉沏恓柒倛凄桤郪娸悽戚捿桼淒萋喰攲敧棲欹欺紪缉傶褄僛嘁墄慽榿漆緀慼緝諆踦螇霋蹊魌鏚鶈",
"qí":"丌亓伎祁圻岓岐忯芪亝斉歧畁祇祈肵俟疧荠剘斊旂竒耆脐蚔蚑蚚陭颀埼崎帺掑淇猉畦萁萕跂軝釮骐骑嵜棊棋琦琪祺蛴隑愭碁碕稘褀锜頎鬿旗粸綥綨綦蜝蜞齊璂禥蕲觭螧錡鲯懠濝薺藄鄿檱櫀簯簱臍騎騏鳍蘄鯕鵸鶀麒籏艩蠐鬐騹鰭玂麡",
"qǐ":"乞邔企屺芑启呇杞玘盀唘豈起啔啓啟婍梩绮袳跂晵棨綮綺諬闙",
"qì":"气讫忔扱気汔迄呚弃汽矵芞亟呮泣炁盵咠洓竐栔欫氣訖唭焏夡愒棄湆湇葺滊碛摖暣甈碶噐憇槭趞器憩磜磧磩藒礘罊蟿鐑",
"qiā":"抲掐袷揢葜擖",
"qiá":"",
"qiǎ":"拤峠跒酠鞐",
"qià":"圶冾匼咭帢恰洽胢殎硈愘磍髂",
"qiān":"千仟阡圱圲奷扦汘芊迁佥岍杄汧茾欦竏臤钎拪牵粁悭挳蚈谸婜孯牽釺掔谦鈆僉愆签鉛骞鹐慳搴摼撁厱磏諐遷鳽褰謙顅檶攐攑櫏簽鏲鵮孅攓騫籖鬜鬝籤韆",
"qián":"仱岒忴扲拑玪乹前炶荨钤歬虔蚙钱钳偂掮揵軡亁媊朁犍葥鈐煔鉗墘榩箝銭撍潛潜羬蕁橬錢黔鎆黚騝濳騚灊鰬",
"qiǎn":"凵肷唊淺嵰遣槏膁蜸谴缱繾譴鑓",
"qiàn":"欠刋伣芡俔茜倩悓堑掅傔棈椠欿嗛慊皘蒨塹歉綪蔳儙槧篏輤篟壍嬱縴",
"qiāng":"羌戕戗斨枪玱矼羗猐啌跄嗴椌溬獇腔嗆搶蜣锖嶈戧摤槍牄瑲羫锵篬謒蹌蹡鎗鏘鏹鶬",
"qiáng":"強墙嫱蔷樯漒蔃墻嬙廧彊薔檣牆艢蘠",
"qiǎng":"強羟搶羥墏彊繈襁镪繦鏹",
"qiàng":"戗炝唴跄嗆戧摪熗羻",
"qiāo":"帩硗郻喿嵪煍跷鄥鄡劁勪幓敲毃踍锹墝碻磝頝骹墽幧橇燆缲橾磽鍬鍫礉繑繰趬蹺蹻鏒鐰",
"qiáo":"乔侨峤荍荞桥硚菬喬睄僑摮槗谯嘺墧嫶嶠憔潐蕎鞒樵橋燋犞癄瞧礄翹櫵藮譙趫鐈鞽顦",
"qiǎo":"丂巧釥愀髜",
"qiào":"诮陗峭窍偢殻殼誚髚僺嘺撬箾噭撽鞘韒礉竅翹鞩躈",
"qiē":"苆",
"qié":"癿伽茄聺",
"qiě":"",
"qiè":"厒妾怯疌郄匧窃悏挈栔洯帹惬淁笡愜椄猰蛪趄跙嗛慊朅稧箧锲篋踥穕鍥鯜竊籡",
"qīn":"兓侵钦衾骎菳媇嵚欽嵰綅誛嶔親顉駸鮼寴",
"qín":"庈忴扲芩芹肣矜埐珡矝秦耹菦蚙捦菳琴琹禽覃鈙鈫雂勤嗪嫀溱靲廑慬噙嶜擒斳鳹懄檎澿瘽螓懃蠄鵭",
"qǐn":"坅昑笉梫赾寑锓寝寖寢鋟螼",
"qìn":"吢吣抋沁唚菣揿搇撳寴瀙藽",
"qīng":"靑青氢轻倾卿郬圊埥寈氫淸清軽傾綪蜻輕錆鲭鯖鑋",
"qíng":"夝甠剠勍啨情殑硘晴棾氰葝暒擏樈擎檠黥",
"qǐng":"苘顷请庼頃廎漀請檾謦",
"qìng":"庆凊掅殸渹碃箐綮靘慶磬親儬濪罄櫦",
"qiōng":"",
"qióng":"卭邛宆穷穹茕桏惸琁筇笻赹焪焭琼舼蛬蛩煢熍睘跫銎瞏窮儝嬛憌橩璚藑瓊竆藭瓗",
"qiòng":"",
"qiū":"丘丠邱坵恘秌秋恷蚯媝湫萩楸湬塸蓲鹙篍緧蝵穐趥龜橚鳅蟗鞦鞧蘒鰌鰍鶖蠤龝",
"qiú":"厹叴囚扏犰玌艽芁朹汓肍求虬泅牫虯俅觓訅訄酋唒浗紌莍逎逑釚梂殏毬球赇釻頄崷巯渞湭皳盚遒煪絿蛷裘巰觩賕璆蝤銶醔鮂鼽鯄鰽",
"qiǔ":"搝糗",
"qiù":"",
"qū":"伹佉匤岖诎阹驱呿坥屈岴抾浀祛胠袪區焌紶蛆躯煀筁粬蛐詘趍嶇憈駆敺觑誳駈麹髷魼趨麯覰覷軀鶌麴黢覻驅鰸鱋",
"qú":"佢劬斪朐胊菃衐鸲淭絇翑蚼葋軥蕖璖磲螶鴝璩翵蟝瞿鼩蘧忂灈戵欋氍爠籧臞癯欔蠷衢躣蠼鑺鸜",
"qǔ":"苣取竘娶紶詓竬蝺龋齲",
"qù":"去厺刞欪耝阒觑閴麮闃鼁覰覷覻",
"quān":"奍弮悛圏棬椦箞鐉",
"quán":"全权佺狋诠姾峑恮泉洤荃拳牷辁啳埢婘惓捲痊硂铨椦湶犈筌絟葲搼楾瑔觠詮跧輇蜷銓槫権踡縓醛駩闎鳈鬈騡孉巏鰁權齤矔蠸颧顴灥",
"quǎn":"犭犬犮畎烇绻綣虇",
"quàn":"劝牶勧韏勸灥",
"quē":"炔缺缼蚗蒛阙闕",
"qué":"瘸",
"què":"汋却卻埆崅悫琷傕敠敪棤硞确阕塙搉皵碏阙鹊愨榷墧慤碻確趞燩闋礐闕鵲礭",
"qūn":"夋囷逡箘歏",
"qún":"宭峮帬裙羣群裠麇",
"qǔn":"",
"rán":"呥肰衻袇蚦袡蚺然髥嘫髯燃繎",
"rǎn":"冄冉姌苒染珃媣蒅熯橪",
"ràn":"",
"rāng":"",
"ráng":"穣儴勷瀼獽蘘禳瓤穰躟鬤",
"rǎng":"壌壤攘爙纕",
"ràng":"让懹譲讓",
"ráo":"娆荛饶桡嬈蕘橈襓饒",
"rǎo":"扰娆隢嬈擾",
"rào":"绕遶穘繞",
"ré":"捼",
"rě":"喏惹",
"rè":"热渃熱",
"rén":"亻人仁壬忈朲忎秂芢魜銋鵀",
"rěn":"忍荏栠栣荵秹菍棯稔綛躵銋",
"rèn":"刃刄认仞仭讱屻岃扨纫妊杒牣纴肕轫韧饪祍姙紉衽紝訒軔梕袵釰釼絍腍鈓靱靭韌飪認餁",
"rēng":"扔",
"réng":"仍辸礽芿陾",
"rì":"日驲囸氜衵釰釼鈤馹",
"róng":"戎肜栄狨绒茙茸荣容峵毧烿傛媶嵘搑絨羢嫆嵤搈榵溶蓉榕榮熔瑢穁槦縙蝾褣镕螎融駥嬫嶸爃鎔瀜曧蠑",
"rǒng":"冗宂坈傇軵縙氄",
"ròng":"穃縙",
"róu":"厹禸柔粈脜媃揉渘葇楺煣瑈腬糅蝚蹂輮鍒鞣瓇騥鰇鶔",
"rǒu":"韖",
"ròu":"肉宍楺譳",
"rū":"嶿",
"rú":"邚如吺侞帤茹挐桇袽铷渪筎蒘銣蕠蝡儒鴑嚅嬬孺濡獳薷鴽曘檽襦繻蠕颥醹顬鱬",
"rǔ":"汝肗乳辱鄏擩",
"rù":"入扖杁洳嗕媷溽缛蓐鳰褥縟",
"ruán":"堧撋壖",
"ruǎn":"阮朊软耎偄軟媆瑌腝碝緛輭檽瓀礝",
"ruàn":"緛",
"ruí":"苼桵甤緌蕤",
"ruǐ":"惢蕋蕊橤繠壡蘃蘂",
"ruì":"兊兌抐汭芮枘笍蚋锐瑞蜹睿銳鋭叡鏸",
"rún":"瞤",
"rǔn":"",
"rùn":"闰润閏閠潤橍膶",
"ruó":"挼捼",
"ruò":"叒偌弱鄀婼渃焫楉嵶蒻箬篛爇鰙鰯鶸",
"sa":"",
"sā":"仨",
"sǎ":"訯靸潵鞈攃灑躠纚",
"sà":"卅泧钑飒脎萨鈒摋隡馺蕯颯薩櫒鏾",
"sāi":"毢愢揌毸腮嘥噻鳃顋鰓",
"sǎi":"嗮",
"sài":"赛僿賽簺",
"san":"壭",
"sān":"三弎叁參叄叅毶毵厁毿犙鬖",
"sǎn":"仐伞傘糁馓糝糤糣繖鏒鏾饊",
"sàn":"俕帴閐潵",
"sāng":"桒桑喪槡",
"sǎng":"嗓搡磉褬颡鎟顙",
"sàng":"喪",
"sāo":"掻慅搔溞缫懆缲螦繅鳋颾騒繰騷鰠鱢",
"sǎo":"埽掃嫂",
"sào":"埽掃瘙懆氉矂髞",
"sē":"閪",
"sè":"色拺洓栜涩啬渋粣铯雭歮琗嗇瑟摵歰銫槭澁廧懎擌濇濏瘷穑薔澀璱瀒穡鎍繬穯轖鏼闟譅飋",
"sēn":"森椮槮襂",
"sěn":"",
"sēng":"僧鬙",
"sèng":"",
"sī":"厶纟丝司糹糸私咝泀俬恖虒鸶偲傂媤愢斯絲缌蛳楒禗鉰飔凘厮禠罳蜤銯锶嘶噝廝撕澌磃緦蕬鋖燍螄鍶蟖蟴颸騦鯣鐁鷥鼶",
"sí":"",
"sǐ":"死愢",
"sì":"巳亖四寺汜佀兕姒泤祀価孠杫泗饲驷俟娰枱柶洠牭洍涘肂飤梩笥耛耜釲竢覗嗣肆貄鈶鈻飴飼榹銉禩駟蕼儩騃瀃",
"sōng":"忪枀松枩娀柗倯凇崧庺梥淞菘愡揔棇嵩硹憽濍檧鬆",
"sóng":"",
"sǒng":"怂悚捒耸竦傱愯楤嵷摗漎慫聳駷",
"sòng":"吅讼宋诵送颂訟頌誦鎹餸",
"sōu":"凁捒捜鄋嗖廀廋搜溲獀蒐蓃馊摉飕摗锼撨艘螋醙鎪餿颼颾鏉騪",
"sǒu":"叜叟傁棷蓃嗾瞍擞薮擻藪櫢籔",
"sòu":"欶嗽擞瘶擻",
"sū":"甦酥稡稣窣穌鯂蘇蘓櫯囌",
"sú":"圱俗",
"sǔ":"",
"sù":"玊夙诉泝肃洬涑珟素莤速埣梀殐粛骕傃棴粟訴谡嗉塑塐嫊愫溯溸肅遡鹔僳愬摵榡膆蔌觫趚遬憟樕樎潥碿鋉餗潚縤橚璛簌縮藗謖蹜驌鱐鷫",
"suān":"狻痠酸",
"suǎn":"匴篹",
"suàn":"祘笇筭蒜算",
"suī":"夊芕虽倠哸娞浽荾荽眭毸滖睢缞嗺熣濉縗鞖雖",
"suí":"绥隋随遀綏隨瓍髄",
"suǐ":"膸瀡髓",
"suì":"亗岁砕祟谇埣嵗遂歲歳煫睟碎隧嬘澻穂誶賥檖燧璲禭穗穟繀襚邃旞繐繸譢鐆鏸鐩韢",
"sūn":"狲荪孫喰飧飱搎猻蓀槂蕵薞",
"sǔn":"扻损笋隼筍損榫箰簨鎨鶽",
"sùn":"摌",
"suō":"唆娑挱莏莎傞挲桫梭睃嗍嗦羧蓑摍趖簑簔縮鮻",
"suó":"",
"suǒ":"所乺唢索琑琐嫅惢锁嗩暛溑獕瑣褨璅縒鎍鎖鎻鏁",
"suò":"逤溹蜶",
"shā":"杀杉纱乷剎砂唦挱殺猀粆紗莎挲桬毮铩痧硰摋蔱裟榝樧魦鲨閷髿鎩鯊鯋繺",
"shá":"啥",
"shǎ":"傻儍",
"shà":"倽唼啑帹菨萐喢嗄廈歃翜歰箑翣濈閯霎",
"shāi":"筛篩諰簁簛籭",
"shǎi":"摋",
"shài":"晒攦曬",
"shān":"山彡邖圸删刪杉芟姍姗衫钐埏挻柵炶狦珊舢痁脠軕笘釤閊傓跚剼搧煔嘇幓煽潸澘穇檆縿膻鯅羴羶",
"shán":"",
"shǎn":"闪陕炶陝閃閄晱煔睒摻熌覢",
"shàn":"讪汕姍姗疝钐剡訕赸掞釤善單椫禅銏骟僐鄯儃墡墠撣潬缮嬗嶦擅敾樿歚禪膳磰謆赡繕蟮蟺譱贍鐥饍騸鳝鳣灗鱓鱔",
"shang":"",
"shāng":"伤殇商愓湯觞傷禓墒慯滳漡蔏殤熵螪觴謪鬺",
"shǎng":"垧扄晌埫赏樉賞鋿鏛贘鑜",
"shàng":"丄尙尚恦绱緔鞝",
"shāo":"娋弰烧莦焼萷旓筲艄輎蕱燒鞘髾鮹",
"sháo":"勺芍杓苕柖玿韶",
"shǎo":"",
"shào":"佋劭卲邵绍柖哨娋袑紹睄綤潲",
"shē":"奓奢猞赊畭畬畲輋賒賖檨",
"shé":"舌佘虵阇揲蛥闍磼",
"shě":"舍捨",
"shè":"厍设社泏舎舍厙挕涉涻渉設赦弽慑摂滠慴蔎歙蠂韘騇懾攝灄麝欇",
"shéi":"誰",
"shēn":"申屾扟伸身侁冞呻妽籶绅罙诜姺柛氠珅穼籸娠峷甡眒砷莘參叄堔敒深紳兟叅棽葠裑訷嫀搷罧蓡詵幓甧糁蔘糂燊薓駪鲹曑糝糣鯓鵢鯵鰺",
"shén":"神榊鉮鰰",
"shěn":"邥吲弞抌审矤哂矧宷谂谉婶淰渖訠棯審諗頣魫曋瞫嬸瀋覾讅",
"shèn":"肾侺昚胂涁眘渗祳脤谌腎葚愼慎椹瘆蜄蜃滲鋠瘮黮",
"shēng":"升生阩呏声斘昇枡泩狌苼殅牲珄竔陞曻陹殸笙湦焺甥鉎聲鍟鼪鵿",
"shéng":"渑绳憴澠縄繉繩譝",
"shěng":"眚偗渻",
"shèng":"圣乗娍胜晠晟剰剩勝椉貹嵊琞聖墭榺蕂橳賸",
"shi":"辻籂",
"shī":"尸失师厔呞虱诗邿鸤屍施浉狮師絁釶湤湿葹溮溼獅蒒蓍詩鉇嘘瑡酾鳲噓箷蝨鳾褷鲺濕鍦鯴鰤鶳襹釃",
"shí":"十饣乭时竍実实旹飠姼峕炻祏蚀埘宲時莳寔湜遈塒嵵溡蒔鉐實榯碩蝕鲥鮖鼫識鼭鰣",
"shǐ":"史矢乨豕使始驶兘宩屎狶痑笶榁鉂駛",
"shì":"士礻丗世仕市示卋式忕亊忯戺事侍势呩柹视试饰冟咶室峙恀恃拭昰是枾柿狧眂贳适栻烒眎眡耆舐莳轼逝铈啫埶畤秲視釈崼崻弑徥惿揓谥貰释勢嗜弒楴煶睗筮蒔觢試軾鈰鉃飾舓誓適鉽馶奭銴餝餙噬嬕澨澤諡諟遾檡螫謚簭襫醳釋鰘",
"shōu":"収收敊",
"shóu":"熟",
"shǒu":"扌手守垨首艏",
"shòu":"寿受狩兽售授涭绶痩膄壽夀瘦綬嘼獣獸鏉",
"shū":"书殳疋忬抒纾叔杸枢陎姝倐倏捈書殊紓婌悆掓梳淑焂菽軗鄃琡疎疏舒摅毹毺綀输瑹跾踈樞緰蔬輸橾鮛儵攄瀭鵨",
"shú":"朮尗秫孰赎蒣塾熟璹贖",
"shǔ":"鼡暏暑稌黍署蜀鼠數潻薥薯曙癙藷襡糬襩屬籔蠴鱪鱰",
"shù":"朮戍束沭述侸俞兪咰怸怷树竖荗恕捒庻庶絉蒁術隃尌裋竪腧鉥墅漱潄數澍豎樹濖錰霔鏣鶐虪",
"shuā":"唰",
"shuǎ":"耍",
"shuà":"誜",
"shuāi":"缞摔縗",
"shuǎi":"甩",
"shuài":"帅帥蟀卛",
"shuān":"闩拴閂栓絟",
"shuàn":"涮腨槫",
"shuāng":"双泷霜雙孀瀧骦孇騻欆礵鷞鹴艭驦鸘",
"shuǎng":"爽塽慡漺縔鏯",
"shuàng":"灀",
"shuí":"谁脽誰",
"shuǐ":"氵水氺閖",
"shuì":"帨挩捝涗涚娷祱稅税裞睡說説",
"shǔn":"吮楯",
"shùn":"顺眴舜順蕣橓瞚瞤瞬鬊",
"shuō":"說説",
"shuò":"妁洬烁朔铄欶矟搠蒴銏愬槊獡碩數箾鎙爍鑠",
"ta":"侤",
"tā":"他它牠祂趿铊塌榙溻鉈褟闧",
"tá":"",
"tǎ":"塔溚墖獭鮙鳎獺鰨",
"tà":"沓挞狧闼粏崉涾傝嗒搨遝遢阘榻毾漯禢撻澾誻踏鞈嚃橽錔濌蹋鞜鎉鎑闒鞳蹹躂嚺闟闥譶躢",
"tāi":"囼孡珆胎",
"tái":"旲邰坮抬骀枱炱炲菭跆鲐箈臺颱駘儓鮐嬯擡薹檯斄籉",
"tǎi":"奤",
"tài":"太冭夳忕汏忲汰汱态肽钛泰舦酞鈦溙態燤",
"tān":"坍贪怹啴痑舑貪摊滩嘽潬瘫擹攤灘癱",
"tán":"坛昙倓谈郯埮婒惔弾覃榃痰锬谭嘾墰墵彈憛潭談醈壇曇橝澹燂錟檀顃罈藫壜繵譚貚醰譠罎",
"tǎn":"忐坦袒钽菼毯僋鉭嗿緂儃憳憻暺醓璮襢",
"tàn":"叹炭倓埮探傝湠僋嘆碳舕歎",
"tāng":"铴湯嘡劏羰蝪薚镗蹚鏜闛鞺鼞",
"táng":"坣唐堂傏啺愓棠鄌塘嵣搪溏蓎隚榶漟煻瑭禟膅樘磄糃膛橖篖糖螗踼糛螳赯醣鎕餹鏜闛饄鶶",
"tǎng":"伖帑偒傥耥躺镋鎲儻戃灙曭爣矘钂",
"tàng":"烫铴摥燙鐋",
"tāo":"夲夵弢抭涛绦掏涭絛詜嫍幍慆搯滔槄瑫韬飸縚縧濤謟轁鞱韜饕",
"táo":"匋迯咷洮逃桃陶啕梼淘绹萄祹裪綯蜪鞀醄鞉鋾駣檮饀騊鼗",
"tǎo":"讨討",
"tào":"套",
"tè":"忑忒特脦犆铽慝鋱蟘",
"tēng":"熥膯鼟",
"téng":"疼痋幐腾誊漛滕邆縢螣駦謄儯藤騰籐鰧籘虅驣",
"tèng":"霯",
"tī":"剔梯锑踢銻擿鷉鷈體",
"tí":"苐厗荑桋绨偍珶啼媂媞崹惿渧稊缇罤遆鹈嗁瑅禔綈睼碮褆徲漽磃緹蕛题趧蹄醍謕蹏鍗鳀題鮷鵜騠鯷鶗鶙禵鷤",
"tǐ":"挮徥躰骵醍軆體",
"tì":"戻奃屉剃朑俶倜悌挮涕眣绨逖啑屜悐惕掦笹逷屟惖揥替棣綈裼褅歒殢髰薙嚏鬀嚔瓋鬄籊趯",
"tiān":"天兲呑婖添酟靔黇靝",
"tián":"田屇沺恬畑畋盷胋钿甛甜菾湉塡搷阗瑱碵緂磌窴鴫璳闐鷆鷏",
"tiǎn":"奵忝殄倎栝唺悿淟紾铦晪琠腆觍痶睓舔銛餂覥賟銽錪",
"tiàn":"掭菾琠瑱舚",
"tiāo":"旫佻庣恌條祧聎",
"tiáo":"芀朷岧岹苕迢祒條笤萔铫蓚蓨蓧龆樤蜩銚調鋚鞗髫鲦鯈鎥齠鰷",
"tiǎo":"宨晀朓脁窕誂斢窱嬥",
"tiào":"啁眺粜絩覜趒糶",
"tiē":"怗贴萜聑貼跕",
"tié":"",
"tiě":"铁蛈鉄僣銕鐡鐵驖",
"tiè":"呫飻餮",
"tīng":"厅庁汀听庍耓厛烃桯烴渟綎鞓聴聼廰聽廳",
"tíng":"邒廷亭庭莛停婷嵉渟筳葶蜓楟榳閮霆聤蝏諪鼮",
"tǐng":"圢甼町侹侱娗挺涏梃烶珽脡铤艇颋誔鋌閮頲",
"tìng":"忊梃濎",
"tōng":"囲炵通痌絧嗵蓪樋",
"tóng":"仝佟彤侗峂庝哃垌峒峝狪茼晍桐浵烔砼蚒偅痌眮秱铜硧童粡絧詷赨酮鉖僮勭鉵銅餇鲖潼獞曈朣橦氃燑犝膧瞳穜鮦",
"tǒng":"侗统捅桶筒統筩綂",
"tòng":"恸痛衕慟憅",
"tou":"",
"tōu":"偸偷婾媮緰鋀鍮",
"tóu":"亠投骰頭",
"tǒu":"妵紏敨飳斢黈蘣",
"tòu":"透埱",
"tu":"汢",
"tū":"凸宊禿秃怢突涋捸堗湥痜葖嶀鋵鵚鼵",
"tú":"図图凃峹庩徒悇捈涂荼莵途啚屠梌菟揬稌趃塗嵞瘏筡腯蒤鈯圗圖廜摕潳瑹跿酴墿馟檡鍎駼鵌鶟鷋鷵",
"tǔ":"土圡钍唋釷",
"tù":"兎迌兔唋莵堍菟鋀鵵",
"tuān":"湍猯圕煓貒",
"tuán":"団团抟剸團塼慱摶漙槫篿檲鏄糰鷒鷻",
"tuǎn":"畽墥疃",
"tuàn":"彖湪猯褖貒",
"tuī":"忒推蓷藬讉",
"tuí":"弚颓僓隤墤尵橔頺頹頽魋穨蘈蹪",
"tuǐ":"俀聉腿僓蹆骽",
"tuì":"侻退娧煺蛻蜕螁駾",
"tūn":"吞呑旽涒啍朜焞噋憞暾",
"tún":"坉庉忳芚饨蛌豘豚軘飩鲀魨霕黗臀臋",
"tǔn":"氽",
"tùn":"",
"tuō":"乇仛讬托扡汑饦杔侂咃咜拕拖沰挩捝莌袉袥託啴涶脫脱飥馲魠鮵",
"tuó":"阤驮佗陀陁坨岮沱沲狏驼侻柁砤砣袉铊鸵紽堶媠詑跎酡碢鉈馱槖駄鋖駞駝橐鮀鴕鼧騨鼍驒驝鼉",
"tuǒ":"彵妥庹椭楕嫷撱橢鵎鰖",
"tuò":"杝柝毤唾涶萚跅毻嶞箨蘀籜",
"wa":"哇",
"wā":"屲穵呙劸咼哇徍挖洼娲畖窊唲啘媧窐嗗瓾蛙搲溛漥窪鼃攨韈",
"wá":"娃",
"wǎ":"佤邷咓砙瓸搲",
"wà":"帓袜婠聉嗢搲腽膃韎襪韤",
"wai":"",
"wāi":"呙咼歪喎竵瀤",
"wǎi":"崴",
"wài":"外顡",
"wān":"毌夗弯剜埦婠帵捥塆湾睕蜿潫豌鋺彎壪灣",
"wán":"丸刓汍纨芄完岏忨抏杬玩笂紈捖蚖顽烷琓貦頑翫",
"wǎn":"夘夗倇唍挽盌莞莬埦婉惋捥晚晥梚涴绾脘菀萖惌晩晼椀琬皖畹碗箢綩綰輓踠鋔鋺",
"wàn":"卍卐妧杤捥脕掔腕萬絻綄輐槾澫鋄瞣薍錽蟃贃鎫贎",
"wāng":"尣尫尪汪尩瀇",
"wáng":"亾兦仼莣蚟朚",
"wǎng":"罓罒网彺忹抂徃往枉罖罔迬惘菵暀棢蛧辋網蝄誷輞瀇魍",
"wàng":"妄忘迋旺盳徍望暀朢",
"wēi":"厃危威倭烓偎逶隇隈喴媙崴嵔愄揋揻葨葳微椳楲溦煨詴蜲縅蝛覣嶶薇燰鳂癐癓巍鰃鰄霺",
"wéi":"囗韦圩囲围帏沩违闱隹峗峞洈為韋桅涠唯帷惟硙维喡圍媁嵬幃湋溈爲琟違潍維蓶鄬撝潙潿醀濰鍏闈鮠壝矀覹犩欈",
"wěi":"伟伪纬芛苇炜玮洧娓屗捤浘荱诿偉偽唩崣捼梶痏硊萎隗骩媁嵔廆徫愇渨猥葦蒍骫骪暐椲煒瑋痿腲艉韪僞嶉撱碨磈鲔寪緯蔿諉踓韑頠薳儰濻鍡鮪瀢韙颹韡亹瓗斖",
"wèi":"卫未位味苿為畏胃叞軎猚硙菋谓喂喡媦渭爲猬煟墛瞆碨蔚蜼慰熭犚磑緭蝟衛懀罻衞謂餧鮇螱褽餵魏藯轊鏏霨鳚蘶饖瓗讆躗讏躛",
"wēn":"昷塭温缊榅殟溫瑥辒韫榲瘟緼縕豱輼轀鎾饂鳁鞰鰛鰮",
"wén":"文彣芠炆玟闻紋蚉蚊珳阌雯瘒聞馼駇魰鳼鴍螡閺閿蟁闅鼤繧闦",
"wěn":"伆刎吻呅忟抆呡忞歾肳紊桽脗稳穏穩",
"wèn":"问妏汶紋莬問渂揾搵絻顐璺",
"wēng":"翁嗡滃鹟聬螉鎓鶲",
"wěng":"勜奣塕嵡滃蓊暡瞈攚",
"wèng":"瓮蕹甕罋齆",
"wō":"挝倭莴唩涹渦猧萵喔窝窩蜗撾濄緺蝸踒薶",
"wǒ":"呙我咼婑婐捰",
"wò":"仴沃肟卧枂臥偓捾涴媉幄握渥焥硪楃腛斡瞃濣瓁臒龌馧龏齷",
"wū":"乌圬弙扜扝汚汙污邬呜巫杅杇於屋洿诬钨烏剭窏釫惡鄔嗚誈僫歍誣箼鋘螐鴮鎢鰞",
"wú":"无毋吳吴吾呉芜郚唔娪峿洖浯茣莁梧珸祦無铻鹀蜈墲蕪鋙鋘橆璑蟱鯃鵐譕鼯鷡",
"wǔ":"乄五午仵伍妩庑忤怃迕旿武玝侮倵娒捂逜陚啎娬牾堥珷摀碔鹉熓瑦舞嫵廡憮潕儛甒膴瞴鵡躌",
"wù":"兀勿务戊阢屼扤坞岉杌沕芴忢旿物矹俉卼敄柮误務唔娪悟悞悮粅趶晤焐婺嵍惡渞痦隖靰骛塢奦嵨溩雺雾僫寤熃誤鹜鋈窹霚鼿霧齀蘁騖鶩",
"xī":"夕兮邜吸忚扱汐西希扸卥昔析矽穸肸肹俙咥咭徆怸恓诶郗饻唏奚娭屖息悕氥浠牺狶莃唽悉惜晞桸欷淅渓烯焁焈琋硒羛菥赥釸傒惁晰晳焟焬犀睎稀粞翖翕舾鄎厀嵠徯溪煕皙碏蒠裼锡僖榽熄熈熙獡緆蜥覡誒豨閪餏嘻噏嬆嬉嶲憘潝瘜磎膝凞暿樨橀歙熻熺熹窸羲螅螇錫燨犠瞦礂蟋豀谿豯貕蹊巂糦繥釐雟鯑鵗觹譆醯鏭鐊隵嚱巇曦爔犧酅饎觽鼷蠵鸂觿鑴",
"xí":"习郋席習袭觋雭喺媳椺蒵蓆嶍漝趘槢薂隰檄謵鎴霫鳛飁騱騽鰼襲驨",
"xǐ":"杫枲玺徙喜葈葸鈢鉩鉨屣漇蓰銑憘憙暿橲歖禧諰壐縰謑鳃蟢蹝釐璽鰓瓕鱚囍矖纚躧",
"xì":"匸卌扢屃忾饩呬忥怬细郄钑係恄欪盻郤屓欯绤細釳阋傒摡椞舃舄趇隙愾慀滊禊綌蒵赩隟墍熂犔稧戯潟澙蕮覤戱縘黖戲磶虩餼鬩繫闟霼屭衋",
"xiā":"呷虲疨虾谺傄閕煆颬瘕瞎蝦鰕",
"xiá":"匣侠狎俠峡柙炠狭陜埉峽烚狹珨祫捾硖笚翈舺陿徦硤遐敮暇瑕筪舝瘕碬辖磍蕸縖螛赮魻轄鍜霞鎋黠騢鶷",
"xiǎ":"閕閜",
"xià":"丅下乤圷芐疜夏梺廈睱諕嚇懗罅夓鎼鏬",
"xiān":"仚仙屳先奾佡忺氙杴欦祆秈苮姺枮籼珗莶掀铦搟綅跹酰锨僊僲嘕摻銛暹銽韯嬐憸薟鍁繊褼韱鮮蹮馦孅廯攕醶纎鶱襳躚纖鱻",
"xián":"伭咞闲咁妶弦臤贤咸唌挦涎玹盷胘娴娹婱絃舷蚿衔啣湺痫蛝閑閒鹇嗛嫌溓衘甉銜嫻嫺憪撏澖稴羬誸賢諴輱醎癇癎瞯藖礥鹹麙贒鑦鷴鷼鷳",
"xiǎn":"彡冼狝显险崄毨烍猃蚬険赻筅尟尠搟禒蜆跣銑箲險嶮獫獮藓鍌鮮燹顕幰攇櫶蘚譣玁韅顯灦",
"xiàn":"咞岘苋見现线臽限姭宪県陥哯垷娊峴涀莧軐陷埳晛現硍馅睍絤綖缐羡塪搚溓献粯羨腺僩僴槏綫誢憪撊線鋧憲橌橺縣錎餡壏懢豏麲瀗臔獻糮鏾霰鼸",
"xiāng":"乡芗香郷厢啍鄉鄊廂湘缃萫葙鄕楿稥薌箱緗膷襄儴勷忀骧麘欀瓖镶鱜纕鑲驤",
"xiáng":"夅瓨佭庠羏栙祥絴翔詳跭",
"xiǎng":"享亯响蚃饷晑飨想銄餉鲞蠁鮝鯗響饗饟鱶",
"xiàng":"向姠项珦象缿衖項像勨嶑潒銗閧曏橡襐闂嚮蟓鐌鱌",
"xiāo":"灲灱呺枭侾哓枵骁宯宵庨消烋绡莦虓逍鸮婋梟焇猇萧痚痟睄硣硝窙翛销嗃揱綃蛸嘐歊潇熇箫踃嘵憢撨獟獢箾銷霄骹彇膮蕭颵魈鴞穘簘藃蟂蟏鴵嚣瀟簫蟰髇櫹嚻囂髐鷍蠨驍毊虈",
"xiáo":"姣洨郩崤淆訤殽誵",
"xiǎo":"小晓暁筱筿皛曉篠謏皢",
"xiào":"孝効咲恔俲哮效涍笑啸傚敩殽嗃詨嘋嘨誟嘯薂歗熽斅斆",
"xiē":"娎揳猲楔歇滊獦蝎蠍",
"xié":"劦协旪協胁垥奊峫恊拹挾脇脅脋衺偕斜梋谐絜翓颉嗋愶慀搚携瑎綊熁膎鲑勰撷擕緳縀缬蝢鞋諧燲鮭嚡擷鞵儶襭孈攜讗龤",
"xiě":"写冩寫藛",
"xiè":"伳灺泻祄绁缷卸枻洩炨炧卨屑栧偞偰徢械烲焎禼紲亵媟屟渫絏絬谢僁塮觟觧榍榝榭褉靾噧寫屧暬樧碿緤嶰廨懈澥獬糏薤薢邂韰燮褻謝夑瀉鞢韘瀣爕繲蟹蠏齘齛纈齥齂躠躞",
"xīn":"忄心邤妡忻辛昕杺欣盺俽莘惞訢鈊锌新歆廞鋅噺噷嬜薪馨鑫馫",
"xín":"枔襑镡礥鐔",
"xǐn":"伈",
"xìn":"阠伩囟孞炘軐脪衅訫愖焮馸顖舋釁",
"xīng":"狌星垶骍惺猩煋瑆腥觪箵篂興謃鮏曐觲騂皨鯹",
"xíng":"刑邢饧巠形陉侀郉哘型洐荥钘陘娙硎铏鈃蛵滎鉶銒鋞餳",
"xǐng":"睲醒擤",
"xìng":"杏姓幸性荇倖莕婞悻涬葕睲緈鋞嬹臖",
"xiōng":"凶匂兄兇匈芎讻忷汹哅恟洶胷胸訩詾賯",
"xióng":"雄熊熋",
"xiǒng":"焽焸",
"xiòng":"诇詗夐敻",
"xiū":"俢修咻庥烌烋羞脩脙鸺臹貅馐樇銝髤髹鎀鮴鵂鏅饈鱃飍",
"xiú":"苬",
"xiǔ":"朽滫潃糔",
"xiù":"秀岫峀珛绣袖琇锈嗅溴綉璓褏褎銹螑嚊繍鏅繡鏥鏽齅",
"xū":"圩戌旴姁疞盱欨砉胥须眗訏顼偦虗虚裇許谞媭揟欻湏湑虛須楈綇頊嘘墟稰蓲需魆噓嬃歔緰縃蕦蝑歘藇諝燸譃魖驉鑐鬚",
"xú":"俆冔徐禑蒣",
"xǔ":"呴姁诩浒栩珝喣湑蛡暊詡滸稰鄦糈諿醑盨",
"xù":"旭伵序旴汿芧侐卹妶怴沀叙恓恤昫朐洫垿晇欰殈烅珬勗勖喐惐掝敍敘淢烼绪续蚼酗壻婿朂溆矞絮聓訹慉滀煦続蓄賉槒漵潊盢瞁緒聟蓿銊嘼獝稸緖藇藚續鱮",
"xuān":"吅轩昍咺宣弲晅軒梋谖喧塇媗愃愋揎萲萱暄煊瑄蓒睻儇禤箮翧蝖鋗嬛懁蕿諠諼鞙駨鍹駽矎翾藼蘐蠉譞鰚讂",
"xuán":"玄伭妶玹痃悬琁蜁嫙漩暶璇縣檈璿懸",
"xuǎn":"咺选烜喛暅選癣癬",
"xuàn":"怰泫昡炫绚眩袨铉琄眴衒渲絢楥楦鉉夐敻碹蔙镟颴縼繏鏇贙",
"xuē":"疶蒆靴薛辥辪鞾",
"xué":"穴斈乴学峃茓泶袕鸴敩踅噱壆學嶨澩燢觷鷽",
"xuě":"彐雪樰膤艝轌鳕鱈",
"xuè":"吷坹岤怴泬狘疦桖谑滈趐謔瞲瀥",
"xūn":"坃勋埙焄勛塤煇窨勲勳薫嚑壎獯薰曛燻臐矄蘍壦爋纁醺",
"xún":"廵寻巡旬杊畃询郇咰姰峋恂洵浔紃荀荨栒桪毥珣偱眴尋循揗詢鄩鲟噚潯蕁攳樳燅燖璕駨蟫蟳爓鱘鱏灥",
"xùn":"卂训讯伨汛迅驯侚巺徇狥迿逊孫殉毥浚訊訓訙奞巽殾稄遜馴愻噀潠蕈濬爋顨鶽鑂",
"ya":"",
"yā":"丫圧吖亞庘押枒垭鸦桠鸭啞孲铔椏鴉錏鴨壓鵶鐚",
"yá":"牙伢厑岈芽厓拁琊笌蚜堐崕崖涯猚釾睚衙漄齖",
"yǎ":"疋厊庌挜疨唖啞掗痖雅瘂蕥",
"yà":"劜圠轧亚冴襾覀讶亜犽迓亞玡軋姶娅挜砑俹氩埡婭掗訝铔揠氬猰聐圔椻稏碣窫潝磍壓瓛齾",
"yān":"恹剦烟珚胭崦淊淹焑焉菸阉殗渰湮傿歅煙硽鄢嫣漹嶖樮醃橪閹閼嬮懨篶懕臙黫黰",
"yán":"讠厃延闫严妍芫訁言岩昖沿炏炎郔唌埏姸娫狿莚娮梴盐啱琂硏訮閆阎喦嵓嵒筵綖蜒塩揅楌詽碞蔅羬颜厳虤閻檐顏顔嚴壛巌簷櫩壧巖巗欕礹鹽麣",
"yǎn":"夵抁沇乵兖俨兗匽弇衍剡偃厣掞掩眼萒郾酓隁嵃愝扊揜晻棪渰渷琰遃隒椼硽罨裺演褗戭窴蝘魇噞嬐躽縯檿黡厴甗鰋鶠黤儼黬黭龑孍顩鼴巘巚曮魘鼹礹齴黶",
"yàn":"厌妟觃牪匽姲彥彦洝砚唁宴晏烻艳覎验偐掞焔猏硏谚隁喭堰敥棪殗焱焰猒硯雁傿椻溎滟豣鳫厭墕暥熖酽鳱嬊谳餍鴈燄諺赝鬳嚈嬮曕鴳酀騐験嚥嬿艶贋軅曣爓醶騴齞鷃灔贗囐觾讌醼饜驗鷰艷灎釅驠灧讞豓豔灩",
"yāng":"央姎抰泱柍殃胦眏秧鸯鉠雵鞅鍈鴦",
"yáng":"扬阦阳旸杨炀玚飏佯劷氜疡钖垟徉昜洋羏烊珜眻陽婸崵崸愓揚蛘敭暘楊煬瑒禓瘍諹輰鍚鴹颺鰑霷鸉",
"yǎng":"卬佒咉坱岟养柍炴氧眏痒紻傟勜楧軮慃氱蝆飬養駚懩攁瀁癢礢",
"yàng":"怏柍恙样烊羕楧詇煬様漾鞅樣瀁",
"yāo":"幺夭吆妖枖殀祅約訞喓葽楆腰鴁撽邀鴢",
"yáo":"爻尧匋尭肴垚姚峣恌轺倄烑珧皐窕窑铫隃傜堯揺殽谣軺嗂媱徭愮搖摇滧猺遙遥僥摿暚榣瑤瑶銚飖餆嶢嶤徺磘窯窰餚繇謡謠鎐鳐颻蘨邎顤鰩鱙",
"yǎo":"仸宎岆抭杳枖狕苭咬柼眑窅窈舀偠婹崾溔蓔榚闄騕齩鷕",
"yào":"怮穾药烄袎窔筄葯詏愮熎瘧覞靿樂獟箹鹞薬鼼曜燿艞藥矅耀纅鷂讑",
"ye":"亪",
"yē":"吔耶倻椰暍歋窫噎潱擨蠮",
"yé":"爷耶峫捓揶铘爺瑘釾鋣鎁",
"yě":"也冶埜野嘢漜壄",
"yè":"业曳页曵邺夜抴亱拽枼洂頁捙晔枽烨液焆谒堨揲殗腋葉墷楪業煠痷馌僷曅燁璍擖擛曄皣瞱緤鄴靥嶪嶫澲謁餣擫曗瞸鍱擪爗礏鎑饁鵺鐷靨驜瓛鸈",
"yi":"弬",
"yī":"一乊弌辷衤伊衣医吚壱依祎咿洢悘渏猗畩郼铱壹揖蛜禕嫛漪稦銥嬄撎噫夁瑿鹥繄檹毉醫黟譩鷖黳",
"yí":"乁仪匜圯夷彵迆冝宐杝沂诒侇宜怡沶狏狋迤迱饴咦姨峓恞拸柂洟珆瓵荑贻迻宧巸扅栘桋眙胰袘貤痍移萓釶椬羠蛦詒貽遗媐暆椸煕誃跠頉颐飴儀熪箷遺嶬彛彜螔頥頤寲嶷簃顊鮧鴺彞彝謻鏔籎觺讉",
"yǐ":"乚乛乙已以扡迆钇佁攺矣苡叕苢迤迱庡舣蚁釔倚扆笖逘酏偯猗崺攲敧旑鈘鉯鳦裿旖輢嬟敼螘檥礒艤蟻顗轙齮",
"yì":"乂义亿弋刈忆艺仡匇肊艾议阣亦伇屹异忔芅伿佚劮呓坄役抑杙耴苅译邑佾呭呹妷峄怈怿易枍欥泆炈秇绎衪诣驿俋奕帟帠弈昳枻浂玴疫羿轶唈垼悒挹栺栧欭浥浳益袘袣谊貤勚埶埸悘悥掜殹異羛翊翌萟訳訲豙豛逸釴隿幆敡晹棭殔湙焲焬蛡詍跇軼鄓鈠骮亄兿嗌意溢獈痬睪竩缢義肄裔裛詣勩嫕廙榏潩瘗膉蓺蜴駅億槸毅熠熤熼瘞篒誼镒鹝鹢黓儗劓圛墿嬑嶧憶懌曀殪澺燚瘱瞖穓縊艗薏螠褹寱懝斁曎檍歝燡燱翳翼臆貖鮨癔藝藙贀鎰镱繶繹豷霬鯣鶃鶂鶍瀷蘙議譯醳醷饐囈鐿鷁鷊懿襼驛鷧虉鸃鷾讛齸",
"yīn":"囙因阥阴侌垔姻洇茵荫音骃栶欭氤陰凐秵裀铟陻隂喑堙婣愔湮筃絪歅溵禋蒑蔭慇瘖銦磤緸鞇諲霒駰噾濦闉霠齗韾",
"yín":"冘乑伒吟圻犾苂斦烎垠泿圁峾狺珢荶訔訚唫婬寅崟崯淫訡银鈝龂滛碒鄞夤蔩銀龈噖殥璌誾嚚檭蟫霪齦鷣",
"yǐn":"廴尹引吲饮粌蚓硍赺淾鈏飲隠靷飮朄輑磤趛檃瘾隱嶾濥縯螾檼蘟櫽癮讔",
"yìn":"廴印茚洕胤荫垽梀堷湚猌飲廕隠飮窨酳慭癊憗憖隱鮣懚",
"yīng":"応旲英柍荥偀桜珱莺啨婴媖愥渶绬朠楧焽焸煐瑛嫈碤锳嘤撄甇緓缨罂蝧賏樱璎噟罃褮霙鴬鹦嬰應膺韺甖鹰鶑鶧嚶孆孾攖瀴罌蘡譍櫻瓔礯譻鶯鑍纓蠳鷪軈鷹鸎鸚",
"yíng":"夃盁迎茔盈荧浧耺莹営桯萤萦营蛍溁溋萾僌塋嵤楹滢蓥滎潆熒蝇瑩禜蝿嬴營縈螢濙濚濴藀覮謍赢瀅爃蠅鎣巆攍瀛瀠瀯櫿贏灐籝灜籯",
"yǐng":"矨郢浧梬颍颕颖摬影潁瘿穎頴覮巊廮瀴鐛癭",
"yìng":"応映眏暎硬媵膡鞕應瀴鱦",
"yo":"喲",
"yō":"唷喲",
"yōng":"拥痈邕庸傭嗈鄘雍墉嫞慵滽槦牅牗銿噰壅擁澭郺镛臃癕雝鏞鳙廱灉饔鱅鷛癰",
"yóng":"喁揘颙顒鰫",
"yǒng":"永甬咏怺泳俑勈勇栐埇悀柡恿惥愑湧硧詠塎嵱彮愹蛹慂踊鲬噰澭踴鯒",
"yòng":"用苚砽蒏醟",
"yōu":"优妋忧攸呦怮泑幽峳浟逌悠羪麀滺憂優鄾嚘懮瀀獶櫌纋耰獿",
"yóu":"尢冘尤由甴汼沋犹邮怞油肬怣斿柚疣庮秞莜莤莸郵铀偤蚰訧逰揂游猶遊鱿楢猷鈾鲉輏駀蕕蝣魷輶鮋繇櫾",
"yǒu":"友丣卣苃酉羑栯莠梄聈铕湵楢禉蜏銪槱牖牗黝懮",
"yòu":"又右幼佑佦侑孧泑狖哊囿姷宥峟柚牰祐诱迶唀梎痏蚴亴貁釉酭誘鼬櫾",
"yū":"込扜扝纡迃迂穻陓紆唹淤盓瘀箊",
"yú":"丂亐于邘伃余妤扵杅欤玗玙於盂臾衧鱼乻俞兪捓禺竽舁茰虶娛娯娪娱桙狳谀酑馀渔萸釪隃隅雩魚堣堬婾媀媮崳嵎嵛揄楰渝湡畬腴萮逾骬愚楡榆歈牏瑜艅虞觎漁睮窬舆褕歶羭蕍蝓諛雓餘魣嬩懙澞覦踰歟璵螸輿鍝謣髃鮽旟籅騟鯲蘛轝鰅鷠鸆齵",
"yǔ":"伛宇屿羽穻俁俣挧禹圄祤偊匬圉庾敔鄅斞萭傴寙楀瑀瘐與語窳頨龉噳嶼懙貐斔穥麌齬",
"yù":"肀玉驭圫聿芌芋吾妪忬汩灹饫欥育郁俞昱狱禺秗茟俼叞峪彧栯浴砡钰预域堉悆惐捥欲淢淯痏粖翑袬谕逳阈喅喩喻媀寓庽御棛棜棫焴琙琟矞硢硲裕遇飫馭鹆奧愈滪煜稢罭艈蒮蓣誉鈺預僪嫗嶎戫毓澚獄瘉緎蜟蜮語輍銉隩慾潏熨稶蓹薁豫遹鋊鳿澦燏燠蕷藇諭錥閾鴧鴪鴥儥礇禦魊鹬癒礖礜篽醧鵒櫲饇蘌譽鐭霱雤欎驈鬻籞鱊鷸鸒欝軉鬰鬱灪籲爩",
"yuān":"夗囦肙鸢剈冤弲悁眢鸳寃涴渆渁渊渕惌淵葾棩蒬蜎裷鹓箢鳶蜵駌鋺鴛嬽鵷灁鼘鼝",
"yuán":"元円贠邧园妧沅芫杬茒垣爰貟原員圆笎蚖袁厡酛傆喛圎媛援湲猨缘鈨鼋園圓塬媴嫄楥溒源猿蒝榞榬辕緣縁蝝蝯褤魭圜橼羱薗螈黿謜轅鎱櫞邍騵鶢鶰厵",
"yuǎn":"盶逺遠薳鋺",
"yuàn":"夗妴苑怨院垸衏傆媛掾瑗禐愿裫褑噮願",
"yuē":"曰曱扚約啘箹矱",
"yuě":"哕噦",
"yuè":"月戉兊刖兌妜岄抈礿岳枂泧玥恱栎哾悅悦蚏蚎軏钺阅捳跀跃粤越鈅楽粵鉞說説樂閲閱嬳樾篗髺嶽臒龠擽矆櫟籆瀹蘥黦爚禴趯躍籥鑰鸑籰鸙",
"yūn":"涒缊蒀暈氲煴蒕氳熅煾奫緼蝹縕赟馧贇",
"yún":"云勻匀伝囩妘抣沄纭芸昀畇眃秐貟郧員涢紜耘耺鄖雲愪溳筠筼蒷熉澐蕓鋆橒篔縜",
"yǔn":"允阭夽抎狁玧陨荺殒喗鈗隕煴殞熅馻磒賱霣齫齳",
"yùn":"孕贠运枟郓恽貟員菀鄆酝傊惲愠缊運慍暈榅煇腪韫韵褞熨緷緼蕰蕴縕薀醖醞餫藴鞰韗韞蘊韻",
"zā":"帀匝沞迊咂拶桚紥紮鉔噈魳臜臢",
"zá":"杂沯砸偺喒韴雑襍雜囃囋囐雥",
"zǎ":"咋偺喒",
"zāi":"災灾甾哉栽烖畠菑渽溨睵賳",
"zǎi":"宰崽",
"zài":"再在扗抂洅傤載酨儎縡",
"zān":"兂撍糌橵篸簪簮鵤鐕鐟",
"zán":"偺喒",
"zǎn":"拶昝桚寁揝噆撍儧攅儹攢趱趲",
"zàn":"暂暫賛赞錾鄼濽蹔酂瓉贊鏩鏨瓒酇囋灒讃瓚禶穳襸讚饡",
"zāng":"匨牂羘赃賍臧賘贓髒贜",
"zǎng":"驵駔",
"zàng":"奘弉脏塟葬臧蔵銺臓臟",
"zāo":"傮遭糟蹧醩",
"záo":"凿鑿",
"zǎo":"早枣栆蚤棗璅澡璪薻藻",
"zào":"灶皁皂唣唕造梍喿慥煰艁噪簉燥竃竈譟趮躁",
"zé":"则択沢咋泎责迮則唶啧帻笮舴責溭滜睪矠飵嘖嫧幘箦蔶樍歵諎赜擇澤皟瞔簀耫礋襗謮賾蠌灂齚齰鸅",
"zè":"仄庂汄昃昗捑側崱稄",
"zéi":"贼戝賊鲗蠈鰂鱡",
"zēn":"撍",
"zěn":"怎",
"zèn":"谮譖",
"zēng":"曽増鄫增憎缯橧璔縡矰磳竲罾繒譄鱛",
"zěng":"",
"zèng":"锃綜缯鋥熷甑赠繒鬵贈囎",
"zi":"嗭",
"zī":"孖孜甾茊兹呲咨姕姿茲栥玆畠紎赀资崰淄秶缁菑谘赼嗞孳嵫椔湽滋粢葘辎鄑孶禌觜訾貲資趑锱稵緕緇鈭镃龇輜鼒澬薋諮趦輺錙髭鲻鍿鎡璾頾頿鯔鶅齍纃鰦齜",
"zí":"蓻",
"zǐ":"子吇芓姉姊杍沝矷秄胏呰秭籽耔茈虸笫梓釨啙紫滓訿榟橴",
"zì":"字自芓秄洓茡荢倳剚恣牸渍眦眥菑胔胾漬",
"zōng":"宗枞倧骔堫嵏嵕惾棕猣腙葼朡椶潈稯綜緃樅熧緵翪蝬踨踪磫繌鍐豵蹤騌鬃騣鬉鬷鯮鯼鑁",
"zǒng":"总倊偬捴惣揔搃焧傯蓗嵸摠潀稯総熜緫縂燪縱總",
"zòng":"昮疭從猔碂粽潨糉緵瘲縦縱繌糭",
"zōu":"邹驺诹郰陬掫菆棸棷鄒箃緅諏鄹鲰鯫黀騶齱齺",
"zǒu":"赱走搊鯐",
"zòu":"奏揍媰楱",
"zū":"怚柤租菹葅蒩",
"zú":"卆足倅哫崒崪族椊稡箤踤镞鎐鏃",
"zǔ":"诅阻组俎柤爼珇祖唨組詛靻鎺",
"zù":"",
"zuān":"鉆劗躜鑚躦鑽",
"zuǎn":"繤缵纂纉籫纘",
"zuàn":"揝篹賺攥",
"zuī":"厜朘嗺樶蟕纗",
"zuí":"",
"zuǐ":"咀觜嶊嘴噿濢璻",
"zuì":"冣栬絊酔晬最祽睟稡罪辠槜酻蕞醉嶵檇鋷錊檌欈",
"zūn":"尊噂墫嶟遵樽繜罇鶎鐏鳟鱒鷷",
"zǔn":"僔撙繜譐",
"zùn":"拵捘栫袸銌瀳",
"zuo":"咗",
"zuō":"嘬穝",
"zuó":"苲昨柮秨莋捽笮稓筰鈼",
"zuǒ":"左佐繓",
"zuò":"作坐阼岝岞怍侳柞祚胙唑座袏做葄葃酢蓙飵諎糳",
"zhā":"吒咋抯挓柤査哳紥偧紮揸渣楂飵劄摣潳皶樝觰皻譇齄齇",
"zhá":"札甴軋闸剳蚻铡喋煠牐閘劄箚霅耫鍘譗",
"zhǎ":"厏拃苲眨砟鲊鲝諎鮓鮺",
"zhà":"乍吒灹诈怍咤奓柞宱痄蚱喥溠詐搾鲊榨鮓醡",
"zhāi":"亝哜夈粂捚斋側斎摘榸齊嚌擿齋",
"zhái":"厇宅翟擇檡",
"zhǎi":"厏抧窄鉙",
"zhài":"责债砦責債寨瘵",
"zhān":"岾怗枬沾毡旃栴粘蛅飦惉詀趈詹閚谵鳽噡嶦薝邅霑氈氊瞻覱鹯旜譫饘鳣驙魙鱣鸇",
"zhán":"讝",
"zhǎn":"斩飐展盏斬琖搌盞嶃嶄榐辗颭嫸醆橏輾皽黵",
"zhàn":"佔战栈桟站偡绽菚嵁棧湛戦碊僝綻嶘戰虥虦覱轏譧欃蘸驏",
"zhāng":"弡张張章傽鄣嫜彰慞漳獐粻蔁遧暲樟璋餦蟑鏱騿鱆麞",
"zhǎng":"仉仧兏長掌漲幥礃鞝",
"zhàng":"丈仗扙帐杖胀账粀帳涱脹痮障墇嶂幛漲賬瘬瘴瞕",
"zhāo":"佋钊妱巶招昭炤釗啁釽鉊鳭駋鍣皽",
"zháo":"",
"zhǎo":"爫找沼菬瑵",
"zhào":"兆诏枛垗炤狣赵笊肁啅旐棹罀詔照罩箌肈肇趙曌濯燳鮡櫂瞾羄",
"zhe":"嗻",
"zhē":"嗻嫬遮螫",
"zhé":"乇厇扸杔歽矺砓籷虴哲埑粍袩啠悊晢晣辄喆棏聑蛰詟搩蜇谪馲摺輒慹磔輙銸辙蟄嚞謫謺鮿轍讁讋",
"zhě":"者乽啫锗赭踷褶鍺襵",
"zhè":"柘浙這淛嗻蔗樜鹧蟅鷓",
"zhèi":"",
"zhēn":"贞针侦侲帧枮浈珎珍胗貞帪桢眞真砧祯針偵酙寊幀揕湞葴遉嫃搸斟椹楨溱獉甄禎蒖蓁鉁榛槙殝瑧碪禛潧箴樼澵臻薽錱轃鍼籈鱵",
"zhén":"",
"zhěn":"诊抮枕姫弫昣轸屒畛疹眕袗紾聄萙竧裖覙診軫嫃缜槙稹駗縝縥辴鬒黰",
"zhèn":"圳阵纼甽侲挋陣鸩振朕栚紖桭眹赈塦揕絼榐瑱誫賑鋴镇震鴆鎮鎭",
"zhēng":"凧争佂姃征怔爭糽埩峥炡狰烝眐脀钲埥崝崢掙猙睁聇铮媜揁筝徰睜蒸踭鉦徴箏綪錚徵篜鬇癥鏳",
"zhěng":"氶抍糽拯掟晸愸撜整",
"zhèng":"氶证诤郑政徎钲掙幁証塣諍靕鄭憕鴊證",
"zhī":"之支卮汁芝巵汥呮泜肢栀祗秓胑胝衼倁栺疷祬脂隻梔菭椥臸搘稙綕榰蜘馶憄鳷鴲織鼅蘵",
"zhí":"执侄妷直秇姪郦値值聀釞埴執淔职戠植犆禃絷臷跖瓡摕摭馽嬂慹漐潪踯樴膱縶職蟙蹠軄躑",
"zhǐ":"夂止凪劧旨阯坁址帋扺汦沚纸芷坧抧杫祇祉茋咫恉指枳洔砋秖衹轵淽疻紙蚔訨趾軹黹禔筫絺酯墌徴徵槯藢襧",
"zhì":"至芖坁志忮扻豸制厔垁帙帜斦治炙质迣郅俧峙庢庤挃柣栉洷祑陟娡徏挚捗晊桎歭狾秩致袟贽轾乿偫剬徝掷梽楖猘畤痓痔眰秲秷窒紩翐袠觗貭铚鸷傂崻彘智滞痣蛭骘寘廌搱滍稚筫置跱輊锧雉墆滯潌疐瘈聜製覟誌銍幟憄摨摯潪熫稺膣觯質踬銴鋕擳旘瀄璏緻隲駤鴙儨劕懥擲擿櫛穉螲懫織贄櫍瓆觶騭鯯礩豑鶨騺驇躓鷙鑕豒",
"zhōng":"夂伀汷刣妐彸忪忠泈炂终柊盅衳钟舯衷終鈡幒蔠蜙锺銿螤鴤螽鍾斔鼨蹱鐘籦",
"zhǒng":"肿冢喠尰塚歱煄腫瘇種徸踵穜",
"zhòng":"仲众妕狆祌茽衶蚛偅眾堹媑筗衆種緟諥",
"zhōu":"州舟诌侜周洲炿诪烐珘辀郮啁婤徟掫淍矪週鸼喌赒輈翢銂賙輖霌駲嚋盩謅鵃騆譸",
"zhóu":"妯軸碡",
"zhǒu":"肘帚疛胕菷晭睭箒鯞",
"zhòu":"纣伷呪咒宙绉冑咮昼紂胄荮皱酎晝粙椆葤詋軸甃僽皺駎噣縐繇薵骤籀籕籒驟",
"zhū":"侏诛邾洙茱株珠诸猪硃秼袾铢絑蛛誅跦槠潴蕏蝫銖橥諸豬駯鮢鴸瀦藸鼄櫧櫫鯺蠩",
"zhú":"朮竹竺炢笁茿烛窋逐笜舳逫瘃蓫敱磩築篴斀燭蠋躅鱁劚孎灟斸曯欘爥蠾钃",
"zhǔ":"丶主劯宔拄砫罜陼帾渚煑煮詝褚嘱濐燝麈瞩屬囑鸀矚",
"zhù":"伫佇住纻芧苎坾拀杼注苧贮迬驻乼壴柱柷殶炷祝疰眝砫祩竚莇紵紸羜蛀尌嵀註貯跓軴铸筯鉒飳馵嗻墸箸翥樦澍鋳駐築篫麆簗櫡鑄",
"zhuā":"抓挝撾檛膼簻髽",
"zhuǎ":"爫",
"zhuāi":"拽",
"zhuǎi":"跩",
"zhuài":"拽睉",
"zhuān":"专叀専恮砖耑專剸鄟塼嫥漙瑼甎磗膞颛磚諯篿蟤顓鱄",
"zhuǎn":"孨転膞竱轉",
"zhuàn":"灷啭転堟蒃傳瑑腞僎僝赚撰篆馔篹縳襈賺簨贃譔饌囀籑",
"zhuāng":"妆庄妝庒荘娤桩莊梉湷粧装裝樁糚",
"zhuǎng":"奘",
"zhuàng":"壮壯状狀壵焋僮漴撞戅戆戇",
"zhuī":"隹骓锥錐騅鵻",
"zhuǐ":"沝",
"zhuì":"坠笍奞娷缀隊惴甀缒腏畷硾膇墜綴赘縋諈醊錣礈贅鑆",
"zhūn":"圫宒忳迍肫窀谆啍諄衠",
"zhǔn":"准埻凖準稕綧",
"zhùn":"旽訰稕綧",
"zhuō":"拙炪倬捉桌梲棁涿淖棳棹焯窧槕穛鐯穱",
"zhuó":"圴彴汋犳灼卓叕妰茁斫浊丵剢捔浞烵诼酌啄啅娺聉斱斮晫椓琸硺窡罬蓔墌撯擆斲禚劅諁諑趠鋜噣濁燋篧擢斀斵濯藋櫡謶镯繳鵫灂蠗鐲籗鷟蠿籱",
"zhuò":"",
"chǎng,ān,hàn": "厂",
"dīng,zhēng": "丁",
"bǔ,bo": "卜",
"jǐ,jī": "几",
"le,liǎo": "了",
"gān,gàn": "干",
"dà,dài,tài": "大",
"yǔ,yù,yú": "与",
"shàng,shǎng": "上",
"wàn,mò": "万",
"gè,gě": "个各",
"me,mó,ma,yāo": "么",
"guǎng,ān": "广",
"wáng,wú": "亡",
"nǚ,rǔ": "女",
"chā,chá,chǎ": "叉",
"wáng,wàng": "王",
"fū,fú": "夫",
"zhā,zā,zhá": "扎",
"bù,fǒu": "不",
"qū,ōu": "区",
"chē,jū": "车",
"qiè,qiē": "切",
"wǎ,wà": "瓦",
"tún,zhūn": "屯",
"shǎo,shào": "少",
"zhōng,zhòng": "中",
"nèi,nà": "内",
"jiàn,xiàn": "见",
"cháng,zhǎng": "长",
"shén,shí": "什",
"piàn,piān": "片",
"pú,pū": "仆",
"huà,huā": "化",
"chóu,qiú": "仇",
"zhuǎ,zhǎo": "爪",
"jǐn,jìn": "仅",
"fù,fǔ": "父",
"cóng,zòng": "从",
"fēn,fèn": "分",
"shì,zhī": "氏",
"fēng,fěng": "风",
"gōu,gòu": "勾",
"liù,lù": "六",
"dǒu,dòu": "斗",
"wèi,wéi": "为",
"chǐ,chě": "尺",
"yǔ,yú": "予",
"dǎ,dá": "打",
"zhèng,zhēng": "正症挣",
"bā,pá": "扒",
"jié,jiē": "节结",
"shù,shú,zhú": "术",
"kě,kè": "可",
"shí,dàn": "石",
"kǎ,qiǎ": "卡",
"běi,bèi": "北",
"zhàn,zhān": "占",
"qiě,jū": "且",
"yè,xié": "叶",
"hào,háo": "号",
"zhī,zhǐ": "只",
"dāo,tāo": "叨",
"zǎi,zǐ,zī": "仔",
"lìng,líng,lǐng": "令",
"lè,yuè": "乐",
"jù,gōu": "句",
"chù,chǔ": "处",
"tóu,tou": "头",
"níng,nìng,zhù": "宁",
"zhào,shào": "召",
"fā,fà": "发",
"tái,tāi": "台苔",
"káng,gāng": "扛",
"dì,de": "地",
"sǎo,sào": "扫",
"chǎng,cháng": "场",
"pǔ,pò,pō,piáo": "朴",
"guò,guo,guō": "过",
"yā,yà": "压",
"yǒu,yòu": "有",
"kuā,kuà": "夸",
"xié,yá,yé,yú,xú": "邪",
"jiá,jiā,gā,xiá": "夹",
"huà,huá": "划",
"dāng,dàng": "当",
"tù,tǔ": "吐",
"xià,hè": "吓",
"tóng,tòng": "同",
"qū,qǔ": "曲",
"ma,má,mǎ": "吗",
"qǐ,kǎi": "岂",
"zhū,shú": "朱",
"chuán,zhuàn": "传",
"xiū,xǔ": "休",
"rèn,rén": "任",
"huá,huà,huā": "华",
"jià,jiè,jie": "价",
"fèn,bīn": "份",
"yǎng,áng": "仰",
"xiě,xuè": "血",
"sì,shì": "似",
"háng,xíng": "行",
"huì,kuài": "会",
"hé,gě": "合",
"chuàng,chuāng": "创",
"chōng,chòng": "冲",
"qí,jì,zī,zhāi": "齐",
"yáng,xiáng": "羊",
"bìng,bīng": "并",
"hàn,hán": "汗",
"tāng,shāng": "汤",
"xīng,xìng": "兴",
"xǔ,hǔ": "许",
"lùn,lún": "论",
"nà,nǎ,nèi,nā": "那",
"jìn,jǐn": "尽",
"sūn,xùn": "孙",
"xì,hū": "戏",
"hǎo,hào": "好",
"tā,jiě": "她",
"guān,guàn": "观冠",
"hóng,gōng": "红",
"xiān,qiàn": "纤",
"jì,jǐ": "纪济",
"yuē,yāo": "约",
"nòng,lòng": "弄",
"yuǎn,yuàn": "远",
"huài,pēi,pī,péi": "坏",
"zhé,shé,zhē": "折",
"qiǎng,qiāng,chēng": "抢",
"ké,qiào": "壳",
"fāng,fáng": "坊",
"bǎ,bà": "把",
"gān,gǎn": "杆",
"sū,sù": "苏",
"gàng,gāng": "杠",
"gèng,gēng": "更",
"lì,lí": "丽",
"hái,huán": "还",
"fǒu,pǐ": "否",
"xiàn,xuán": "县",
"zhù,chú": "助",
"ya,yā": "呀",
"chǎo,chāo": "吵",
"yuán,yún,yùn": "员",
"ba,bā": "吧",
"bié,biè": "别",
"dīng,dìng": "钉",
"gū,gù": "估",
"hé,hē,hè": "何",
"tǐ,tī,bèn": "体",
"bó,bǎi,bà": "伯",
"yòng,yōng": "佣",
"fó,fú,bì,bó": "佛",
"dù,dǔ": "肚",
"guī,jūn,qiū": "龟",
"jiǎo,jué": "角",
"tiáo,tiāo": "条",
"xì,jì": "系",
"yìng,yīng": "应",
"zhè,zhèi": "这",
"jiān,jiàn": "间监",
"mēn,mèn": "闷",
"dì,tì,tuí": "弟",
"shā,shà": "沙",
"shà,shā": "煞",
"méi,mò": "没",
"shěn,chén": "沈",
"shí,zhì": "识",
"niào,suī": "尿",
"wěi,yǐ": "尾",
"ē,ā": "阿",
"jìn,jìng": "劲",
"zòng,zǒng": "纵",
"wén,wèn": "纹",
"mǒ,mò,mā": "抹",
"dān,dàn,dǎn": "担",
"chāi,cā": "拆",
"jū,gōu": "拘",
"lā,lá": "拉",
"bàn,pàn": "拌",
"zé,zhái": "择",
"qí,jī": "其奇",
"ruò,rě": "若",
"píng,pēng": "苹",
"zhī,qí": "枝",
"guì,jǔ": "柜",
"sàng,sāng": "丧",
"cì,cī": "刺",
"yǔ,yù": "雨语",
"bēn,bèn": "奔",
"qī,qì": "妻",
"zhuǎn,zhuàn,zhuǎi": "转",
"xiē,suò": "些",
"ne,ní": "呢",
"tiě,tiē,tiè,": "帖",
"lǐng,líng": "岭",
"zhī,zhì": "知织",
"hé,hè,huó,huò,hú": "和",
"gòng,gōng": "供共",
"wěi,wēi": "委",
"cè,zè,zhāi": "侧",
"pò,pǎi": "迫",
"de,dì,dí": "的",
"cǎi,cài": "采",
"fú,fù": "服",
"dǐ,de": "底",
"jìng,chēng": "净",
"juàn,juǎn": "卷",
"quàn,xuàn": "券",
"dān,shàn,chán": "单",
"qiǎn,jiān": "浅",
"xiè,yì": "泄",
"pō,bó": "泊",
"pào,pāo": "泡",
"ní,nì": "泥",
"zé,shì": "泽",
"kōng,kòng,kǒng": "空",
"láng,làng": "郎",
"xiáng,yáng": "详",
"lì,dài": "隶",
"shuā,shuà": "刷",
"jiàng,xiáng": "降",
"cān,shēn,cēn,sān": "参",
"dú,dài": "毒",
"kuà,kū": "挎",
"dǎng,dàng": "挡",
"kuò,guā": "括",
"shí,shè": "拾",
"tiāo,tiǎo": "挑",
"shèn,shén": "甚",
"xiàng,hàng": "巷",
"nán,nā": "南",
"xiāng,xiàng": "相",
"chá,zhā": "查",
"bǎi,bó,bò": "柏",
"yào,yāo": "要",
"yán,yàn": "研",
"qì,qiè": "砌",
"bèi,bēi": "背",
"shěng,xǐng": "省",
"xiāo,xuē": "削",
"hǒng,hōng,hòng": "哄",
"mào,mò": "冒",
"yǎ,yā": "哑",
"sī,sāi": "思",
"mǎ,mā,mà": "蚂",
"huá,huā": "哗",
"yè,yàn,yān": "咽",
"zán,zǎ": "咱",
"hā,hǎ,hà": "哈",
"nǎ,něi,na,né": "哪",
"hāi,ké": "咳",
"gǔ,gū": "骨",
"gāng,gàng": "钢",
"yào,yuè": "钥",
"kàn,kān": "看",
"zhòng,zhǒng,chóng": "种",
"biàn,pián": "便",
"zhòng,chóng": "重",
"xìn,shēn": "信",
"zhuī,duī": "追",
"dài,dāi": "待",
"shí,sì,yì": "食",
"mài,mò": "脉",
"jiāng,jiàng": "将浆",
"dù,duó": "度",
"qīn,qìng": "亲",
"chà,chā,chāi,cī": "差",
"zhà,zhá": "炸",
"pào,páo,bāo": "炮",
"sǎ,xǐ": "洒",
"xǐ,xiǎn": "洗",
"jué,jiào": "觉",
"biǎn,piān": "扁",
"shuō,shuì,yuè": "说",
"lǎo,mǔ": "姥",
"gěi,jǐ": "给",
"luò,lào": "络",
"zǎi,zài": "载",
"mái,mán": "埋",
"shāo,shào": "捎稍",
"dū,dōu": "都",
"ái,āi": "挨",
"mò,mù": "莫",
"è,wù,ě,wū": "恶",
"xiào,jiào": "校",
"hé,hú": "核",
"yūn,yùn": "晕",
"huàng,huǎng": "晃",
"ài,āi": "唉",
"ā,á,ǎ,à,a": "啊",
"bà,ba,pí": "罢",
"zuàn,zuān": "钻",
"qiān,yán": "铅",
"chéng,shèng": "乘",
"mì,bì": "秘泌",
"chēng,chèn,chèng": "称",
"dào,dǎo": "倒",
"tǎng,cháng": "倘",
"chàng,chāng": "倡",
"chòu,xiù": "臭",
"shè,yè,yì": "射",
"gē,gé": "胳搁",
"shuāi,cuī": "衰",
"liáng,liàng": "凉量",
"chù,xù": "畜",
"páng,bàng": "旁磅",
"zhǎng,zhàng": "涨",
"yǒng,chōng": "涌",
"qiāo,qiǎo": "悄",
"jiā,jia,jie": "迦家",
"dú,dòu": "读",
"shàn,shān": "扇",
"shān,shàn": "苫",
"bèi,pī": "被",
"tiáo,diào,zhōu": "调",
"bō,bāo": "剥",
"néng,nài": "能",
"nán,nàn,nuó": "难",
"pái,pǎi": "排",
"jiào,jiāo": "教",
"jù,jū": "据",
"zhù,zhuó,zhe": "著",
"jūn,jùn": "菌",
"lè,lēi": "勒",
"shāo,sào": "梢",
"fù,pì": "副",
"piào,piāo": "票",
"shèng,chéng": "盛",
"què,qiāo,qiǎo": "雀",
"chí,shi": "匙",
"mī,mí": "眯",
"la,lā": "啦",
"shé,yí": "蛇",
"lèi,léi,lěi": "累",
"zhǎn,chán": "崭",
"quān,juàn,juān": "圈",
"lóng,lǒng": "笼",
"dé,děi,de": "得",
"jiǎ,jià": "假",
"māo,máo": "猫",
"xuán,xuàn": "旋",
"zhe,zhuó,zháo,zhāo": "着",
"lǜ,shuài": "率",
"gài,gě,hé": "盖",
"lín,lìn": "淋",
"qú,jù": "渠",
"jiàn,jiān": "渐溅",
"hùn,hún": "混",
"sù,xiǔ,xiù": "宿",
"tán,dàn": "弹",
"yǐn,yìn": "隐",
"jǐng,gěng": "颈",
"lǜ,lù": "绿",
"qū,cù": "趋",
"tí,dī,dǐ": "提",
"jiē,qì": "揭",
"lǒu,lōu": "搂",
"qī,jī": "期",
"sàn,sǎn": "散",
"gě,gé": "葛",
"zhāo,cháo": "朝",
"luò,là,lào": "落",
"yǐ,yī": "椅",
"gùn,hùn": "棍",
"zhí,shi": "殖",
"xià,shà": "厦",
"liè,liě": "裂",
"jǐng,yǐng": "景",
"pēn,pèn": "喷",
"pǎo,páo": "跑",
"hē,hè,yè": "喝",
"pù,pū": "铺",
"zhù,zhú": "筑",
"dá,dā": "答",
"bǎo,bǔ,pù": "堡",
"ào,yù": "奥",
"fān,pān": "番",
"là,xī": "腊",
"gǎng,jiǎng": "港",
"céng,zēng": "曾",
"yú,tōu": "愉",
"qiáng,qiǎng,jiàng": "强",
"shǔ,zhǔ": "属",
"zhōu,yù": "粥",
"shè,niè": "摄",
"tián,zhèn": "填",
"méng,mēng,měng": "蒙",
"jìn,jīn": "禁",
"lù,liù": "碌",
"tiào,táo": "跳",
"é,yǐ": "蛾",
"jiě,jiè,xiè": "解",
"shù,shǔ,shuò": "数",
"liū,liù": "溜",
"sāi,sài,sè": "塞",
"pì,bì": "辟",
"fèng,féng": "缝",
"piě,piē": "撇",
"mó,mú": "模",
"bǎng,bàng": "榜",
"shang,cháng": "裳",
"xiān,xiǎn": "鲜",
"yí,nǐ": "疑",
"gāo,gào": "膏",
"piāo,piào,piǎo": "漂",
"suō,sù": "缩",
"qù,cù": "趣",
"sā,sǎ": "撒",
"tàng,tāng": "趟",
"héng,hèng": "横",
"mán,mén": "瞒",
"bào,pù": "暴",
"mó,mā": "摩",
"hú,hū,hù": "糊",
"pī,pǐ": "劈",
"yàn,yān": "燕",
"báo,bó,bò": "薄",
"mó,mò": "磨",
"jiǎo,zhuó": "缴",
"cáng,zàng": "藏",
"fán,pó": "繁",
"bì,bei": "臂",
"chàn,zhàn": "颤",
"jiāng,qiáng": "疆",
"jiáo,jué,jiào": "嚼",
"rǎng,rāng": "嚷",
"lù,lòu": "露",
"náng,nāng": "囊",
"hāng,bèn": "夯",
"āo,wā": "凹",
"féng,píng": "冯",
"xū,yù": "吁",
"lèi,lē": "肋",
"lūn,lún": "抡",
"jiè,gài": "芥",
"xīn,xìn": "芯",
"chā,chà": "杈",
"xiāo,xiào": "肖",
"zhī,zī": "吱",
"ǒu,ōu,òu": "呕",
"nà,nè": "呐",
"qiàng,qiāng": "呛",
"tún,dùn": "囤",
"kēng,háng": "吭",
"diàn,tián": "佃",
"sì,cì": "伺",
"diàn,tián,shèng": "甸",
"páo,bào": "刨",
"duì,ruì,yuè": "兑",
"kē,kě": "坷",
"tuò,tà,zhí": "拓",
"fú,bì": "拂",
"nǐng,níng,nìng": "拧",
"ào,ǎo,niù": "拗",
"kē,hē": "苛",
"yān,yǎn": "奄",
"hē,a,kē": "呵",
"gā,kā": "咖",
"jiǎo,yáo": "侥",
"chà,shā": "刹",
"nüè,yào": "疟",
"máng,méng": "氓",
"gē,yì": "疙",
"jǔ,jù": "沮",
"zú,cù": "卒",
"wǎn,yuān": "宛",
"mí,mǐ": "弥",
"qì,qiè,xiè": "契",
"xié,jiā": "挟",
"duò,duǒ": "垛",
"zhà,shān,shi,cè": "栅",
"bó,bèi": "勃",
"zhóu,zhòu": "轴",
"liē,liě,lié,lie": "咧",
"yo,yō": "哟",
"qiào,xiào": "俏",
"hóu,hòu": "侯",
"píng,bǐng": "屏",
"nà,nuó": "娜",
"pá,bà": "耙",
"qī,xī": "栖",
"jiǎ,gǔ": "贾",
"láo,lào": "唠",
"bàng,bèng": "蚌",
"gōng,zhōng": "蚣",
"li,lǐ,lī": "哩",
"juè,jué": "倔",
"yīn,yān,yǐn": "殷",
"wō,guō": "涡",
"lào,luò": "烙",
"niǎn,niē": "捻",
"yè,yē": "掖",
"chān,xiān,càn,shǎn": "掺",
"dǎn,shàn": "掸",
"fēi,fěi": "菲",
"qián,gān": "乾",
"shuò,shí": "硕",
"luō,luó,luo": "啰",
"hǔ,xià": "唬",
"dāng,chēng": "铛",
"xiǎn,xǐ": "铣",
"jiǎo,jiáo": "矫",
"kuǐ,guī": "傀",
"jì,zhài": "祭",
"tǎng,chǎng": "淌",
"chún,zhūn": "淳",
"wèi,yù": "尉",
"duò,huī": "堕",
"chuò,chāo": "绰",
"bēng,běng,bèng": "绷",
"zōng,zèng": "综",
"zhuó,zuó": "琢",
"chuǎi,chuài,chuāi,tuán,zhuī": "揣",
"péng,bāng": "彭",
"zhuī,chuí": "椎",
"léng,lēng,líng": "棱",
"qiào,qiáo": "翘",
"zhā,chā": "喳",
"há,gé": "蛤",
"qiàn,kàn": "嵌",
"yān,ā": "腌",
"dūn,duì": "敦",
"kuì,huì": "溃",
"sāo,sǎo": "骚",
"kǎi,jiē": "楷",
"pín,bīn": "频",
"liú,liù": "馏",
"nì,niào": "溺",
"jiǎo,chāo": "剿",
"áo,āo": "熬",
"màn,wàn": "蔓",
"chá,chā": "碴",
"xūn,xùn": "熏",
"da,dá": "瘩",
"tuì,tùn": "褪",
"liáo,liāo": "撩",
"cuō,zuǒ": "撮",
"cháo,zhāo": "嘲",
"hēi,mò": "嘿",
"zhuàng,chuáng": "幢",
"jī,qǐ": "稽",
"biě,biē": "瘪",
"liáo,lào,lǎo": "潦",
"chéng,dèng": "澄",
"lèi,léi": "擂",
"mò,má": "蟆",
"liáo,liǎo": "燎",
"liào,liǎo": "瞭",
"sào,sāo": "臊",
"mí,méi": "糜",
"huò,huō,huá": "豁",
"pù,bào": "瀑",
"zǎn,cuán": "攒",
"bò,bǒ": "簸",
"bó,bù": "簿",
};

/*
object-assign
(c) Sindre Sorhus
@license MIT
*/
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

// @see [百家姓](https://zh.wikipedia.org/wiki/%E7%99%BE%E5%AE%B6%E5%A7%93)
var surname = {
  "赵": [["zhào"]],
  "钱": [["qián"]],
  "孙": [["sūn"]],
  "李": [["lǐ"]],
  "周": [["zhōu"]],
  "吴": [["wú"]],
  "郑": [["zhèng"]],
  "王": [["wáng"]],
  "冯": [["féng"]],
  "陈": [["chén"]],
  "褚": [["chǔ"]],
  "卫": [["wèi"]],
  "蒋": [["jiǎng"]],
  "沈": [["shěn"]],
  "韩": [["hán"]],
  "杨": [["yáng"]],
  "朱": [["zhū"]],
  "秦": [["qín"]],
  "尤": [["yóu"]],
  "许": [["xǔ"]],
  "何": [["hé"]],
  "吕": [["lǚ"]],
  "施": [["shī"]],
  "张": [["zhāng"]],
  "孔": [["kǒng"]],
  "曹": [["cáo"]],
  "严": [["yán"]],
  "华": [["huà"]],
  "金": [["jīn"]],
  "魏": [["wèi"]],
  "陶": [["táo"]],
  "姜": [["jiāng"]],
  "戚": [["qī"]],
  "谢": [["xiè"]],
  "邹": [["zōu"]],
  "喻": [["yù"]],
  "柏": [["bǎi"]],
  "水": [["shuǐ"]],
  "窦": [["dòu"]],
  "章": [["zhāng"]],
  "云": [["yún"]],
  "苏": [["sū"]],
  "潘": [["pān"]],
  "葛": [["gě"]],
  "奚": [["xī"]],
  "范": [["fàn"]],
  "彭": [["péng"]],
  "郎": [["láng"]],
  "鲁": [["lǔ"]],
  "韦": [["wéi"]],
  "昌": [["chāng"]],
  "马": [["mǎ"]],
  "苗": [["miáo"]],
  "凤": [["fèng"]],
  "花": [["huā"]],
  "方": [["fāng"]],
  "俞": [["yú"]],
  "任": [["rèn"]],
  "袁": [["yuán"]],
  "柳": [["liǔ"]],
  "酆": [["fēng"]],
  "鲍": [["bào"]],
  "史": [["shǐ"]],
  "唐": [["táng"]],
  "费": [["fèi"]],
  "廉": [["lián"]],
  "岑": [["cén"]],
  "薛": [["xuē"]],
  "雷": [["léi"]],
  "贺": [["hè"]],
  "倪": [["ní"]],
  "汤": [["tāng"]],
  "滕": [["téng"]],
  "殷": [["yīn"]],
  "罗": [["luó"]],
  "毕": [["bì"]],
  "郝": [["hǎo"]],
  "邬": [["wū"]],
  "安": [["ān"]],
  "常": [["cháng"]],
  "乐": [["yuè"]],
  "于": [["yú"]],
  "时": [["shí"]],
  "傅": [["fù"]],
  "皮": [["pí"]],
  "卞": [["biàn"]],
  "齐": [["qí"]],
  "康": [["kāng"]],
  "伍": [["wǔ"]],
  "余": [["yú"]],
  "元": [["yuán"]],
  "卜": [["bǔ"]],
  "顾": [["gù"]],
  "孟": [["mèng"]],
  "平": [["píng"]],
  "黄": [["huáng"]],
  "和": [["hé"]],
  "穆": [["mù"]],
  "萧": [["xiāo"]],
  "尹": [["yǐn"]],
  "姚": [["yáo"]],
  "邵": [["shào"]],
  "湛": [["zhàn"]],
  "汪": [["wāng"]],
  "祁": [["qí"]],
  "毛": [["máo"]],
  "禹": [["yǔ"]],
  "狄": [["dí"]],
  "米": [["mǐ"]],
  "贝": [["bèi"]],
  "明": [["míng"]],
  "臧": [["zāng"]],
  "计": [["jì"]],
  "伏": [["fú"]],
  "成": [["chéng"]],
  "戴": [["dài"]],
  "谈": [["tán"]],
  "宋": [["sòng"]],
  "茅": [["máo"]],
  "庞": [["páng"]],
  "熊": [["xióng"]],
  "纪": [["jì"]],
  "舒": [["shū"]],
  "屈": [["qū"]],
  "项": [["xiàng"]],
  "祝": [["zhù"]],
  "董": [["dǒng"]],
  "梁": [["liáng"]],
  "杜": [["dù"]],
  "阮": [["ruǎn"]],
  "蓝": [["lán"]],
  "闵": [["mǐn"]],
  "席": [["xí"]],
  "季": [["jì"]],
  "麻": [["má"]],
  "强": [["qiáng"]],
  "贾": [["jiǎ"]],
  "路": [["lù"]],
  "娄": [["lóu"]],
  "危": [["wēi"]],
  "江": [["jiāng"]],
  "童": [["tóng"]],
  "颜": [["yán"]],
  "郭": [["guō"]],
  "梅": [["méi"]],
  "盛": [["shèng"]],
  "林": [["lín"]],
  "刁": [["diāo"]],
  "钟": [["zhōng"]],
  "徐": [["xú"]],
  "邱": [["qiū"]],
  "骆": [["luò"]],
  "高": [["gāo"]],
  "夏": [["xià"]],
  "蔡": [["cài"]],
  "田": [["tián"]],
  "樊": [["fán"]],
  "胡": [["hú"]],
  "凌": [["líng"]],
  "霍": [["huò"]],
  "虞": [["yú"]],
  "万": [["wàn"]],
  "支": [["zhī"]],
  "柯": [["kē"]],
  "昝": [["zǎn"]],
  "管": [["guǎn"]],
  "卢": [["lú"]],
  "莫": [["mò"]],
  "经": [["jīng"]],
  "房": [["fáng"]],
  "裘": [["qiú"]],
  "缪": [["miào"]],
  "干": [["gān"]],
  "解": [["xiè"]],
  "应": [["yīng"]],
  "宗": [["zōng"]],
  "丁": [["dīng"]],
  "宣": [["xuān"]],
  "贲": [["bēn"]],
  "邓": [["dèng"]],
  "郁": [["yù"]],
  "单": [["shàn"]],
  "杭": [["háng"]],
  "洪": [["hóng"]],
  "包": [["bāo"]],
  "诸": [["zhū"]],
  "左": [["zuǒ"]],
  "石": [["shí"]],
  "崔": [["cuī"]],
  "吉": [["jí"]],
  "钮": [["niǔ"]],
  "龚": [["gōng"]],
  "程": [["chéng"]],
  "嵇": [["jī"]],
  "邢": [["xíng"]],
  "滑": [["huá"]],
  "裴": [["péi"]],
  "陆": [["lù"]],
  "荣": [["róng"]],
  "翁": [["wēng"]],
  "荀": [["xún"]],
  "羊": [["yáng"]],
  "於": [["yū"]],
  "惠": [["huì"]],
  "甄": [["zhēn"]],
  "曲": [["qū"]],
  "家": [["jiā"]],
  "封": [["fēng"]],
  "芮": [["ruì"]],
  "羿": [["yì"]],
  "储": [["chǔ"]],
  "靳": [["jìn"]],
  "汲": [["jí"]],
  "邴": [["bǐng"]],
  "糜": [["mí"]],
  "松": [["sōng"]],
  "井": [["jǐng"]],
  "段": [["duàn"]],
  "富": [["fù"]],
  "巫": [["wū"]],
  "乌": [["wū"]],
  "焦": [["jiāo"]],
  "巴": [["bā"]],
  "弓": [["gōng"]],
  "牧": [["mù"]],
  "隗": [["kuí"]],
  "山": [["shān"]],
  "谷": [["gǔ"]],
  "车": [["chē"]],
  "侯": [["hóu"]],
  "宓": [["mì"]],
  "蓬": [["péng"]],
  "全": [["quán"]],
  "郗": [["xī"]],
  "班": [["bān"]],
  "仰": [["yǎng"]],
  "秋": [["qiū"]],
  "仲": [["zhòng"]],
  "伊": [["yī"]],
  "宫": [["gōng"]],
  "宁": [["nìng"]],
  "仇": [["qiú"]],
  "栾": [["luán"]],
  "暴": [["bào"]],
  "甘": [["gān"]],
  "钭": [["tǒu"]],
  "厉": [["lì"]],
  "戎": [["róng"]],
  "祖": [["zǔ"]],
  "武": [["wǔ"]],
  "符": [["fú"]],
  "刘": [["liú"]],
  "景": [["jǐng"]],
  "詹": [["zhān"]],
  "束": [["shù"]],
  "龙": [["lóng"]],
  "叶": [["yè"]],
  "幸": [["xìng"]],
  "司": [["sī"]],
  "韶": [["sháo"]],
  "郜": [["gào"]],
  "黎": [["lí"]],
  "蓟": [["jì"]],
  "薄": [["bó"]],
  "印": [["yìn"]],
  "宿": [["sù"]],
  "白": [["bái"]],
  "怀": [["huái"]],
  "蒲": [["pú"]],
  "邰": [["tái"]],
  "从": [["cóng"]],
  "鄂": [["è"]],
  "索": [["suǒ"]],
  "咸": [["xián"]],
  "籍": [["jí"]],
  "赖": [["lài"]],
  "卓": [["zhuó"]],
  "蔺": [["lìn"]],
  "屠": [["tú"]],
  "蒙": [["méng"]],
  "池": [["chí"]],
  "乔": [["qiáo"]],
  "阴": [["yīn"]],
  "鬱": [["yù"]],
  "胥": [["xū"]],
  "能": [["nài"]],
  "苍": [["cāng"]],
  "双": [["shuāng"]],
  "闻": [["wén"]],
  "莘": [["shēn"]],
  "党": [["dǎng"]],
  "翟": [["zhái"]],
  "谭": [["tán"]],
  "贡": [["gòng"]],
  "劳": [["láo"]],
  "逄": [["páng"]],
  "姬": [["jī"]],
  "申": [["shēn"]],
  "扶": [["fú"]],
  "堵": [["dǔ"]],
  "冉": [["rǎn"]],
  "宰": [["zǎi"]],
  "郦": [["lì"]],
  "雍": [["yōng"]],
  "郤": [["xì"]],
  "璩": [["qú"]],
  "桑": [["sāng"]],
  "桂": [["guì"]],
  "濮": [["pú"]],
  "牛": [["niú"]],
  "寿": [["shòu"]],
  "通": [["tōng"]],
  "边": [["biān"]],
  "扈": [["hù"]],
  "燕": [["yān"]],
  "冀": [["jì"]],
  "郏": [["jiá"]],
  "浦": [["pǔ"]],
  "尚": [["shàng"]],
  "农": [["nóng"]],
  "温": [["wēn"]],
  "别": [["bié"]],
  "庄": [["zhuāng"]],
  "晏": [["yàn"]],
  "柴": [["chái"]],
  "瞿": [["qú"]],
  "阎": [["yán"]],
  "充": [["chōng"]],
  "慕": [["mù"]],
  "连": [["lián"]],
  "茹": [["rú"]],
  "习": [["xí"]],
  "宦": [["huàn"]],
  "艾": [["ài"]],
  "鱼": [["yú"]],
  "容": [["róng"]],
  "向": [["xiàng"]],
  "古": [["gǔ"]],
  "易": [["yì"]],
  "慎": [["shèn"]],
  "戈": [["gē"]],
  "廖": [["liào"]],
  "庾": [["yǔ"]],
  "终": [["zhōng"]],
  "暨": [["jì"]],
  "居": [["jū"]],
  "衡": [["héng"]],
  "步": [["bù"]],
  "都": [["dū"]],
  "耿": [["gěng"]],
  "满": [["mǎn"]],
  "弘": [["hóng"]],
  "匡": [["kuāng"]],
  "国": [["guó"]],
  "文": [["wén"]],
  "寇": [["kòu"]],
  "广": [["guǎng"]],
  "禄": [["lù"]],
  "阙": [["quē"]],
  "东": [["dōng"]],
  "欧": [["ōu"]],
  "殳": [["shū"]],
  "沃": [["wò"]],
  "利": [["lì"]],
  "蔚": [["wèi"]],
  "越": [["yuè"]],
  "夔": [["kuí"]],
  "隆": [["lóng"]],
  "师": [["shī"]],
  "巩": [["gǒng"]],
  "厍": [["shè"]],
  "聂": [["niè"]],
  "晁": [["cháo"]],
  "勾": [["gōu"]],
  "敖": [["áo"]],
  "融": [["róng"]],
  "冷": [["lěng"]],
  "訾": [["zǐ"]],
  "辛": [["xīn"]],
  "阚": [["kàn"]],
  "那": [["nā"]],
  "简": [["jiǎn"]],
  "饶": [["ráo"]],
  "空": [["kōng"]],
  "曾": [["zēng"]],
  "母": [["mǔ"]],
  "沙": [["shā"]],
  "乜": [["niè"]],
  "养": [["yǎng"]],
  "鞠": [["jū"]],
  "须": [["xū"]],
  "丰": [["fēng"]],
  "巢": [["cháo"]],
  "关": [["guān"]],
  "蒯": [["kuǎi"]],
  "相": [["xiàng"]],
  "查": [["zhā"]],
  "后": [["hòu"]],
  "荆": [["jīng"]],
  "红": [["hóng"]],
  "游": [["yóu"]],
  "竺": [["zhú"]],
  "权": [["quán"]],
  "逯": [["lù"]],
  "盖": [["gài"]],
  "益": [["yì"]],
  "桓": [["huán"]],
  "公": [["gōng"]],
  "牟": [["móu"]],
  "哈": [["hǎ"]],
  "言": [["yán"]],
  "福": [["fú"]],
};

// 复姓
var compound_surname = {
  "万俟": [["mò"], ["qí"]],
  "上官": [["shàng"], ["guān"]],
  "东方": [["dōng"], ["fāng"]],
  "东郭": [["dōng"], ["guō"]],
  "东门": [["dōng"], ["mén"]],
  "乐正": [["yuè"], ["zhèng"]],
  "亓官": [["qí"], ["guān"]],
  "仉督": [["zhǎng"], ["dū"]],
  "令狐": [["líng"], ["hú"]],
  "仲孙": [["zhòng"], ["sūn"]],
  "公冶": [["gōng"], ["yě"]],
  "公孙": [["gōng"], ["sūn"]],
  "公羊": [["gōng"], ["yáng"]],
  "公良": [["gōng"], ["liáng"]],
  "公西": [["gōng"], ["xī"]],
  "单于": [["chán"], ["yú"]],
  "南宫": [["nán"], ["gōng"]],
  "南门": [["nán"], ["mén"]],
  "司寇": [["sī"], ["kòu"]],
  "司徒": [["sī"], ["tú"]],
  "司空": [["sī"], ["kōng"]],
  "司马": [["sī"], ["mǎ"]],
  "呼延": [["hū"], ["yán"]],
  "壤驷": [["rǎng"], ["sì"]],
  "夏侯": [["xià"], ["hóu"]],
  "太叔": [["tài"], ["shū"]],
  "夹谷": [["jiá"], ["gǔ"]],
  "子车": [["zǐ"], ["jū"]],
  "宇文": [["yǔ"], ["wén"]],
  "宗政": [["zōng"], ["zhèng"]],
  "宰父": [["zǎi"], ["fǔ"]],
  "尉迟": [["yù"], ["chí"]],
  "左丘": [["zuǒ"], ["qiū"]],
  "巫马": [["wū"], ["mǎ"]],
  "慕容": [["mù"], ["róng"]],
  "拓跋": [["tuò"], ["bá"]],
  "梁丘": [["liáng"], ["qiū"]],
  "榖梁": [["gǔ"], ["liáng"]],
  "欧阳": [["ōu"], ["yáng"]],
  "段干": [["duàn"], ["gān"]],
  "淳于": [["chún"], ["yú"]],
  "漆雕": [["qī"], ["diāo"]],
  "澹台": [["tán"], ["tái"]],
  "濮阳": [["pú"], ["yáng"]],
  "申屠": [["shēn"], ["tú"]],
  "百里": [["bǎi"], ["lǐ"]],
  "皇甫": [["huáng"], ["pǔ"]],
  "端木": [["duān"], ["mù"]],
  "第五": [["dì"], ["wǔ"]],
  "羊舌": [["yáng"], ["shé"]],
  "西门": [["xī"], ["mén"]],
  "诸葛": [["zhū"], ["gě"]],
  "赫连": [["hè"], ["lián"]],
  "轩辕": [["xuān"], ["yuán"]],
  "钟离": [["zhōng"], ["lí"]],
  "长孙": [["zhǎng"], ["sūn"]],
  "闻人": [["wén"], ["rén"]],
  "闾丘": [["lǘ"], ["qiū"]],
  "颛孙": [["zhuān"], ["sūn"]],
  "鲜于": [["xiān"], ["yú"]],
};

// 带声调字符。
var phoneticSymbol = {
  "ā": "a1",
  "á": "a2",
  "ǎ": "a3",
  "à": "a4",
  "ē": "e1",
  "é": "e2",
  "ě": "e3",
  "è": "e4",
  "ō": "o1",
  "ó": "o2",
  "ǒ": "o3",
  "ò": "o4",
  "ī": "i1",
  "í": "i2",
  "ǐ": "i3",
  "ì": "i4",
  "ū": "u1",
  "ú": "u2",
  "ǔ": "u3",
  "ù": "u4",
  "ü": "v0",
  "ǘ": "v2",
  "ǚ": "v3",
  "ǜ": "v4",
  "ń": "n2",
  "ň": "n3",
  "": "m2",
};

var util$1 = {};

/**
 * 组合 2 个拼音数组。
 * @param {Array<String>} a1 第一个数组，形如 ["zhāo", "cháo"]
 * @param {Array<String>} a2 字符串型数组。形如 ["yáng"]
 * @return {Array<String>} 组合后的一维数组，如上可得 ["zhāoyáng", "cháoyáng"]
 */
function combo2array(a1, a2) {
  const result = [];
  if (!a1.length) {
    return a2;
  }
  if (!a2.length) {
    return a1;
  }
  for (let i = 0, l = a1.length; i < l; i++) {
    for (let j = 0, m = a2.length; j < m; j++) {
      result.push(a1[i] + a2[j]);
    }
  }
  return result;
}

/**
 * 合并二维元祖。
 * @param {Array<Array<String>>} arr 二维元祖 [["zhāo", "cháo"], ["yáng"], ["dōng"], ["shēng"]]
 * @return {Array<String>} 返回二维字符串组合数组。形如
 *  [
 *    ["zhāoyáng"], ["dōng"], ["shēng"],
 *    ["cháoyáng"], ["dōng"], ["shēng"]
 *  ]
 */
function combo(arr) {
  if (arr.length === 0) {
    return [];
  }
  if (arr.length === 1) {
    return arr[0];
  }
  let result = combo2array(arr[0], arr[1]);
  for (let i = 2, l = arr.length; i < l; i++) {
    result = combo2array(result, arr[i]);
  }
  return result;
}

/**
 * 组合两个拼音数组，形成一个新的二维数组
 * @param {string[]|string[][]} arr1 eg: ["hai", "huan"]
 * @param {Array<String>} arr2 eg: ["qian"]
 * @returns {string[][]} 组合后的二维数组，eg: [ ["hai", "qian"], ["huan", "qian"] ]
 */
function compact2array(a1, a2) {
  if (!Array.isArray(a1) || !Array.isArray(a2)) {
    throw new Error("compact2array expect two array as parameters");
  }
  if (!a1.length) {
    a1 = [""];
  }
  if (!a2.length) {
    a2 = [""];
  }
  const result = [];
  for (let i = 0, l = a1.length; i < l; i++) {
    for (let j = 0, m = a2.length; j < m; j++) {
      if (Array.isArray(a1[i])) {
        result.push([...a1[i], a2[j]]);
      } else {
        result.push([a1[i], a2[j]]);
      }
    }
  }
  return result;
}

function compact(arr) {
  if (arr.length === 0) {
    return [];
  }
  if (arr.length === 1) {
    return [arr[0]];
  }
  let result = compact2array(arr[0], arr[1]);
  for (let i = 2, l = arr.length; i < l; ++i) {
    result = compact2array(result, arr[i]);
  }
  return result;
}

util$1.combo2array = combo2array;
util$1.combo = combo;
util$1.compact2array = compact2array;
util$1.compact = compact;

const assign = objectAssign;
const SurnamePinyinData = surname;
const CompoundSurnamePinyinData = compound_surname;

// XXX: Symbol when web support.
const PINYIN_STYLE = {
  NORMAL: 0,       // 普通风格，不带声调。
  TONE: 1,         // 标准风格，声调在韵母的第一个字母上。
  TONE2: 2,        // 声调以数字形式在拼音之后，使用数字 0~4 标识。
  TO3NE: 5,        // 声调以数字形式在声母之后，使用数字 0~4 标识。
  INITIALS: 3,     // 仅需要声母部分。
  FIRST_LETTER: 4, // 仅保留首字母。
};
// 拼音模式。
const PINYIN_MODE = {
  NORMAL: 0, // 普通模式
  SURNAME: 1, // 姓氏
  PLACENAME: 2, // 地名
};
const DEFAULT_OPTIONS = {
  mode: PINYIN_MODE.NORMAL, // 拼音模式。
  style: PINYIN_STYLE.TONE, // 风格。
  segment: false,           // 分词。
  heteronym: false,         // 多音字。
};

// 声母表。
const INITIALS = "b,p,m,f,d,t,n,l,g,k,h,j,q,x,r,zh,ch,sh,z,c,s".split(",");
// 韵母表。
//const FINALS = "ang,eng,ing,ong,an,en,in,un,er,ai,ei,ui,ao,ou,iu,ie,ve,a,o,e,i,u,v".split(",");
// 带声调字符。
const PHONETIC_SYMBOL = phoneticSymbol;
const RE_PHONETIC_SYMBOL = new RegExp("([" + Object.keys(PHONETIC_SYMBOL).join("") + "])", "g");
const RE_TONE2 = /([aeoiuvnm])([0-4])$/;
const util = util$1;

/*
 * 格式化拼音为声母（Initials）形式。
 * @param {String}
 * @return {String}
 */
function initials(pinyin) {
  for (let i = 0, l = INITIALS.length; i < l; i++){
    if (pinyin.indexOf(INITIALS[i]) === 0) {
      return INITIALS[i];
    }
  }
  return "";
}

class Pinyin$1 {
  constructor (dict) {
    this._dict = dict;
  }

  // @param {String} hans 要转为拼音的目标字符串（汉字）。
  // @param {Object} options, 可选，用于指定拼音风格，是否启用多音字。
  // @return {Array} 返回的拼音列表。
  convert (hans, options) {

    if (typeof hans !== "string") {
      return [];
    }

    options = assign({}, DEFAULT_OPTIONS, options);

    let pys = [];
    let nohans = "";

    if (options.mode === PINYIN_MODE.SURNAME) {
      pys.push(this.surname_pinyin(hans, options));
    } else {

      for(let i = 0, firstCharCode, words, l = hans.length; i < l; i++) {

        words = hans[i];
        firstCharCode = words.charCodeAt(0);

        if(this._dict[firstCharCode]) {

          // ends of non-chinese words.
          if(nohans.length > 0) {
            pys.push([nohans]);
            nohans = ""; // reset non-chinese words.
          }

          pys.push(this.single_pinyin(words, options));

        } else {
          nohans += words;
        }
      }

    }

    // 清理最后的非中文字符串。
    if(nohans.length > 0){
      pys.push([nohans]);
    }

    Object.defineProperty(pys, "compact", {
      value: util.compact.bind(this, pys),
      enumerable: false,
      configurable: false,
    });

    return pys;
  }

  // 单字拼音转换。
  // @param {String} han, 单个汉字
  // @return {Array} 返回拼音列表，多音字会有多个拼音项。
  single_pinyin(han, options) {

    if (typeof han !== "string") {
      return [];
    }
    if (han.length !== 1) {
      return this.single_pinyin(han.charAt(0), options);
    }

    let hanCode = han.charCodeAt(0);

    if (!this._dict[hanCode]) {
      return [han];
    }

    let pys = this._dict[hanCode].split(",");
    if(!options.heteronym){
      return [Pinyin$1.toFixed(pys[0], options.style)];
    }

    // 临时存储已存在的拼音，避免多音字拼音转换为非注音风格出现重复。
    let py_cached = {};
    let pinyins = [];
    for(let i = 0, py, l = pys.length; i < l; i++){
      py = Pinyin$1.toFixed(pys[i], options.style);
      if(py_cached.hasOwnProperty(py)){
        continue;
      }
      py_cached[py] = py;

      pinyins.push(py);
    }
    return pinyins;
  }

  // 姓名转成拼音
  surname_pinyin(hans, options) {
    return this.compound_surname(hans, options);
  }

  // 复姓处理
  compound_surname(hans, options) {
    let len = hans.length;
    let prefixIndex = 0;
    let result = [];
    function toFixed(item) {
      return item.map(ch => Pinyin$1.toFixed(ch, options.style));
    }
    for (let i = 0; i < len; i++) {
      const twowords = hans.substring(i, i + 2);
      if (CompoundSurnamePinyinData.hasOwnProperty(twowords)) {
        if (prefixIndex <= i - 1) {
          result = result.concat(
            this.single_surname(
              hans.substring(prefixIndex, i),
              options
            )
          );
        }
        result = result.concat(CompoundSurnamePinyinData[twowords].map(toFixed));

        i = i + 2;
        prefixIndex = i;
      }
    }
    // 处理复姓后面剩余的部分。
    result = result.concat(
      this.single_surname(
        hans.substring(prefixIndex, len),
        options
      )
    );
    return result;
  }

  // 单姓处理
  single_surname(hans, options) {
    let result = [];
    function toFixed(item) {
      return item.map(ch => Pinyin$1.toFixed(ch, options.style));
    }
    for (let i = 0, l = hans.length; i < l; i++) {
      const word = hans.charAt(i);
      if (SurnamePinyinData.hasOwnProperty(word)) {
        result = result.concat(SurnamePinyinData[word].map(toFixed));
      } else {
        result.push(this.single_pinyin(word, options));
      }
    }
    return result;
  }

  /**
   * 格式化拼音风格。
   *
   * @param {String} pinyin TONE 风格的拼音。
   * @param {ENUM} style 目标转换的拼音风格。
   * @return {String} 转换后的拼音。
   */
  static toFixed (pinyin, style) {
    let tone = ""; // 声调。
    let first_letter;
    let py;
    switch(style){
    case PINYIN_STYLE.INITIALS:
      return initials(pinyin);

    case PINYIN_STYLE.FIRST_LETTER:
      first_letter = pinyin.charAt(0);
      if (PHONETIC_SYMBOL.hasOwnProperty(first_letter)) {
        first_letter = PHONETIC_SYMBOL[first_letter].charAt(0);
      }
      return first_letter;

    case PINYIN_STYLE.NORMAL:
      return pinyin.replace(RE_PHONETIC_SYMBOL, function($0, $1_phonetic){
        return PHONETIC_SYMBOL[$1_phonetic].replace(RE_TONE2, "$1");
      });

    case PINYIN_STYLE.TO3NE:
      return pinyin.replace(RE_PHONETIC_SYMBOL, function($0, $1_phonetic){
        return PHONETIC_SYMBOL[$1_phonetic];
      });

    case PINYIN_STYLE.TONE2:
      py = pinyin.replace(RE_PHONETIC_SYMBOL, function($0, $1){
        // 声调数值。
        tone = PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$2");

        return PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$1");
      });
      return py + tone;

    case PINYIN_STYLE.TONE:
    default:
      return pinyin;
    }
  }

  /**
   * 比较两个汉字转成拼音后的排序顺序，可以用作默认的拼音排序算法。
   *
   * @param {String} hanA 汉字字符串 A。
   * @return {String} hanB 汉字字符串 B。
   * @return {Number} 返回 -1，0，或 1。
   */
  compare (hanA, hanB) {
    const pinyinA = this.convert(hanA, DEFAULT_OPTIONS);
    const pinyinB = this.convert(hanB, DEFAULT_OPTIONS);
    return String(pinyinA).localeCompare(String(pinyinB));
  }

  compact(arr) {
    return util.compact(arr);
  }

  static get STYLE_NORMAL () {
    return PINYIN_STYLE.NORMAL;
  }
  static get STYLE_TONE () {
    return PINYIN_STYLE.TONE;
  }
  static get STYLE_TONE2 () {
    return PINYIN_STYLE.TONE2;
  }
  static get STYLE_TO3NE () {
    return PINYIN_STYLE.TO3NE;
  }
  static get STYLE_INITIALS () {
    return PINYIN_STYLE.INITIALS;
  }
  static get STYLE_FIRST_LETTER () {
    return PINYIN_STYLE.FIRST_LETTER;
  }
  static get MODE_NORMAL () {
    return PINYIN_MODE.NORMAL;
  }
  static get MODE_SURNAME () {
    return PINYIN_MODE.SURNAME;
  }
  static get MODE_PLACENAME () {
    return PINYIN_MODE.PLACENAME;
  }
  static get DEFAULT_OPTIONS () {
    return DEFAULT_OPTIONS;
  }
}

var pinyin$1 = Pinyin$1;

// 解压拼音库。
// @param {Object} dict_combo, 压缩的拼音库。
// @param {Object} 解压的拼音库。
function buildPinyinCache(dict_combo){
  let hans;
  let uncomboed = {};

  for(let py in dict_combo){
    hans = dict_combo[py];
    for(let i = 0, han, l = hans.length; i < l; i++){
      han = hans.charCodeAt(i);
      if(!uncomboed.hasOwnProperty(han)){
        uncomboed[han] = py;
      }else {
        uncomboed[han] += "," + py;
      }
    }
  }

  return uncomboed;
}

const PINYIN_DICT = buildPinyinCache(dictZiWeb);
const Pinyin = pinyin$1;
const pinyin = new Pinyin(PINYIN_DICT);

webPinyin.exports = pinyin.convert.bind(pinyin);
webPinyin.exports.compare = pinyin.compare.bind(pinyin);
webPinyin.exports.compact = pinyin.compact.bind(pinyin);
webPinyin.exports.STYLE_NORMAL = Pinyin.STYLE_NORMAL;
webPinyin.exports.STYLE_TONE = Pinyin.STYLE_TONE;
webPinyin.exports.STYLE_TONE2 = Pinyin.STYLE_TONE2;
webPinyin.exports.STYLE_TO3NE = Pinyin.STYLE_TO3NE;
webPinyin.exports.STYLE_INITIALS = Pinyin.STYLE_INITIALS;
webPinyin.exports.STYLE_FIRST_LETTER = Pinyin.STYLE_FIRST_LETTER;

function text(user) {
  return user.user.DisplayName || user.user.NickName || "N/A";
}

function isMatch(kw, user) {
  return user.keywords.some(item => item.toLowerCase().includes(kw.toLowerCase()));
}

function getKeywords(user) {
  const kw = [];

  if (user.DisplayName) {
    kw.push(webPinyin.exports(user.DisplayName, {
      style: webPinyin.exports.STYLE_NORMAL
    }).map(i => i[0]).join(''));
  }

  if (user.NickName) {
    kw.push(webPinyin.exports(user.NickName, {
      style: webPinyin.exports.STYLE_NORMAL
    }).map(i => i[0]).join(''));
  }

  return kw;
}

function Mention(props) {
  return createComponent(SearchList, {
    get ["class"]() {
      return props.class;
    },

    get data() {
      return props.users.map(user => ({
        user,
        keywords: getKeywords(user)
      }));
    },

    get onCancel() {
      return props.onCancel;
    },

    text: text,
    isMatch: isMatch,
    onSelect: i => props.onSelect(i.user)
  });
}

function getOrCreateMountPoint(selector, tag = "div") {
  let el = document.querySelector(selector);
  if (el === null) {
    el = document.createElement(tag);
    document.body.append(
      el
    );
  }
  return el;
}

const mention = (() => {
  window.addEventListener('load', () => {
    const scope = angular.element(document.body).scope();

    scope.mentionMenu = event => {
      const editArea = angular.element('#editArea');
      const chatScope = angular.element('#chatArea').scope();

      if (event.originalEvent.key === '@') {
        // Mention component will preempt focus, therefore the @ will be send to Mention's input
        // Let mount it after this event
        const target = event.originalEvent.target;
        setTimeout(() => {
          const users = chatScope.currentContact.MemberList;
          const index = document.getSelection()?.getRangeAt(0)?.startOffset ?? editArea.text().length - 1;
          console.log("index:", index);

          if (users.length > 0) {
            const umount = render(() => createComponent(Mention, {
              "class": css`
                    position: absolute;
                    background-color: white;
                    width: min(500px, 80vw);
                    top: 50px;
                    left: 50%;
                    transform: translateX(-50%);
            `,
              users: users,
              onSelect: user => {
                umount();
                const msg = editArea.text();
                const a = msg.substring(0, index);
                const b = msg.substring(index);
                const uc = chatScope.getUserContact(user.UserName);
                editArea.html(''); // 腾讯的前端有处理@，实际并没啥卵用

                editArea.scope().insertToEditArea(`${a}<input un=${user.UserName} value=${uc.NickName} >${b}`);
              },
              onCancel: () => {
                umount();
                target.focus();
                const content = editArea.html();
                editArea.html('');
                editArea.scope().insertToEditArea(content);
              }
            }), getOrCreateMountPoint('#mention-container'));
          }
        });
      }
    };
  });
});

function getScope(el) {
  return angular.element(el).scope();
}

const templetes = {};
function initTemplateHook(cache) {
  const get = cache.get;
  cache.put;
  cache.get = (name) => {
    const tpl = get(name);
    if (templetes[name] && tpl) {
      return templetes[name](tpl);
    }
    return tpl;
  };
}
function registerTemplate(name, templateTransform) {
  templetes[name] = templateTransform;
}
function installHook(name, param) {
  const { onRender } = param;
  window[name] = onRender;
  registerTemplate(name, (tpl) => {
    const el = document.createElement("template");
    el.innerHTML = param.transform ? param.transform(tpl) : tpl;
    const root = el.content.querySelector("*");
    root.setAttribute("data-name", name);
    const boot = document.createElement("script");
    boot.innerHTML = `
      const callback="${name}"
      setTimeout(
        ()=>window[callback](document.querySelector('[data-name="${name}"]'))
      )
    `;
    root.append(
      boot
    );
    return el.innerHTML;
  });
}

const patched = Symbol("patched");
const originalKey = Symbol("original");
function patch(obj, key, fn) {
  let original = obj[key];
  if (original[patched]) {
    return;
  }
  Object.defineProperty(
    obj,
    key,
    {
      get: () => {
        const f = function(...args) {
          return fn({
            args,
            context: this,
            original
          });
        };
        f[patched] = true;
        f[originalKey] = original;
        return f;
      },
      set: (v) => {
        console.log("!!!!!", v);
        original = v;
      }
    }
  );
}

const hookUploadImg = () => installHook("imageUploadPreview.html", {
  onRender: (el) => {
    const scope = getScope(el);
    patch(scope, "cancel", ({ original }) => {
      remove();
      original();
    });
    const remove = () => {
      window.removeEventListener("keydown", fn);
    };
    const fn = (e) => {
      if (e.key === "Enter") {
        scope.send();
        remove();
      } else if (e.key === "Escaple") {
        return remove();
      }
    };
    window.addEventListener("keydown", fn);
  }
});

const hooks$1 = {};
function initHookServices(services) {
  patch(services, "factory", (param) => {
    const [name, deps] = param.args;
    if (hooks$1[name]) {
      console.log(param.args);
      const fn = deps.pop();
      return param.original.apply(param.context, [
        name,
        [
          ...deps,
          (...injected) => {
            return hooks$1[name].f(
              fn(...injected),
              injected
            );
          }
        ]
      ]);
    }
    return param.original.apply(param.context, param.args);
  });
}
function registerServicesHook(name, hook) {
  hooks$1[name] = hook;
}

function hookAssign(property, onAssign) {
  try {
    console.log("watch", property);
    let value = window[property];
    Object.defineProperty(
      window,
      property,
      {
        get() {
          return value;
        },
        set(val) {
          value = onAssign(val);
        }
      }
    );
  } catch {
  }
}

let uploader;
hookAssign("WebUploader", (value) => {
  patch(
    value,
    "create",
    ({ original, context, args }) => {
      const instance = original(...args);
      uploader = instance;
      console.log(instance);
      return instance;
    }
  );
  return value;
});
function getUploader() {
  return uploader;
}

const hookScreenshot = () => {
  registerServicesHook("screenShotFactory", {
    f: (screenShotFactory) => {
      console.log(screenShotFactory);
      const sf = Object.create(screenShotFactory);
      Object.assign(
        sf,
        {
          isClipBoardImage() {
            return true;
          },
          isSupport() {
            return true;
          },
          capture({ ok }) {
            exec("flameshot gui", (err) => {
              if (err == null) {
                ok();
              }
            });
          },
          upload() {
            console.log("uploader", getUploader());
            navigator.clipboard.read().then((items) => {
              const t = items[0].types[0];
              const data = items[0].getType(t);
              return data;
            }).then((data) => {
              const file = new WebUploader.Lib.File(
                WebUploader.guid(),
                data
              );
              file.onSuccess = () => {
              };
              getUploader()?.addFile(file);
            });
          }
        }
      );
      return sf;
    }
  });
};

/*
 * Dexie.js - a minimalistic wrapper for IndexedDB
 * ===============================================
 *
 * By David Fahlander, david.fahlander@gmail.com
 *
 * Version 3.2.2, Wed Apr 27 2022
 *
 * https://dexie.org
 *
 * Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
 */
 
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
}

var _global = typeof globalThis !== 'undefined' ? globalThis :
    typeof self !== 'undefined' ? self :
        typeof window !== 'undefined' ? window :
            global;

var keys = Object.keys;
var isArray = Array.isArray;
if (typeof Promise !== 'undefined' && !_global.Promise) {
    _global.Promise = Promise;
}
function extend(obj, extension) {
    if (typeof extension !== 'object')
        return obj;
    keys(extension).forEach(function (key) {
        obj[key] = extension[key];
    });
    return obj;
}
var getProto = Object.getPrototypeOf;
var _hasOwn = {}.hasOwnProperty;
function hasOwn(obj, prop) {
    return _hasOwn.call(obj, prop);
}
function props(proto, extension) {
    if (typeof extension === 'function')
        extension = extension(getProto(proto));
    (typeof Reflect === "undefined" ? keys : Reflect.ownKeys)(extension).forEach(function (key) {
        setProp(proto, key, extension[key]);
    });
}
var defineProperty = Object.defineProperty;
function setProp(obj, prop, functionOrGetSet, options) {
    defineProperty(obj, prop, extend(functionOrGetSet && hasOwn(functionOrGetSet, "get") && typeof functionOrGetSet.get === 'function' ?
        { get: functionOrGetSet.get, set: functionOrGetSet.set, configurable: true } :
        { value: functionOrGetSet, configurable: true, writable: true }, options));
}
function derive(Child) {
    return {
        from: function (Parent) {
            Child.prototype = Object.create(Parent.prototype);
            setProp(Child.prototype, "constructor", Child);
            return {
                extend: props.bind(null, Child.prototype)
            };
        }
    };
}
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
function getPropertyDescriptor(obj, prop) {
    var pd = getOwnPropertyDescriptor(obj, prop);
    var proto;
    return pd || (proto = getProto(obj)) && getPropertyDescriptor(proto, prop);
}
var _slice = [].slice;
function slice(args, start, end) {
    return _slice.call(args, start, end);
}
function override(origFunc, overridedFactory) {
    return overridedFactory(origFunc);
}
function assert(b) {
    if (!b)
        throw new Error("Assertion Failed");
}
function asap$1(fn) {
    if (_global.setImmediate)
        setImmediate(fn);
    else
        setTimeout(fn, 0);
}
function arrayToObject(array, extractor) {
    return array.reduce(function (result, item, i) {
        var nameAndValue = extractor(item, i);
        if (nameAndValue)
            result[nameAndValue[0]] = nameAndValue[1];
        return result;
    }, {});
}
function tryCatch(fn, onerror, args) {
    try {
        fn.apply(null, args);
    }
    catch (ex) {
        onerror && onerror(ex);
    }
}
function getByKeyPath(obj, keyPath) {
    if (hasOwn(obj, keyPath))
        return obj[keyPath];
    if (!keyPath)
        return obj;
    if (typeof keyPath !== 'string') {
        var rv = [];
        for (var i = 0, l = keyPath.length; i < l; ++i) {
            var val = getByKeyPath(obj, keyPath[i]);
            rv.push(val);
        }
        return rv;
    }
    var period = keyPath.indexOf('.');
    if (period !== -1) {
        var innerObj = obj[keyPath.substr(0, period)];
        return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
    }
    return undefined;
}
function setByKeyPath(obj, keyPath, value) {
    if (!obj || keyPath === undefined)
        return;
    if ('isFrozen' in Object && Object.isFrozen(obj))
        return;
    if (typeof keyPath !== 'string' && 'length' in keyPath) {
        assert(typeof value !== 'string' && 'length' in value);
        for (var i = 0, l = keyPath.length; i < l; ++i) {
            setByKeyPath(obj, keyPath[i], value[i]);
        }
    }
    else {
        var period = keyPath.indexOf('.');
        if (period !== -1) {
            var currentKeyPath = keyPath.substr(0, period);
            var remainingKeyPath = keyPath.substr(period + 1);
            if (remainingKeyPath === "")
                if (value === undefined) {
                    if (isArray(obj) && !isNaN(parseInt(currentKeyPath)))
                        obj.splice(currentKeyPath, 1);
                    else
                        delete obj[currentKeyPath];
                }
                else
                    obj[currentKeyPath] = value;
            else {
                var innerObj = obj[currentKeyPath];
                if (!innerObj || !hasOwn(obj, currentKeyPath))
                    innerObj = (obj[currentKeyPath] = {});
                setByKeyPath(innerObj, remainingKeyPath, value);
            }
        }
        else {
            if (value === undefined) {
                if (isArray(obj) && !isNaN(parseInt(keyPath)))
                    obj.splice(keyPath, 1);
                else
                    delete obj[keyPath];
            }
            else
                obj[keyPath] = value;
        }
    }
}
function delByKeyPath(obj, keyPath) {
    if (typeof keyPath === 'string')
        setByKeyPath(obj, keyPath, undefined);
    else if ('length' in keyPath)
        [].map.call(keyPath, function (kp) {
            setByKeyPath(obj, kp, undefined);
        });
}
function shallowClone(obj) {
    var rv = {};
    for (var m in obj) {
        if (hasOwn(obj, m))
            rv[m] = obj[m];
    }
    return rv;
}
var concat = [].concat;
function flatten(a) {
    return concat.apply([], a);
}
var intrinsicTypeNames = "Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey"
    .split(',').concat(flatten([8, 16, 32, 64].map(function (num) { return ["Int", "Uint", "Float"].map(function (t) { return t + num + "Array"; }); }))).filter(function (t) { return _global[t]; });
var intrinsicTypes = intrinsicTypeNames.map(function (t) { return _global[t]; });
arrayToObject(intrinsicTypeNames, function (x) { return [x, true]; });
var circularRefs = null;
function deepClone(any) {
    circularRefs = typeof WeakMap !== 'undefined' && new WeakMap();
    var rv = innerDeepClone(any);
    circularRefs = null;
    return rv;
}
function innerDeepClone(any) {
    if (!any || typeof any !== 'object')
        return any;
    var rv = circularRefs && circularRefs.get(any);
    if (rv)
        return rv;
    if (isArray(any)) {
        rv = [];
        circularRefs && circularRefs.set(any, rv);
        for (var i = 0, l = any.length; i < l; ++i) {
            rv.push(innerDeepClone(any[i]));
        }
    }
    else if (intrinsicTypes.indexOf(any.constructor) >= 0) {
        rv = any;
    }
    else {
        var proto = getProto(any);
        rv = proto === Object.prototype ? {} : Object.create(proto);
        circularRefs && circularRefs.set(any, rv);
        for (var prop in any) {
            if (hasOwn(any, prop)) {
                rv[prop] = innerDeepClone(any[prop]);
            }
        }
    }
    return rv;
}
var toString = {}.toString;
function toStringTag(o) {
    return toString.call(o).slice(8, -1);
}
var iteratorSymbol = typeof Symbol !== 'undefined' ?
    Symbol.iterator :
    '@@iterator';
var getIteratorOf = typeof iteratorSymbol === "symbol" ? function (x) {
    var i;
    return x != null && (i = x[iteratorSymbol]) && i.apply(x);
} : function () { return null; };
var NO_CHAR_ARRAY = {};
function getArrayOf(arrayLike) {
    var i, a, x, it;
    if (arguments.length === 1) {
        if (isArray(arrayLike))
            return arrayLike.slice();
        if (this === NO_CHAR_ARRAY && typeof arrayLike === 'string')
            return [arrayLike];
        if ((it = getIteratorOf(arrayLike))) {
            a = [];
            while ((x = it.next()), !x.done)
                a.push(x.value);
            return a;
        }
        if (arrayLike == null)
            return [arrayLike];
        i = arrayLike.length;
        if (typeof i === 'number') {
            a = new Array(i);
            while (i--)
                a[i] = arrayLike[i];
            return a;
        }
        return [arrayLike];
    }
    i = arguments.length;
    a = new Array(i);
    while (i--)
        a[i] = arguments[i];
    return a;
}
var isAsyncFunction = typeof Symbol !== 'undefined'
    ? function (fn) { return fn[Symbol.toStringTag] === 'AsyncFunction'; }
    : function () { return false; };

var debug = typeof location !== 'undefined' &&
    /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
function setDebug(value, filter) {
    debug = value;
    libraryFilter = filter;
}
var libraryFilter = function () { return true; };
var NEEDS_THROW_FOR_STACK = !new Error("").stack;
function getErrorWithStack() {
    if (NEEDS_THROW_FOR_STACK)
        try {
            getErrorWithStack.arguments;
            throw new Error();
        }
        catch (e) {
            return e;
        }
    return new Error();
}
function prettyStack(exception, numIgnoredFrames) {
    var stack = exception.stack;
    if (!stack)
        return "";
    numIgnoredFrames = (numIgnoredFrames || 0);
    if (stack.indexOf(exception.name) === 0)
        numIgnoredFrames += (exception.name + exception.message).split('\n').length;
    return stack.split('\n')
        .slice(numIgnoredFrames)
        .filter(libraryFilter)
        .map(function (frame) { return "\n" + frame; })
        .join('');
}

var dexieErrorNames = [
    'Modify',
    'Bulk',
    'OpenFailed',
    'VersionChange',
    'Schema',
    'Upgrade',
    'InvalidTable',
    'MissingAPI',
    'NoSuchDatabase',
    'InvalidArgument',
    'SubTransaction',
    'Unsupported',
    'Internal',
    'DatabaseClosed',
    'PrematureCommit',
    'ForeignAwait'
];
var idbDomErrorNames = [
    'Unknown',
    'Constraint',
    'Data',
    'TransactionInactive',
    'ReadOnly',
    'Version',
    'NotFound',
    'InvalidState',
    'InvalidAccess',
    'Abort',
    'Timeout',
    'QuotaExceeded',
    'Syntax',
    'DataClone'
];
var errorList = dexieErrorNames.concat(idbDomErrorNames);
var defaultTexts = {
    VersionChanged: "Database version changed by other database connection",
    DatabaseClosed: "Database has been closed",
    Abort: "Transaction aborted",
    TransactionInactive: "Transaction has already completed or failed",
    MissingAPI: "IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb"
};
function DexieError(name, msg) {
    this._e = getErrorWithStack();
    this.name = name;
    this.message = msg;
}
derive(DexieError).from(Error).extend({
    stack: {
        get: function () {
            return this._stack ||
                (this._stack = this.name + ": " + this.message + prettyStack(this._e, 2));
        }
    },
    toString: function () { return this.name + ": " + this.message; }
});
function getMultiErrorMessage(msg, failures) {
    return msg + ". Errors: " + Object.keys(failures)
        .map(function (key) { return failures[key].toString(); })
        .filter(function (v, i, s) { return s.indexOf(v) === i; })
        .join('\n');
}
function ModifyError(msg, failures, successCount, failedKeys) {
    this._e = getErrorWithStack();
    this.failures = failures;
    this.failedKeys = failedKeys;
    this.successCount = successCount;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(ModifyError).from(DexieError);
function BulkError(msg, failures) {
    this._e = getErrorWithStack();
    this.name = "BulkError";
    this.failures = Object.keys(failures).map(function (pos) { return failures[pos]; });
    this.failuresByPos = failures;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(BulkError).from(DexieError);
var errnames = errorList.reduce(function (obj, name) { return (obj[name] = name + "Error", obj); }, {});
var BaseException = DexieError;
var exceptions = errorList.reduce(function (obj, name) {
    var fullName = name + "Error";
    function DexieError(msgOrInner, inner) {
        this._e = getErrorWithStack();
        this.name = fullName;
        if (!msgOrInner) {
            this.message = defaultTexts[name] || fullName;
            this.inner = null;
        }
        else if (typeof msgOrInner === 'string') {
            this.message = "" + msgOrInner + (!inner ? '' : '\n ' + inner);
            this.inner = inner || null;
        }
        else if (typeof msgOrInner === 'object') {
            this.message = msgOrInner.name + " " + msgOrInner.message;
            this.inner = msgOrInner;
        }
    }
    derive(DexieError).from(BaseException);
    obj[name] = DexieError;
    return obj;
}, {});
exceptions.Syntax = SyntaxError;
exceptions.Type = TypeError;
exceptions.Range = RangeError;
var exceptionMap = idbDomErrorNames.reduce(function (obj, name) {
    obj[name + "Error"] = exceptions[name];
    return obj;
}, {});
function mapError(domError, message) {
    if (!domError || domError instanceof DexieError || domError instanceof TypeError || domError instanceof SyntaxError || !domError.name || !exceptionMap[domError.name])
        return domError;
    var rv = new exceptionMap[domError.name](message || domError.message, domError);
    if ("stack" in domError) {
        setProp(rv, "stack", { get: function () {
                return this.inner.stack;
            } });
    }
    return rv;
}
var fullNameExceptions = errorList.reduce(function (obj, name) {
    if (["Syntax", "Type", "Range"].indexOf(name) === -1)
        obj[name + "Error"] = exceptions[name];
    return obj;
}, {});
fullNameExceptions.ModifyError = ModifyError;
fullNameExceptions.DexieError = DexieError;
fullNameExceptions.BulkError = BulkError;

function nop() { }
function mirror(val) { return val; }
function pureFunctionChain(f1, f2) {
    if (f1 == null || f1 === mirror)
        return f2;
    return function (val) {
        return f2(f1(val));
    };
}
function callBoth(on1, on2) {
    return function () {
        on1.apply(this, arguments);
        on2.apply(this, arguments);
    };
}
function hookCreatingChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        var res = f1.apply(this, arguments);
        if (res !== undefined)
            arguments[0] = res;
        var onsuccess = this.onsuccess,
        onerror = this.onerror;
        this.onsuccess = null;
        this.onerror = null;
        var res2 = f2.apply(this, arguments);
        if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
        if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
        return res2 !== undefined ? res2 : res;
    };
}
function hookDeletingChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        f1.apply(this, arguments);
        var onsuccess = this.onsuccess,
        onerror = this.onerror;
        this.onsuccess = this.onerror = null;
        f2.apply(this, arguments);
        if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
        if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
    };
}
function hookUpdatingChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function (modifications) {
        var res = f1.apply(this, arguments);
        extend(modifications, res);
        var onsuccess = this.onsuccess,
        onerror = this.onerror;
        this.onsuccess = null;
        this.onerror = null;
        var res2 = f2.apply(this, arguments);
        if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
        if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
        return res === undefined ?
            (res2 === undefined ? undefined : res2) :
            (extend(res, res2));
    };
}
function reverseStoppableEventChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        if (f2.apply(this, arguments) === false)
            return false;
        return f1.apply(this, arguments);
    };
}
function promisableChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        var res = f1.apply(this, arguments);
        if (res && typeof res.then === 'function') {
            var thiz = this, i = arguments.length, args = new Array(i);
            while (i--)
                args[i] = arguments[i];
            return res.then(function () {
                return f2.apply(thiz, args);
            });
        }
        return f2.apply(this, arguments);
    };
}

var INTERNAL = {};
var LONG_STACKS_CLIP_LIMIT = 100,
MAX_LONG_STACKS = 20, ZONE_ECHO_LIMIT = 100, _a$1 = typeof Promise === 'undefined' ?
    [] :
    (function () {
        var globalP = Promise.resolve();
        if (typeof crypto === 'undefined' || !crypto.subtle)
            return [globalP, getProto(globalP), globalP];
        var nativeP = crypto.subtle.digest("SHA-512", new Uint8Array([0]));
        return [
            nativeP,
            getProto(nativeP),
            globalP
        ];
    })(), resolvedNativePromise = _a$1[0], nativePromiseProto = _a$1[1], resolvedGlobalPromise = _a$1[2], nativePromiseThen = nativePromiseProto && nativePromiseProto.then;
var NativePromise = resolvedNativePromise && resolvedNativePromise.constructor;
var patchGlobalPromise = !!resolvedGlobalPromise;
var stack_being_generated = false;
var schedulePhysicalTick = resolvedGlobalPromise ?
    function () { resolvedGlobalPromise.then(physicalTick); }
    :
        _global.setImmediate ?
            setImmediate.bind(null, physicalTick) :
            _global.MutationObserver ?
                function () {
                    var hiddenDiv = document.createElement("div");
                    (new MutationObserver(function () {
                        physicalTick();
                        hiddenDiv = null;
                    })).observe(hiddenDiv, { attributes: true });
                    hiddenDiv.setAttribute('i', '1');
                } :
                function () { setTimeout(physicalTick, 0); };
var asap = function (callback, args) {
    microtickQueue.push([callback, args]);
    if (needsNewPhysicalTick) {
        schedulePhysicalTick();
        needsNewPhysicalTick = false;
    }
};
var isOutsideMicroTick = true,
needsNewPhysicalTick = true,
unhandledErrors = [],
rejectingErrors = [],
currentFulfiller = null, rejectionMapper = mirror;
var globalPSD = {
    id: 'global',
    global: true,
    ref: 0,
    unhandleds: [],
    onunhandled: globalError,
    pgp: false,
    env: {},
    finalize: function () {
        this.unhandleds.forEach(function (uh) {
            try {
                globalError(uh[0], uh[1]);
            }
            catch (e) { }
        });
    }
};
var PSD = globalPSD;
var microtickQueue = [];
var numScheduledCalls = 0;
var tickFinalizers = [];
function DexiePromise(fn) {
    if (typeof this !== 'object')
        throw new TypeError('Promises must be constructed via new');
    this._listeners = [];
    this.onuncatched = nop;
    this._lib = false;
    var psd = (this._PSD = PSD);
    if (debug) {
        this._stackHolder = getErrorWithStack();
        this._prev = null;
        this._numPrev = 0;
    }
    if (typeof fn !== 'function') {
        if (fn !== INTERNAL)
            throw new TypeError('Not a function');
        this._state = arguments[1];
        this._value = arguments[2];
        if (this._state === false)
            handleRejection(this, this._value);
        return;
    }
    this._state = null;
    this._value = null;
    ++psd.ref;
    executePromiseTask(this, fn);
}
var thenProp = {
    get: function () {
        var psd = PSD, microTaskId = totalEchoes;
        function then(onFulfilled, onRejected) {
            var _this = this;
            var possibleAwait = !psd.global && (psd !== PSD || microTaskId !== totalEchoes);
            var cleanup = possibleAwait && !decrementExpectedAwaits();
            var rv = new DexiePromise(function (resolve, reject) {
                propagateToListener(_this, new Listener(nativeAwaitCompatibleWrap(onFulfilled, psd, possibleAwait, cleanup), nativeAwaitCompatibleWrap(onRejected, psd, possibleAwait, cleanup), resolve, reject, psd));
            });
            debug && linkToPreviousPromise(rv, this);
            return rv;
        }
        then.prototype = INTERNAL;
        return then;
    },
    set: function (value) {
        setProp(this, 'then', value && value.prototype === INTERNAL ?
            thenProp :
            {
                get: function () {
                    return value;
                },
                set: thenProp.set
            });
    }
};
props(DexiePromise.prototype, {
    then: thenProp,
    _then: function (onFulfilled, onRejected) {
        propagateToListener(this, new Listener(null, null, onFulfilled, onRejected, PSD));
    },
    catch: function (onRejected) {
        if (arguments.length === 1)
            return this.then(null, onRejected);
        var type = arguments[0], handler = arguments[1];
        return typeof type === 'function' ? this.then(null, function (err) {
            return err instanceof type ? handler(err) : PromiseReject(err);
        })
            : this.then(null, function (err) {
                return err && err.name === type ? handler(err) : PromiseReject(err);
            });
    },
    finally: function (onFinally) {
        return this.then(function (value) {
            onFinally();
            return value;
        }, function (err) {
            onFinally();
            return PromiseReject(err);
        });
    },
    stack: {
        get: function () {
            if (this._stack)
                return this._stack;
            try {
                stack_being_generated = true;
                var stacks = getStack(this, [], MAX_LONG_STACKS);
                var stack = stacks.join("\nFrom previous: ");
                if (this._state !== null)
                    this._stack = stack;
                return stack;
            }
            finally {
                stack_being_generated = false;
            }
        }
    },
    timeout: function (ms, msg) {
        var _this = this;
        return ms < Infinity ?
            new DexiePromise(function (resolve, reject) {
                var handle = setTimeout(function () { return reject(new exceptions.Timeout(msg)); }, ms);
                _this.then(resolve, reject).finally(clearTimeout.bind(null, handle));
            }) : this;
    }
});
if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
    setProp(DexiePromise.prototype, Symbol.toStringTag, 'Dexie.Promise');
globalPSD.env = snapShot();
function Listener(onFulfilled, onRejected, resolve, reject, zone) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.resolve = resolve;
    this.reject = reject;
    this.psd = zone;
}
props(DexiePromise, {
    all: function () {
        var values = getArrayOf.apply(null, arguments)
            .map(onPossibleParallellAsync);
        return new DexiePromise(function (resolve, reject) {
            if (values.length === 0)
                resolve([]);
            var remaining = values.length;
            values.forEach(function (a, i) { return DexiePromise.resolve(a).then(function (x) {
                values[i] = x;
                if (!--remaining)
                    resolve(values);
            }, reject); });
        });
    },
    resolve: function (value) {
        if (value instanceof DexiePromise)
            return value;
        if (value && typeof value.then === 'function')
            return new DexiePromise(function (resolve, reject) {
                value.then(resolve, reject);
            });
        var rv = new DexiePromise(INTERNAL, true, value);
        linkToPreviousPromise(rv, currentFulfiller);
        return rv;
    },
    reject: PromiseReject,
    race: function () {
        var values = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
        return new DexiePromise(function (resolve, reject) {
            values.map(function (value) { return DexiePromise.resolve(value).then(resolve, reject); });
        });
    },
    PSD: {
        get: function () { return PSD; },
        set: function (value) { return PSD = value; }
    },
    totalEchoes: { get: function () { return totalEchoes; } },
    newPSD: newScope,
    usePSD: usePSD,
    scheduler: {
        get: function () { return asap; },
        set: function (value) { asap = value; }
    },
    rejectionMapper: {
        get: function () { return rejectionMapper; },
        set: function (value) { rejectionMapper = value; }
    },
    follow: function (fn, zoneProps) {
        return new DexiePromise(function (resolve, reject) {
            return newScope(function (resolve, reject) {
                var psd = PSD;
                psd.unhandleds = [];
                psd.onunhandled = reject;
                psd.finalize = callBoth(function () {
                    var _this = this;
                    run_at_end_of_this_or_next_physical_tick(function () {
                        _this.unhandleds.length === 0 ? resolve() : reject(_this.unhandleds[0]);
                    });
                }, psd.finalize);
                fn();
            }, zoneProps, resolve, reject);
        });
    }
});
if (NativePromise) {
    if (NativePromise.allSettled)
        setProp(DexiePromise, "allSettled", function () {
            var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(function (resolve) {
                if (possiblePromises.length === 0)
                    resolve([]);
                var remaining = possiblePromises.length;
                var results = new Array(remaining);
                possiblePromises.forEach(function (p, i) { return DexiePromise.resolve(p).then(function (value) { return results[i] = { status: "fulfilled", value: value }; }, function (reason) { return results[i] = { status: "rejected", reason: reason }; })
                    .then(function () { return --remaining || resolve(results); }); });
            });
        });
    if (NativePromise.any && typeof AggregateError !== 'undefined')
        setProp(DexiePromise, "any", function () {
            var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(function (resolve, reject) {
                if (possiblePromises.length === 0)
                    reject(new AggregateError([]));
                var remaining = possiblePromises.length;
                var failures = new Array(remaining);
                possiblePromises.forEach(function (p, i) { return DexiePromise.resolve(p).then(function (value) { return resolve(value); }, function (failure) {
                    failures[i] = failure;
                    if (!--remaining)
                        reject(new AggregateError(failures));
                }); });
            });
        });
}
function executePromiseTask(promise, fn) {
    try {
        fn(function (value) {
            if (promise._state !== null)
                return;
            if (value === promise)
                throw new TypeError('A promise cannot be resolved with itself.');
            var shouldExecuteTick = promise._lib && beginMicroTickScope();
            if (value && typeof value.then === 'function') {
                executePromiseTask(promise, function (resolve, reject) {
                    value instanceof DexiePromise ?
                        value._then(resolve, reject) :
                        value.then(resolve, reject);
                });
            }
            else {
                promise._state = true;
                promise._value = value;
                propagateAllListeners(promise);
            }
            if (shouldExecuteTick)
                endMicroTickScope();
        }, handleRejection.bind(null, promise));
    }
    catch (ex) {
        handleRejection(promise, ex);
    }
}
function handleRejection(promise, reason) {
    rejectingErrors.push(reason);
    if (promise._state !== null)
        return;
    var shouldExecuteTick = promise._lib && beginMicroTickScope();
    reason = rejectionMapper(reason);
    promise._state = false;
    promise._value = reason;
    debug && reason !== null && typeof reason === 'object' && !reason._promise && tryCatch(function () {
        var origProp = getPropertyDescriptor(reason, "stack");
        reason._promise = promise;
        setProp(reason, "stack", {
            get: function () {
                return stack_being_generated ?
                    origProp && (origProp.get ?
                        origProp.get.apply(reason) :
                        origProp.value) :
                    promise.stack;
            }
        });
    });
    addPossiblyUnhandledError(promise);
    propagateAllListeners(promise);
    if (shouldExecuteTick)
        endMicroTickScope();
}
function propagateAllListeners(promise) {
    var listeners = promise._listeners;
    promise._listeners = [];
    for (var i = 0, len = listeners.length; i < len; ++i) {
        propagateToListener(promise, listeners[i]);
    }
    var psd = promise._PSD;
    --psd.ref || psd.finalize();
    if (numScheduledCalls === 0) {
        ++numScheduledCalls;
        asap(function () {
            if (--numScheduledCalls === 0)
                finalizePhysicalTick();
        }, []);
    }
}
function propagateToListener(promise, listener) {
    if (promise._state === null) {
        promise._listeners.push(listener);
        return;
    }
    var cb = promise._state ? listener.onFulfilled : listener.onRejected;
    if (cb === null) {
        return (promise._state ? listener.resolve : listener.reject)(promise._value);
    }
    ++listener.psd.ref;
    ++numScheduledCalls;
    asap(callListener, [cb, promise, listener]);
}
function callListener(cb, promise, listener) {
    try {
        currentFulfiller = promise;
        var ret, value = promise._value;
        if (promise._state) {
            ret = cb(value);
        }
        else {
            if (rejectingErrors.length)
                rejectingErrors = [];
            ret = cb(value);
            if (rejectingErrors.indexOf(value) === -1)
                markErrorAsHandled(promise);
        }
        listener.resolve(ret);
    }
    catch (e) {
        listener.reject(e);
    }
    finally {
        currentFulfiller = null;
        if (--numScheduledCalls === 0)
            finalizePhysicalTick();
        --listener.psd.ref || listener.psd.finalize();
    }
}
function getStack(promise, stacks, limit) {
    if (stacks.length === limit)
        return stacks;
    var stack = "";
    if (promise._state === false) {
        var failure = promise._value, errorName, message;
        if (failure != null) {
            errorName = failure.name || "Error";
            message = failure.message || failure;
            stack = prettyStack(failure, 0);
        }
        else {
            errorName = failure;
            message = "";
        }
        stacks.push(errorName + (message ? ": " + message : "") + stack);
    }
    if (debug) {
        stack = prettyStack(promise._stackHolder, 2);
        if (stack && stacks.indexOf(stack) === -1)
            stacks.push(stack);
        if (promise._prev)
            getStack(promise._prev, stacks, limit);
    }
    return stacks;
}
function linkToPreviousPromise(promise, prev) {
    var numPrev = prev ? prev._numPrev + 1 : 0;
    if (numPrev < LONG_STACKS_CLIP_LIMIT) {
        promise._prev = prev;
        promise._numPrev = numPrev;
    }
}
function physicalTick() {
    beginMicroTickScope() && endMicroTickScope();
}
function beginMicroTickScope() {
    var wasRootExec = isOutsideMicroTick;
    isOutsideMicroTick = false;
    needsNewPhysicalTick = false;
    return wasRootExec;
}
function endMicroTickScope() {
    var callbacks, i, l;
    do {
        while (microtickQueue.length > 0) {
            callbacks = microtickQueue;
            microtickQueue = [];
            l = callbacks.length;
            for (i = 0; i < l; ++i) {
                var item = callbacks[i];
                item[0].apply(null, item[1]);
            }
        }
    } while (microtickQueue.length > 0);
    isOutsideMicroTick = true;
    needsNewPhysicalTick = true;
}
function finalizePhysicalTick() {
    var unhandledErrs = unhandledErrors;
    unhandledErrors = [];
    unhandledErrs.forEach(function (p) {
        p._PSD.onunhandled.call(null, p._value, p);
    });
    var finalizers = tickFinalizers.slice(0);
    var i = finalizers.length;
    while (i)
        finalizers[--i]();
}
function run_at_end_of_this_or_next_physical_tick(fn) {
    function finalizer() {
        fn();
        tickFinalizers.splice(tickFinalizers.indexOf(finalizer), 1);
    }
    tickFinalizers.push(finalizer);
    ++numScheduledCalls;
    asap(function () {
        if (--numScheduledCalls === 0)
            finalizePhysicalTick();
    }, []);
}
function addPossiblyUnhandledError(promise) {
    if (!unhandledErrors.some(function (p) { return p._value === promise._value; }))
        unhandledErrors.push(promise);
}
function markErrorAsHandled(promise) {
    var i = unhandledErrors.length;
    while (i)
        if (unhandledErrors[--i]._value === promise._value) {
            unhandledErrors.splice(i, 1);
            return;
        }
}
function PromiseReject(reason) {
    return new DexiePromise(INTERNAL, false, reason);
}
function wrap(fn, errorCatcher) {
    var psd = PSD;
    return function () {
        var wasRootExec = beginMicroTickScope(), outerScope = PSD;
        try {
            switchToZone(psd, true);
            return fn.apply(this, arguments);
        }
        catch (e) {
            errorCatcher && errorCatcher(e);
        }
        finally {
            switchToZone(outerScope, false);
            if (wasRootExec)
                endMicroTickScope();
        }
    };
}
var task = { awaits: 0, echoes: 0, id: 0 };
var taskCounter = 0;
var zoneStack = [];
var zoneEchoes = 0;
var totalEchoes = 0;
var zone_id_counter = 0;
function newScope(fn, props, a1, a2) {
    var parent = PSD, psd = Object.create(parent);
    psd.parent = parent;
    psd.ref = 0;
    psd.global = false;
    psd.id = ++zone_id_counter;
    var globalEnv = globalPSD.env;
    psd.env = patchGlobalPromise ? {
        Promise: DexiePromise,
        PromiseProp: { value: DexiePromise, configurable: true, writable: true },
        all: DexiePromise.all,
        race: DexiePromise.race,
        allSettled: DexiePromise.allSettled,
        any: DexiePromise.any,
        resolve: DexiePromise.resolve,
        reject: DexiePromise.reject,
        nthen: getPatchedPromiseThen(globalEnv.nthen, psd),
        gthen: getPatchedPromiseThen(globalEnv.gthen, psd)
    } : {};
    if (props)
        extend(psd, props);
    ++parent.ref;
    psd.finalize = function () {
        --this.parent.ref || this.parent.finalize();
    };
    var rv = usePSD(psd, fn, a1, a2);
    if (psd.ref === 0)
        psd.finalize();
    return rv;
}
function incrementExpectedAwaits() {
    if (!task.id)
        task.id = ++taskCounter;
    ++task.awaits;
    task.echoes += ZONE_ECHO_LIMIT;
    return task.id;
}
function decrementExpectedAwaits() {
    if (!task.awaits)
        return false;
    if (--task.awaits === 0)
        task.id = 0;
    task.echoes = task.awaits * ZONE_ECHO_LIMIT;
    return true;
}
if (('' + nativePromiseThen).indexOf('[native code]') === -1) {
    incrementExpectedAwaits = decrementExpectedAwaits = nop;
}
function onPossibleParallellAsync(possiblePromise) {
    if (task.echoes && possiblePromise && possiblePromise.constructor === NativePromise) {
        incrementExpectedAwaits();
        return possiblePromise.then(function (x) {
            decrementExpectedAwaits();
            return x;
        }, function (e) {
            decrementExpectedAwaits();
            return rejection(e);
        });
    }
    return possiblePromise;
}
function zoneEnterEcho(targetZone) {
    ++totalEchoes;
    if (!task.echoes || --task.echoes === 0) {
        task.echoes = task.id = 0;
    }
    zoneStack.push(PSD);
    switchToZone(targetZone, true);
}
function zoneLeaveEcho() {
    var zone = zoneStack[zoneStack.length - 1];
    zoneStack.pop();
    switchToZone(zone, false);
}
function switchToZone(targetZone, bEnteringZone) {
    var currentZone = PSD;
    if (bEnteringZone ? task.echoes && (!zoneEchoes++ || targetZone !== PSD) : zoneEchoes && (!--zoneEchoes || targetZone !== PSD)) {
        enqueueNativeMicroTask(bEnteringZone ? zoneEnterEcho.bind(null, targetZone) : zoneLeaveEcho);
    }
    if (targetZone === PSD)
        return;
    PSD = targetZone;
    if (currentZone === globalPSD)
        globalPSD.env = snapShot();
    if (patchGlobalPromise) {
        var GlobalPromise_1 = globalPSD.env.Promise;
        var targetEnv = targetZone.env;
        nativePromiseProto.then = targetEnv.nthen;
        GlobalPromise_1.prototype.then = targetEnv.gthen;
        if (currentZone.global || targetZone.global) {
            Object.defineProperty(_global, 'Promise', targetEnv.PromiseProp);
            GlobalPromise_1.all = targetEnv.all;
            GlobalPromise_1.race = targetEnv.race;
            GlobalPromise_1.resolve = targetEnv.resolve;
            GlobalPromise_1.reject = targetEnv.reject;
            if (targetEnv.allSettled)
                GlobalPromise_1.allSettled = targetEnv.allSettled;
            if (targetEnv.any)
                GlobalPromise_1.any = targetEnv.any;
        }
    }
}
function snapShot() {
    var GlobalPromise = _global.Promise;
    return patchGlobalPromise ? {
        Promise: GlobalPromise,
        PromiseProp: Object.getOwnPropertyDescriptor(_global, "Promise"),
        all: GlobalPromise.all,
        race: GlobalPromise.race,
        allSettled: GlobalPromise.allSettled,
        any: GlobalPromise.any,
        resolve: GlobalPromise.resolve,
        reject: GlobalPromise.reject,
        nthen: nativePromiseProto.then,
        gthen: GlobalPromise.prototype.then
    } : {};
}
function usePSD(psd, fn, a1, a2, a3) {
    var outerScope = PSD;
    try {
        switchToZone(psd, true);
        return fn(a1, a2, a3);
    }
    finally {
        switchToZone(outerScope, false);
    }
}
function enqueueNativeMicroTask(job) {
    nativePromiseThen.call(resolvedNativePromise, job);
}
function nativeAwaitCompatibleWrap(fn, zone, possibleAwait, cleanup) {
    return typeof fn !== 'function' ? fn : function () {
        var outerZone = PSD;
        if (possibleAwait)
            incrementExpectedAwaits();
        switchToZone(zone, true);
        try {
            return fn.apply(this, arguments);
        }
        finally {
            switchToZone(outerZone, false);
            if (cleanup)
                enqueueNativeMicroTask(decrementExpectedAwaits);
        }
    };
}
function getPatchedPromiseThen(origThen, zone) {
    return function (onResolved, onRejected) {
        return origThen.call(this, nativeAwaitCompatibleWrap(onResolved, zone), nativeAwaitCompatibleWrap(onRejected, zone));
    };
}
var UNHANDLEDREJECTION = "unhandledrejection";
function globalError(err, promise) {
    var rv;
    try {
        rv = promise.onuncatched(err);
    }
    catch (e) { }
    if (rv !== false)
        try {
            var event, eventData = { promise: promise, reason: err };
            if (_global.document && document.createEvent) {
                event = document.createEvent('Event');
                event.initEvent(UNHANDLEDREJECTION, true, true);
                extend(event, eventData);
            }
            else if (_global.CustomEvent) {
                event = new CustomEvent(UNHANDLEDREJECTION, { detail: eventData });
                extend(event, eventData);
            }
            if (event && _global.dispatchEvent) {
                dispatchEvent(event);
                if (!_global.PromiseRejectionEvent && _global.onunhandledrejection)
                    try {
                        _global.onunhandledrejection(event);
                    }
                    catch (_) { }
            }
            if (debug && event && !event.defaultPrevented) {
                console.warn("Unhandled rejection: " + (err.stack || err));
            }
        }
        catch (e) { }
}
var rejection = DexiePromise.reject;

function tempTransaction(db, mode, storeNames, fn) {
    if (!db.idbdb || (!db._state.openComplete && (!PSD.letThrough && !db._vip))) {
        if (db._state.openComplete) {
            return rejection(new exceptions.DatabaseClosed(db._state.dbOpenError));
        }
        if (!db._state.isBeingOpened) {
            if (!db._options.autoOpen)
                return rejection(new exceptions.DatabaseClosed());
            db.open().catch(nop);
        }
        return db._state.dbReadyPromise.then(function () { return tempTransaction(db, mode, storeNames, fn); });
    }
    else {
        var trans = db._createTransaction(mode, storeNames, db._dbSchema);
        try {
            trans.create();
            db._state.PR1398_maxLoop = 3;
        }
        catch (ex) {
            if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
                console.warn('Dexie: Need to reopen db');
                db._close();
                return db.open().then(function () { return tempTransaction(db, mode, storeNames, fn); });
            }
            return rejection(ex);
        }
        return trans._promise(mode, function (resolve, reject) {
            return newScope(function () {
                PSD.trans = trans;
                return fn(resolve, reject, trans);
            });
        }).then(function (result) {
            return trans._completion.then(function () { return result; });
        });
    }
}

var DEXIE_VERSION = '3.2.2';
var maxString = String.fromCharCode(65535);
var minKey = -Infinity;
var INVALID_KEY_ARGUMENT = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
var STRING_EXPECTED = "String expected.";
var connections = [];
var isIEOrEdge = typeof navigator !== 'undefined' && /(MSIE|Trident|Edge)/.test(navigator.userAgent);
var hasIEDeleteObjectStoreBug = isIEOrEdge;
var hangsOnDeleteLargeKeyRange = isIEOrEdge;
var dexieStackFrameFilter = function (frame) { return !/(dexie\.js|dexie\.min\.js)/.test(frame); };
var DBNAMES_DB = '__dbnames';
var READONLY = 'readonly';
var READWRITE = 'readwrite';

function combine(filter1, filter2) {
    return filter1 ?
        filter2 ?
            function () { return filter1.apply(this, arguments) && filter2.apply(this, arguments); } :
            filter1 :
        filter2;
}

var AnyRange = {
    type: 3 ,
    lower: -Infinity,
    lowerOpen: false,
    upper: [[]],
    upperOpen: false
};

function workaroundForUndefinedPrimKey(keyPath) {
    return typeof keyPath === "string" && !/\./.test(keyPath)
        ? function (obj) {
            if (obj[keyPath] === undefined && (keyPath in obj)) {
                obj = deepClone(obj);
                delete obj[keyPath];
            }
            return obj;
        }
        : function (obj) { return obj; };
}

var Table =  (function () {
    function Table() {
    }
    Table.prototype._trans = function (mode, fn, writeLocked) {
        var trans = this._tx || PSD.trans;
        var tableName = this.name;
        function checkTableInTransaction(resolve, reject, trans) {
            if (!trans.schema[tableName])
                throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
            return fn(trans.idbtrans, trans);
        }
        var wasRootExec = beginMicroTickScope();
        try {
            return trans && trans.db === this.db ?
                trans === PSD.trans ?
                    trans._promise(mode, checkTableInTransaction, writeLocked) :
                    newScope(function () { return trans._promise(mode, checkTableInTransaction, writeLocked); }, { trans: trans, transless: PSD.transless || PSD }) :
                tempTransaction(this.db, mode, [this.name], checkTableInTransaction);
        }
        finally {
            if (wasRootExec)
                endMicroTickScope();
        }
    };
    Table.prototype.get = function (keyOrCrit, cb) {
        var _this = this;
        if (keyOrCrit && keyOrCrit.constructor === Object)
            return this.where(keyOrCrit).first(cb);
        return this._trans('readonly', function (trans) {
            return _this.core.get({ trans: trans, key: keyOrCrit })
                .then(function (res) { return _this.hook.reading.fire(res); });
        }).then(cb);
    };
    Table.prototype.where = function (indexOrCrit) {
        if (typeof indexOrCrit === 'string')
            return new this.db.WhereClause(this, indexOrCrit);
        if (isArray(indexOrCrit))
            return new this.db.WhereClause(this, "[" + indexOrCrit.join('+') + "]");
        var keyPaths = keys(indexOrCrit);
        if (keyPaths.length === 1)
            return this
                .where(keyPaths[0])
                .equals(indexOrCrit[keyPaths[0]]);
        var compoundIndex = this.schema.indexes.concat(this.schema.primKey).filter(function (ix) {
            return ix.compound &&
                keyPaths.every(function (keyPath) { return ix.keyPath.indexOf(keyPath) >= 0; }) &&
                ix.keyPath.every(function (keyPath) { return keyPaths.indexOf(keyPath) >= 0; });
        })[0];
        if (compoundIndex && this.db._maxKey !== maxString)
            return this
                .where(compoundIndex.name)
                .equals(compoundIndex.keyPath.map(function (kp) { return indexOrCrit[kp]; }));
        if (!compoundIndex && debug)
            console.warn("The query " + JSON.stringify(indexOrCrit) + " on " + this.name + " would benefit of a " +
                ("compound index [" + keyPaths.join('+') + "]"));
        var idxByName = this.schema.idxByName;
        var idb = this.db._deps.indexedDB;
        function equals(a, b) {
            try {
                return idb.cmp(a, b) === 0;
            }
            catch (e) {
                return false;
            }
        }
        var _a = keyPaths.reduce(function (_a, keyPath) {
            var prevIndex = _a[0], prevFilterFn = _a[1];
            var index = idxByName[keyPath];
            var value = indexOrCrit[keyPath];
            return [
                prevIndex || index,
                prevIndex || !index ?
                    combine(prevFilterFn, index && index.multi ?
                        function (x) {
                            var prop = getByKeyPath(x, keyPath);
                            return isArray(prop) && prop.some(function (item) { return equals(value, item); });
                        } : function (x) { return equals(value, getByKeyPath(x, keyPath)); })
                    : prevFilterFn
            ];
        }, [null, null]), idx = _a[0], filterFunction = _a[1];
        return idx ?
            this.where(idx.name).equals(indexOrCrit[idx.keyPath])
                .filter(filterFunction) :
            compoundIndex ?
                this.filter(filterFunction) :
                this.where(keyPaths).equals('');
    };
    Table.prototype.filter = function (filterFunction) {
        return this.toCollection().and(filterFunction);
    };
    Table.prototype.count = function (thenShortcut) {
        return this.toCollection().count(thenShortcut);
    };
    Table.prototype.offset = function (offset) {
        return this.toCollection().offset(offset);
    };
    Table.prototype.limit = function (numRows) {
        return this.toCollection().limit(numRows);
    };
    Table.prototype.each = function (callback) {
        return this.toCollection().each(callback);
    };
    Table.prototype.toArray = function (thenShortcut) {
        return this.toCollection().toArray(thenShortcut);
    };
    Table.prototype.toCollection = function () {
        return new this.db.Collection(new this.db.WhereClause(this));
    };
    Table.prototype.orderBy = function (index) {
        return new this.db.Collection(new this.db.WhereClause(this, isArray(index) ?
            "[" + index.join('+') + "]" :
            index));
    };
    Table.prototype.reverse = function () {
        return this.toCollection().reverse();
    };
    Table.prototype.mapToClass = function (constructor) {
        this.schema.mappedClass = constructor;
        var readHook = function (obj) {
            if (!obj)
                return obj;
            var res = Object.create(constructor.prototype);
            for (var m in obj)
                if (hasOwn(obj, m))
                    try {
                        res[m] = obj[m];
                    }
                    catch (_) { }
            return res;
        };
        if (this.schema.readHook) {
            this.hook.reading.unsubscribe(this.schema.readHook);
        }
        this.schema.readHook = readHook;
        this.hook("reading", readHook);
        return constructor;
    };
    Table.prototype.defineClass = function () {
        function Class(content) {
            extend(this, content);
        }
        return this.mapToClass(Class);
    };
    Table.prototype.add = function (obj, key) {
        var _this = this;
        var _a = this.schema.primKey, auto = _a.auto, keyPath = _a.keyPath;
        var objToAdd = obj;
        if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
        }
        return this._trans('readwrite', function (trans) {
            return _this.core.mutate({ trans: trans, type: 'add', keys: key != null ? [key] : null, values: [objToAdd] });
        }).then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult; })
            .then(function (lastResult) {
            if (keyPath) {
                try {
                    setByKeyPath(obj, keyPath, lastResult);
                }
                catch (_) { }
            }
            return lastResult;
        });
    };
    Table.prototype.update = function (keyOrObject, modifications) {
        if (typeof keyOrObject === 'object' && !isArray(keyOrObject)) {
            var key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
            if (key === undefined)
                return rejection(new exceptions.InvalidArgument("Given object does not contain its primary key"));
            try {
                if (typeof modifications !== "function") {
                    keys(modifications).forEach(function (keyPath) {
                        setByKeyPath(keyOrObject, keyPath, modifications[keyPath]);
                    });
                }
                else {
                    modifications(keyOrObject, { value: keyOrObject, primKey: key });
                }
            }
            catch (_a) {
            }
            return this.where(":id").equals(key).modify(modifications);
        }
        else {
            return this.where(":id").equals(keyOrObject).modify(modifications);
        }
    };
    Table.prototype.put = function (obj, key) {
        var _this = this;
        var _a = this.schema.primKey, auto = _a.auto, keyPath = _a.keyPath;
        var objToAdd = obj;
        if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
        }
        return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'put', values: [objToAdd], keys: key != null ? [key] : null }); })
            .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult; })
            .then(function (lastResult) {
            if (keyPath) {
                try {
                    setByKeyPath(obj, keyPath, lastResult);
                }
                catch (_) { }
            }
            return lastResult;
        });
    };
    Table.prototype.delete = function (key) {
        var _this = this;
        return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'delete', keys: [key] }); })
            .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined; });
    };
    Table.prototype.clear = function () {
        var _this = this;
        return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'deleteRange', range: AnyRange }); })
            .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined; });
    };
    Table.prototype.bulkGet = function (keys) {
        var _this = this;
        return this._trans('readonly', function (trans) {
            return _this.core.getMany({
                keys: keys,
                trans: trans
            }).then(function (result) { return result.map(function (res) { return _this.hook.reading.fire(res); }); });
        });
    };
    Table.prototype.bulkAdd = function (objects, keysOrOptions, options) {
        var _this = this;
        var keys = Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
        options = options || (keys ? undefined : keysOrOptions);
        var wantResults = options ? options.allKeys : undefined;
        return this._trans('readwrite', function (trans) {
            var _a = _this.schema.primKey, auto = _a.auto, keyPath = _a.keyPath;
            if (keyPath && keys)
                throw new exceptions.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
            if (keys && keys.length !== objects.length)
                throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            var numObjects = objects.length;
            var objectsToAdd = keyPath && auto ?
                objects.map(workaroundForUndefinedPrimKey(keyPath)) :
                objects;
            return _this.core.mutate({ trans: trans, type: 'add', keys: keys, values: objectsToAdd, wantResults: wantResults })
                .then(function (_a) {
                var numFailures = _a.numFailures, results = _a.results, lastResult = _a.lastResult, failures = _a.failures;
                var result = wantResults ? results : lastResult;
                if (numFailures === 0)
                    return result;
                throw new BulkError(_this.name + ".bulkAdd(): " + numFailures + " of " + numObjects + " operations failed", failures);
            });
        });
    };
    Table.prototype.bulkPut = function (objects, keysOrOptions, options) {
        var _this = this;
        var keys = Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
        options = options || (keys ? undefined : keysOrOptions);
        var wantResults = options ? options.allKeys : undefined;
        return this._trans('readwrite', function (trans) {
            var _a = _this.schema.primKey, auto = _a.auto, keyPath = _a.keyPath;
            if (keyPath && keys)
                throw new exceptions.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
            if (keys && keys.length !== objects.length)
                throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            var numObjects = objects.length;
            var objectsToPut = keyPath && auto ?
                objects.map(workaroundForUndefinedPrimKey(keyPath)) :
                objects;
            return _this.core.mutate({ trans: trans, type: 'put', keys: keys, values: objectsToPut, wantResults: wantResults })
                .then(function (_a) {
                var numFailures = _a.numFailures, results = _a.results, lastResult = _a.lastResult, failures = _a.failures;
                var result = wantResults ? results : lastResult;
                if (numFailures === 0)
                    return result;
                throw new BulkError(_this.name + ".bulkPut(): " + numFailures + " of " + numObjects + " operations failed", failures);
            });
        });
    };
    Table.prototype.bulkDelete = function (keys) {
        var _this = this;
        var numKeys = keys.length;
        return this._trans('readwrite', function (trans) {
            return _this.core.mutate({ trans: trans, type: 'delete', keys: keys });
        }).then(function (_a) {
            var numFailures = _a.numFailures, lastResult = _a.lastResult, failures = _a.failures;
            if (numFailures === 0)
                return lastResult;
            throw new BulkError(_this.name + ".bulkDelete(): " + numFailures + " of " + numKeys + " operations failed", failures);
        });
    };
    return Table;
}());

function Events(ctx) {
    var evs = {};
    var rv = function (eventName, subscriber) {
        if (subscriber) {
            var i = arguments.length, args = new Array(i - 1);
            while (--i)
                args[i - 1] = arguments[i];
            evs[eventName].subscribe.apply(null, args);
            return ctx;
        }
        else if (typeof (eventName) === 'string') {
            return evs[eventName];
        }
    };
    rv.addEventType = add;
    for (var i = 1, l = arguments.length; i < l; ++i) {
        add(arguments[i]);
    }
    return rv;
    function add(eventName, chainFunction, defaultFunction) {
        if (typeof eventName === 'object')
            return addConfiguredEvents(eventName);
        if (!chainFunction)
            chainFunction = reverseStoppableEventChain;
        if (!defaultFunction)
            defaultFunction = nop;
        var context = {
            subscribers: [],
            fire: defaultFunction,
            subscribe: function (cb) {
                if (context.subscribers.indexOf(cb) === -1) {
                    context.subscribers.push(cb);
                    context.fire = chainFunction(context.fire, cb);
                }
            },
            unsubscribe: function (cb) {
                context.subscribers = context.subscribers.filter(function (fn) { return fn !== cb; });
                context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
            }
        };
        evs[eventName] = rv[eventName] = context;
        return context;
    }
    function addConfiguredEvents(cfg) {
        keys(cfg).forEach(function (eventName) {
            var args = cfg[eventName];
            if (isArray(args)) {
                add(eventName, cfg[eventName][0], cfg[eventName][1]);
            }
            else if (args === 'asap') {
                var context = add(eventName, mirror, function fire() {
                    var i = arguments.length, args = new Array(i);
                    while (i--)
                        args[i] = arguments[i];
                    context.subscribers.forEach(function (fn) {
                        asap$1(function fireEvent() {
                            fn.apply(null, args);
                        });
                    });
                });
            }
            else
                throw new exceptions.InvalidArgument("Invalid event config");
        });
    }
}

function makeClassConstructor(prototype, constructor) {
    derive(constructor).from({ prototype: prototype });
    return constructor;
}

function createTableConstructor(db) {
    return makeClassConstructor(Table.prototype, function Table(name, tableSchema, trans) {
        this.db = db;
        this._tx = trans;
        this.name = name;
        this.schema = tableSchema;
        this.hook = db._allTables[name] ? db._allTables[name].hook : Events(null, {
            "creating": [hookCreatingChain, nop],
            "reading": [pureFunctionChain, mirror],
            "updating": [hookUpdatingChain, nop],
            "deleting": [hookDeletingChain, nop]
        });
    });
}

function isPlainKeyRange(ctx, ignoreLimitFilter) {
    return !(ctx.filter || ctx.algorithm || ctx.or) &&
        (ignoreLimitFilter ? ctx.justLimit : !ctx.replayFilter);
}
function addFilter(ctx, fn) {
    ctx.filter = combine(ctx.filter, fn);
}
function addReplayFilter(ctx, factory, isLimitFilter) {
    var curr = ctx.replayFilter;
    ctx.replayFilter = curr ? function () { return combine(curr(), factory()); } : factory;
    ctx.justLimit = isLimitFilter && !curr;
}
function addMatchFilter(ctx, fn) {
    ctx.isMatch = combine(ctx.isMatch, fn);
}
function getIndexOrStore(ctx, coreSchema) {
    if (ctx.isPrimKey)
        return coreSchema.primaryKey;
    var index = coreSchema.getIndexByKeyPath(ctx.index);
    if (!index)
        throw new exceptions.Schema("KeyPath " + ctx.index + " on object store " + coreSchema.name + " is not indexed");
    return index;
}
function openCursor(ctx, coreTable, trans) {
    var index = getIndexOrStore(ctx, coreTable.schema);
    return coreTable.openCursor({
        trans: trans,
        values: !ctx.keysOnly,
        reverse: ctx.dir === 'prev',
        unique: !!ctx.unique,
        query: {
            index: index,
            range: ctx.range
        }
    });
}
function iter(ctx, fn, coreTrans, coreTable) {
    var filter = ctx.replayFilter ? combine(ctx.filter, ctx.replayFilter()) : ctx.filter;
    if (!ctx.or) {
        return iterate(openCursor(ctx, coreTable, coreTrans), combine(ctx.algorithm, filter), fn, !ctx.keysOnly && ctx.valueMapper);
    }
    else {
        var set_1 = {};
        var union = function (item, cursor, advance) {
            if (!filter || filter(cursor, advance, function (result) { return cursor.stop(result); }, function (err) { return cursor.fail(err); })) {
                var primaryKey = cursor.primaryKey;
                var key = '' + primaryKey;
                if (key === '[object ArrayBuffer]')
                    key = '' + new Uint8Array(primaryKey);
                if (!hasOwn(set_1, key)) {
                    set_1[key] = true;
                    fn(item, cursor, advance);
                }
            }
        };
        return Promise.all([
            ctx.or._iterate(union, coreTrans),
            iterate(openCursor(ctx, coreTable, coreTrans), ctx.algorithm, union, !ctx.keysOnly && ctx.valueMapper)
        ]);
    }
}
function iterate(cursorPromise, filter, fn, valueMapper) {
    var mappedFn = valueMapper ? function (x, c, a) { return fn(valueMapper(x), c, a); } : fn;
    var wrappedFn = wrap(mappedFn);
    return cursorPromise.then(function (cursor) {
        if (cursor) {
            return cursor.start(function () {
                var c = function () { return cursor.continue(); };
                if (!filter || filter(cursor, function (advancer) { return c = advancer; }, function (val) { cursor.stop(val); c = nop; }, function (e) { cursor.fail(e); c = nop; }))
                    wrappedFn(cursor.value, cursor, function (advancer) { return c = advancer; });
                c();
            });
        }
    });
}

function cmp(a, b) {
    try {
        var ta = type(a);
        var tb = type(b);
        if (ta !== tb) {
            if (ta === 'Array')
                return 1;
            if (tb === 'Array')
                return -1;
            if (ta === 'binary')
                return 1;
            if (tb === 'binary')
                return -1;
            if (ta === 'string')
                return 1;
            if (tb === 'string')
                return -1;
            if (ta === 'Date')
                return 1;
            if (tb !== 'Date')
                return NaN;
            return -1;
        }
        switch (ta) {
            case 'number':
            case 'Date':
            case 'string':
                return a > b ? 1 : a < b ? -1 : 0;
            case 'binary': {
                return compareUint8Arrays(getUint8Array(a), getUint8Array(b));
            }
            case 'Array':
                return compareArrays(a, b);
        }
    }
    catch (_a) { }
    return NaN;
}
function compareArrays(a, b) {
    var al = a.length;
    var bl = b.length;
    var l = al < bl ? al : bl;
    for (var i = 0; i < l; ++i) {
        var res = cmp(a[i], b[i]);
        if (res !== 0)
            return res;
    }
    return al === bl ? 0 : al < bl ? -1 : 1;
}
function compareUint8Arrays(a, b) {
    var al = a.length;
    var bl = b.length;
    var l = al < bl ? al : bl;
    for (var i = 0; i < l; ++i) {
        if (a[i] !== b[i])
            return a[i] < b[i] ? -1 : 1;
    }
    return al === bl ? 0 : al < bl ? -1 : 1;
}
function type(x) {
    var t = typeof x;
    if (t !== 'object')
        return t;
    if (ArrayBuffer.isView(x))
        return 'binary';
    var tsTag = toStringTag(x);
    return tsTag === 'ArrayBuffer' ? 'binary' : tsTag;
}
function getUint8Array(a) {
    if (a instanceof Uint8Array)
        return a;
    if (ArrayBuffer.isView(a))
        return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    return new Uint8Array(a);
}

var Collection =  (function () {
    function Collection() {
    }
    Collection.prototype._read = function (fn, cb) {
        var ctx = this._ctx;
        return ctx.error ?
            ctx.table._trans(null, rejection.bind(null, ctx.error)) :
            ctx.table._trans('readonly', fn).then(cb);
    };
    Collection.prototype._write = function (fn) {
        var ctx = this._ctx;
        return ctx.error ?
            ctx.table._trans(null, rejection.bind(null, ctx.error)) :
            ctx.table._trans('readwrite', fn, "locked");
    };
    Collection.prototype._addAlgorithm = function (fn) {
        var ctx = this._ctx;
        ctx.algorithm = combine(ctx.algorithm, fn);
    };
    Collection.prototype._iterate = function (fn, coreTrans) {
        return iter(this._ctx, fn, coreTrans, this._ctx.table.core);
    };
    Collection.prototype.clone = function (props) {
        var rv = Object.create(this.constructor.prototype), ctx = Object.create(this._ctx);
        if (props)
            extend(ctx, props);
        rv._ctx = ctx;
        return rv;
    };
    Collection.prototype.raw = function () {
        this._ctx.valueMapper = null;
        return this;
    };
    Collection.prototype.each = function (fn) {
        var ctx = this._ctx;
        return this._read(function (trans) { return iter(ctx, fn, trans, ctx.table.core); });
    };
    Collection.prototype.count = function (cb) {
        var _this = this;
        return this._read(function (trans) {
            var ctx = _this._ctx;
            var coreTable = ctx.table.core;
            if (isPlainKeyRange(ctx, true)) {
                return coreTable.count({
                    trans: trans,
                    query: {
                        index: getIndexOrStore(ctx, coreTable.schema),
                        range: ctx.range
                    }
                }).then(function (count) { return Math.min(count, ctx.limit); });
            }
            else {
                var count = 0;
                return iter(ctx, function () { ++count; return false; }, trans, coreTable)
                    .then(function () { return count; });
            }
        }).then(cb);
    };
    Collection.prototype.sortBy = function (keyPath, cb) {
        var parts = keyPath.split('.').reverse(), lastPart = parts[0], lastIndex = parts.length - 1;
        function getval(obj, i) {
            if (i)
                return getval(obj[parts[i]], i - 1);
            return obj[lastPart];
        }
        var order = this._ctx.dir === "next" ? 1 : -1;
        function sorter(a, b) {
            var aVal = getval(a, lastIndex), bVal = getval(b, lastIndex);
            return aVal < bVal ? -order : aVal > bVal ? order : 0;
        }
        return this.toArray(function (a) {
            return a.sort(sorter);
        }).then(cb);
    };
    Collection.prototype.toArray = function (cb) {
        var _this = this;
        return this._read(function (trans) {
            var ctx = _this._ctx;
            if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                var valueMapper_1 = ctx.valueMapper;
                var index = getIndexOrStore(ctx, ctx.table.core.schema);
                return ctx.table.core.query({
                    trans: trans,
                    limit: ctx.limit,
                    values: true,
                    query: {
                        index: index,
                        range: ctx.range
                    }
                }).then(function (_a) {
                    var result = _a.result;
                    return valueMapper_1 ? result.map(valueMapper_1) : result;
                });
            }
            else {
                var a_1 = [];
                return iter(ctx, function (item) { return a_1.push(item); }, trans, ctx.table.core).then(function () { return a_1; });
            }
        }, cb);
    };
    Collection.prototype.offset = function (offset) {
        var ctx = this._ctx;
        if (offset <= 0)
            return this;
        ctx.offset += offset;
        if (isPlainKeyRange(ctx)) {
            addReplayFilter(ctx, function () {
                var offsetLeft = offset;
                return function (cursor, advance) {
                    if (offsetLeft === 0)
                        return true;
                    if (offsetLeft === 1) {
                        --offsetLeft;
                        return false;
                    }
                    advance(function () {
                        cursor.advance(offsetLeft);
                        offsetLeft = 0;
                    });
                    return false;
                };
            });
        }
        else {
            addReplayFilter(ctx, function () {
                var offsetLeft = offset;
                return function () { return (--offsetLeft < 0); };
            });
        }
        return this;
    };
    Collection.prototype.limit = function (numRows) {
        this._ctx.limit = Math.min(this._ctx.limit, numRows);
        addReplayFilter(this._ctx, function () {
            var rowsLeft = numRows;
            return function (cursor, advance, resolve) {
                if (--rowsLeft <= 0)
                    advance(resolve);
                return rowsLeft >= 0;
            };
        }, true);
        return this;
    };
    Collection.prototype.until = function (filterFunction, bIncludeStopEntry) {
        addFilter(this._ctx, function (cursor, advance, resolve) {
            if (filterFunction(cursor.value)) {
                advance(resolve);
                return bIncludeStopEntry;
            }
            else {
                return true;
            }
        });
        return this;
    };
    Collection.prototype.first = function (cb) {
        return this.limit(1).toArray(function (a) { return a[0]; }).then(cb);
    };
    Collection.prototype.last = function (cb) {
        return this.reverse().first(cb);
    };
    Collection.prototype.filter = function (filterFunction) {
        addFilter(this._ctx, function (cursor) {
            return filterFunction(cursor.value);
        });
        addMatchFilter(this._ctx, filterFunction);
        return this;
    };
    Collection.prototype.and = function (filter) {
        return this.filter(filter);
    };
    Collection.prototype.or = function (indexName) {
        return new this.db.WhereClause(this._ctx.table, indexName, this);
    };
    Collection.prototype.reverse = function () {
        this._ctx.dir = (this._ctx.dir === "prev" ? "next" : "prev");
        if (this._ondirectionchange)
            this._ondirectionchange(this._ctx.dir);
        return this;
    };
    Collection.prototype.desc = function () {
        return this.reverse();
    };
    Collection.prototype.eachKey = function (cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        return this.each(function (val, cursor) { cb(cursor.key, cursor); });
    };
    Collection.prototype.eachUniqueKey = function (cb) {
        this._ctx.unique = "unique";
        return this.eachKey(cb);
    };
    Collection.prototype.eachPrimaryKey = function (cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        return this.each(function (val, cursor) { cb(cursor.primaryKey, cursor); });
    };
    Collection.prototype.keys = function (cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        var a = [];
        return this.each(function (item, cursor) {
            a.push(cursor.key);
        }).then(function () {
            return a;
        }).then(cb);
    };
    Collection.prototype.primaryKeys = function (cb) {
        var ctx = this._ctx;
        if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
            return this._read(function (trans) {
                var index = getIndexOrStore(ctx, ctx.table.core.schema);
                return ctx.table.core.query({
                    trans: trans,
                    values: false,
                    limit: ctx.limit,
                    query: {
                        index: index,
                        range: ctx.range
                    }
                });
            }).then(function (_a) {
                var result = _a.result;
                return result;
            }).then(cb);
        }
        ctx.keysOnly = !ctx.isMatch;
        var a = [];
        return this.each(function (item, cursor) {
            a.push(cursor.primaryKey);
        }).then(function () {
            return a;
        }).then(cb);
    };
    Collection.prototype.uniqueKeys = function (cb) {
        this._ctx.unique = "unique";
        return this.keys(cb);
    };
    Collection.prototype.firstKey = function (cb) {
        return this.limit(1).keys(function (a) { return a[0]; }).then(cb);
    };
    Collection.prototype.lastKey = function (cb) {
        return this.reverse().firstKey(cb);
    };
    Collection.prototype.distinct = function () {
        var ctx = this._ctx, idx = ctx.index && ctx.table.schema.idxByName[ctx.index];
        if (!idx || !idx.multi)
            return this;
        var set = {};
        addFilter(this._ctx, function (cursor) {
            var strKey = cursor.primaryKey.toString();
            var found = hasOwn(set, strKey);
            set[strKey] = true;
            return !found;
        });
        return this;
    };
    Collection.prototype.modify = function (changes) {
        var _this = this;
        var ctx = this._ctx;
        return this._write(function (trans) {
            var modifyer;
            if (typeof changes === 'function') {
                modifyer = changes;
            }
            else {
                var keyPaths = keys(changes);
                var numKeys = keyPaths.length;
                modifyer = function (item) {
                    var anythingModified = false;
                    for (var i = 0; i < numKeys; ++i) {
                        var keyPath = keyPaths[i], val = changes[keyPath];
                        if (getByKeyPath(item, keyPath) !== val) {
                            setByKeyPath(item, keyPath, val);
                            anythingModified = true;
                        }
                    }
                    return anythingModified;
                };
            }
            var coreTable = ctx.table.core;
            var _a = coreTable.schema.primaryKey, outbound = _a.outbound, extractKey = _a.extractKey;
            var limit = _this.db._options.modifyChunkSize || 200;
            var totalFailures = [];
            var successCount = 0;
            var failedKeys = [];
            var applyMutateResult = function (expectedCount, res) {
                var failures = res.failures, numFailures = res.numFailures;
                successCount += expectedCount - numFailures;
                for (var _i = 0, _a = keys(failures); _i < _a.length; _i++) {
                    var pos = _a[_i];
                    totalFailures.push(failures[pos]);
                }
            };
            return _this.clone().primaryKeys().then(function (keys) {
                var nextChunk = function (offset) {
                    var count = Math.min(limit, keys.length - offset);
                    return coreTable.getMany({
                        trans: trans,
                        keys: keys.slice(offset, offset + count),
                        cache: "immutable"
                    }).then(function (values) {
                        var addValues = [];
                        var putValues = [];
                        var putKeys = outbound ? [] : null;
                        var deleteKeys = [];
                        for (var i = 0; i < count; ++i) {
                            var origValue = values[i];
                            var ctx_1 = {
                                value: deepClone(origValue),
                                primKey: keys[offset + i]
                            };
                            if (modifyer.call(ctx_1, ctx_1.value, ctx_1) !== false) {
                                if (ctx_1.value == null) {
                                    deleteKeys.push(keys[offset + i]);
                                }
                                else if (!outbound && cmp(extractKey(origValue), extractKey(ctx_1.value)) !== 0) {
                                    deleteKeys.push(keys[offset + i]);
                                    addValues.push(ctx_1.value);
                                }
                                else {
                                    putValues.push(ctx_1.value);
                                    if (outbound)
                                        putKeys.push(keys[offset + i]);
                                }
                            }
                        }
                        var criteria = isPlainKeyRange(ctx) &&
                            ctx.limit === Infinity &&
                            (typeof changes !== 'function' || changes === deleteCallback) && {
                            index: ctx.index,
                            range: ctx.range
                        };
                        return Promise.resolve(addValues.length > 0 &&
                            coreTable.mutate({ trans: trans, type: 'add', values: addValues })
                                .then(function (res) {
                                for (var pos in res.failures) {
                                    deleteKeys.splice(parseInt(pos), 1);
                                }
                                applyMutateResult(addValues.length, res);
                            })).then(function () { return (putValues.length > 0 || (criteria && typeof changes === 'object')) &&
                            coreTable.mutate({
                                trans: trans,
                                type: 'put',
                                keys: putKeys,
                                values: putValues,
                                criteria: criteria,
                                changeSpec: typeof changes !== 'function'
                                    && changes
                            }).then(function (res) { return applyMutateResult(putValues.length, res); }); }).then(function () { return (deleteKeys.length > 0 || (criteria && changes === deleteCallback)) &&
                            coreTable.mutate({
                                trans: trans,
                                type: 'delete',
                                keys: deleteKeys,
                                criteria: criteria
                            }).then(function (res) { return applyMutateResult(deleteKeys.length, res); }); }).then(function () {
                            return keys.length > offset + count && nextChunk(offset + limit);
                        });
                    });
                };
                return nextChunk(0).then(function () {
                    if (totalFailures.length > 0)
                        throw new ModifyError("Error modifying one or more objects", totalFailures, successCount, failedKeys);
                    return keys.length;
                });
            });
        });
    };
    Collection.prototype.delete = function () {
        var ctx = this._ctx, range = ctx.range;
        if (isPlainKeyRange(ctx) &&
            ((ctx.isPrimKey && !hangsOnDeleteLargeKeyRange) || range.type === 3 ))
         {
            return this._write(function (trans) {
                var primaryKey = ctx.table.core.schema.primaryKey;
                var coreRange = range;
                return ctx.table.core.count({ trans: trans, query: { index: primaryKey, range: coreRange } }).then(function (count) {
                    return ctx.table.core.mutate({ trans: trans, type: 'deleteRange', range: coreRange })
                        .then(function (_a) {
                        var failures = _a.failures; _a.lastResult; _a.results; var numFailures = _a.numFailures;
                        if (numFailures)
                            throw new ModifyError("Could not delete some values", Object.keys(failures).map(function (pos) { return failures[pos]; }), count - numFailures);
                        return count - numFailures;
                    });
                });
            });
        }
        return this.modify(deleteCallback);
    };
    return Collection;
}());
var deleteCallback = function (value, ctx) { return ctx.value = null; };

function createCollectionConstructor(db) {
    return makeClassConstructor(Collection.prototype, function Collection(whereClause, keyRangeGenerator) {
        this.db = db;
        var keyRange = AnyRange, error = null;
        if (keyRangeGenerator)
            try {
                keyRange = keyRangeGenerator();
            }
            catch (ex) {
                error = ex;
            }
        var whereCtx = whereClause._ctx;
        var table = whereCtx.table;
        var readingHook = table.hook.reading.fire;
        this._ctx = {
            table: table,
            index: whereCtx.index,
            isPrimKey: (!whereCtx.index || (table.schema.primKey.keyPath && whereCtx.index === table.schema.primKey.name)),
            range: keyRange,
            keysOnly: false,
            dir: "next",
            unique: "",
            algorithm: null,
            filter: null,
            replayFilter: null,
            justLimit: true,
            isMatch: null,
            offset: 0,
            limit: Infinity,
            error: error,
            or: whereCtx.or,
            valueMapper: readingHook !== mirror ? readingHook : null
        };
    });
}

function simpleCompare(a, b) {
    return a < b ? -1 : a === b ? 0 : 1;
}
function simpleCompareReverse(a, b) {
    return a > b ? -1 : a === b ? 0 : 1;
}

function fail(collectionOrWhereClause, err, T) {
    var collection = collectionOrWhereClause instanceof WhereClause ?
        new collectionOrWhereClause.Collection(collectionOrWhereClause) :
        collectionOrWhereClause;
    collection._ctx.error = T ? new T(err) : new TypeError(err);
    return collection;
}
function emptyCollection(whereClause) {
    return new whereClause.Collection(whereClause, function () { return rangeEqual(""); }).limit(0);
}
function upperFactory(dir) {
    return dir === "next" ?
        function (s) { return s.toUpperCase(); } :
        function (s) { return s.toLowerCase(); };
}
function lowerFactory(dir) {
    return dir === "next" ?
        function (s) { return s.toLowerCase(); } :
        function (s) { return s.toUpperCase(); };
}
function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp, dir) {
    var length = Math.min(key.length, lowerNeedle.length);
    var llp = -1;
    for (var i = 0; i < length; ++i) {
        var lwrKeyChar = lowerKey[i];
        if (lwrKeyChar !== lowerNeedle[i]) {
            if (cmp(key[i], upperNeedle[i]) < 0)
                return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
            if (cmp(key[i], lowerNeedle[i]) < 0)
                return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
            if (llp >= 0)
                return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
            return null;
        }
        if (cmp(key[i], lwrKeyChar) < 0)
            llp = i;
    }
    if (length < lowerNeedle.length && dir === "next")
        return key + upperNeedle.substr(key.length);
    if (length < key.length && dir === "prev")
        return key.substr(0, upperNeedle.length);
    return (llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1));
}
function addIgnoreCaseAlgorithm(whereClause, match, needles, suffix) {
    var upper, lower, compare, upperNeedles, lowerNeedles, direction, nextKeySuffix, needlesLen = needles.length;
    if (!needles.every(function (s) { return typeof s === 'string'; })) {
        return fail(whereClause, STRING_EXPECTED);
    }
    function initDirection(dir) {
        upper = upperFactory(dir);
        lower = lowerFactory(dir);
        compare = (dir === "next" ? simpleCompare : simpleCompareReverse);
        var needleBounds = needles.map(function (needle) {
            return { lower: lower(needle), upper: upper(needle) };
        }).sort(function (a, b) {
            return compare(a.lower, b.lower);
        });
        upperNeedles = needleBounds.map(function (nb) { return nb.upper; });
        lowerNeedles = needleBounds.map(function (nb) { return nb.lower; });
        direction = dir;
        nextKeySuffix = (dir === "next" ? "" : suffix);
    }
    initDirection("next");
    var c = new whereClause.Collection(whereClause, function () { return createRange(upperNeedles[0], lowerNeedles[needlesLen - 1] + suffix); });
    c._ondirectionchange = function (direction) {
        initDirection(direction);
    };
    var firstPossibleNeedle = 0;
    c._addAlgorithm(function (cursor, advance, resolve) {
        var key = cursor.key;
        if (typeof key !== 'string')
            return false;
        var lowerKey = lower(key);
        if (match(lowerKey, lowerNeedles, firstPossibleNeedle)) {
            return true;
        }
        else {
            var lowestPossibleCasing = null;
            for (var i = firstPossibleNeedle; i < needlesLen; ++i) {
                var casing = nextCasing(key, lowerKey, upperNeedles[i], lowerNeedles[i], compare, direction);
                if (casing === null && lowestPossibleCasing === null)
                    firstPossibleNeedle = i + 1;
                else if (lowestPossibleCasing === null || compare(lowestPossibleCasing, casing) > 0) {
                    lowestPossibleCasing = casing;
                }
            }
            if (lowestPossibleCasing !== null) {
                advance(function () { cursor.continue(lowestPossibleCasing + nextKeySuffix); });
            }
            else {
                advance(resolve);
            }
            return false;
        }
    });
    return c;
}
function createRange(lower, upper, lowerOpen, upperOpen) {
    return {
        type: 2 ,
        lower: lower,
        upper: upper,
        lowerOpen: lowerOpen,
        upperOpen: upperOpen
    };
}
function rangeEqual(value) {
    return {
        type: 1 ,
        lower: value,
        upper: value
    };
}

var WhereClause =  (function () {
    function WhereClause() {
    }
    Object.defineProperty(WhereClause.prototype, "Collection", {
        get: function () {
            return this._ctx.table.db.Collection;
        },
        enumerable: false,
        configurable: true
    });
    WhereClause.prototype.between = function (lower, upper, includeLower, includeUpper) {
        includeLower = includeLower !== false;
        includeUpper = includeUpper === true;
        try {
            if ((this._cmp(lower, upper) > 0) ||
                (this._cmp(lower, upper) === 0 && (includeLower || includeUpper) && !(includeLower && includeUpper)))
                return emptyCollection(this);
            return new this.Collection(this, function () { return createRange(lower, upper, !includeLower, !includeUpper); });
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
    };
    WhereClause.prototype.equals = function (value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, function () { return rangeEqual(value); });
    };
    WhereClause.prototype.above = function (value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, function () { return createRange(value, undefined, true); });
    };
    WhereClause.prototype.aboveOrEqual = function (value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, function () { return createRange(value, undefined, false); });
    };
    WhereClause.prototype.below = function (value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, function () { return createRange(undefined, value, false, true); });
    };
    WhereClause.prototype.belowOrEqual = function (value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, function () { return createRange(undefined, value); });
    };
    WhereClause.prototype.startsWith = function (str) {
        if (typeof str !== 'string')
            return fail(this, STRING_EXPECTED);
        return this.between(str, str + maxString, true, true);
    };
    WhereClause.prototype.startsWithIgnoreCase = function (str) {
        if (str === "")
            return this.startsWith(str);
        return addIgnoreCaseAlgorithm(this, function (x, a) { return x.indexOf(a[0]) === 0; }, [str], maxString);
    };
    WhereClause.prototype.equalsIgnoreCase = function (str) {
        return addIgnoreCaseAlgorithm(this, function (x, a) { return x === a[0]; }, [str], "");
    };
    WhereClause.prototype.anyOfIgnoreCase = function () {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return emptyCollection(this);
        return addIgnoreCaseAlgorithm(this, function (x, a) { return a.indexOf(x) !== -1; }, set, "");
    };
    WhereClause.prototype.startsWithAnyOfIgnoreCase = function () {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return emptyCollection(this);
        return addIgnoreCaseAlgorithm(this, function (x, a) { return a.some(function (n) { return x.indexOf(n) === 0; }); }, set, maxString);
    };
    WhereClause.prototype.anyOf = function () {
        var _this = this;
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        var compare = this._cmp;
        try {
            set.sort(compare);
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        if (set.length === 0)
            return emptyCollection(this);
        var c = new this.Collection(this, function () { return createRange(set[0], set[set.length - 1]); });
        c._ondirectionchange = function (direction) {
            compare = (direction === "next" ?
                _this._ascending :
                _this._descending);
            set.sort(compare);
        };
        var i = 0;
        c._addAlgorithm(function (cursor, advance, resolve) {
            var key = cursor.key;
            while (compare(key, set[i]) > 0) {
                ++i;
                if (i === set.length) {
                    advance(resolve);
                    return false;
                }
            }
            if (compare(key, set[i]) === 0) {
                return true;
            }
            else {
                advance(function () { cursor.continue(set[i]); });
                return false;
            }
        });
        return c;
    };
    WhereClause.prototype.notEqual = function (value) {
        return this.inAnyRange([[minKey, value], [value, this.db._maxKey]], { includeLowers: false, includeUppers: false });
    };
    WhereClause.prototype.noneOf = function () {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return new this.Collection(this);
        try {
            set.sort(this._ascending);
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        var ranges = set.reduce(function (res, val) { return res ?
            res.concat([[res[res.length - 1][1], val]]) :
            [[minKey, val]]; }, null);
        ranges.push([set[set.length - 1], this.db._maxKey]);
        return this.inAnyRange(ranges, { includeLowers: false, includeUppers: false });
    };
    WhereClause.prototype.inAnyRange = function (ranges, options) {
        var _this = this;
        var cmp = this._cmp, ascending = this._ascending, descending = this._descending, min = this._min, max = this._max;
        if (ranges.length === 0)
            return emptyCollection(this);
        if (!ranges.every(function (range) {
            return range[0] !== undefined &&
                range[1] !== undefined &&
                ascending(range[0], range[1]) <= 0;
        })) {
            return fail(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", exceptions.InvalidArgument);
        }
        var includeLowers = !options || options.includeLowers !== false;
        var includeUppers = options && options.includeUppers === true;
        function addRange(ranges, newRange) {
            var i = 0, l = ranges.length;
            for (; i < l; ++i) {
                var range = ranges[i];
                if (cmp(newRange[0], range[1]) < 0 && cmp(newRange[1], range[0]) > 0) {
                    range[0] = min(range[0], newRange[0]);
                    range[1] = max(range[1], newRange[1]);
                    break;
                }
            }
            if (i === l)
                ranges.push(newRange);
            return ranges;
        }
        var sortDirection = ascending;
        function rangeSorter(a, b) { return sortDirection(a[0], b[0]); }
        var set;
        try {
            set = ranges.reduce(addRange, []);
            set.sort(rangeSorter);
        }
        catch (ex) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        var rangePos = 0;
        var keyIsBeyondCurrentEntry = includeUppers ?
            function (key) { return ascending(key, set[rangePos][1]) > 0; } :
            function (key) { return ascending(key, set[rangePos][1]) >= 0; };
        var keyIsBeforeCurrentEntry = includeLowers ?
            function (key) { return descending(key, set[rangePos][0]) > 0; } :
            function (key) { return descending(key, set[rangePos][0]) >= 0; };
        function keyWithinCurrentRange(key) {
            return !keyIsBeyondCurrentEntry(key) && !keyIsBeforeCurrentEntry(key);
        }
        var checkKey = keyIsBeyondCurrentEntry;
        var c = new this.Collection(this, function () { return createRange(set[0][0], set[set.length - 1][1], !includeLowers, !includeUppers); });
        c._ondirectionchange = function (direction) {
            if (direction === "next") {
                checkKey = keyIsBeyondCurrentEntry;
                sortDirection = ascending;
            }
            else {
                checkKey = keyIsBeforeCurrentEntry;
                sortDirection = descending;
            }
            set.sort(rangeSorter);
        };
        c._addAlgorithm(function (cursor, advance, resolve) {
            var key = cursor.key;
            while (checkKey(key)) {
                ++rangePos;
                if (rangePos === set.length) {
                    advance(resolve);
                    return false;
                }
            }
            if (keyWithinCurrentRange(key)) {
                return true;
            }
            else if (_this._cmp(key, set[rangePos][1]) === 0 || _this._cmp(key, set[rangePos][0]) === 0) {
                return false;
            }
            else {
                advance(function () {
                    if (sortDirection === ascending)
                        cursor.continue(set[rangePos][0]);
                    else
                        cursor.continue(set[rangePos][1]);
                });
                return false;
            }
        });
        return c;
    };
    WhereClause.prototype.startsWithAnyOf = function () {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (!set.every(function (s) { return typeof s === 'string'; })) {
            return fail(this, "startsWithAnyOf() only works with strings");
        }
        if (set.length === 0)
            return emptyCollection(this);
        return this.inAnyRange(set.map(function (str) { return [str, str + maxString]; }));
    };
    return WhereClause;
}());

function createWhereClauseConstructor(db) {
    return makeClassConstructor(WhereClause.prototype, function WhereClause(table, index, orCollection) {
        this.db = db;
        this._ctx = {
            table: table,
            index: index === ":id" ? null : index,
            or: orCollection
        };
        var indexedDB = db._deps.indexedDB;
        if (!indexedDB)
            throw new exceptions.MissingAPI();
        this._cmp = this._ascending = indexedDB.cmp.bind(indexedDB);
        this._descending = function (a, b) { return indexedDB.cmp(b, a); };
        this._max = function (a, b) { return indexedDB.cmp(a, b) > 0 ? a : b; };
        this._min = function (a, b) { return indexedDB.cmp(a, b) < 0 ? a : b; };
        this._IDBKeyRange = db._deps.IDBKeyRange;
    });
}

function eventRejectHandler(reject) {
    return wrap(function (event) {
        preventDefault(event);
        reject(event.target.error);
        return false;
    });
}
function preventDefault(event) {
    if (event.stopPropagation)
        event.stopPropagation();
    if (event.preventDefault)
        event.preventDefault();
}

var DEXIE_STORAGE_MUTATED_EVENT_NAME = 'storagemutated';
var STORAGE_MUTATED_DOM_EVENT_NAME = 'x-storagemutated-1';
var globalEvents = Events(null, DEXIE_STORAGE_MUTATED_EVENT_NAME);

var Transaction =  (function () {
    function Transaction() {
    }
    Transaction.prototype._lock = function () {
        assert(!PSD.global);
        ++this._reculock;
        if (this._reculock === 1 && !PSD.global)
            PSD.lockOwnerFor = this;
        return this;
    };
    Transaction.prototype._unlock = function () {
        assert(!PSD.global);
        if (--this._reculock === 0) {
            if (!PSD.global)
                PSD.lockOwnerFor = null;
            while (this._blockedFuncs.length > 0 && !this._locked()) {
                var fnAndPSD = this._blockedFuncs.shift();
                try {
                    usePSD(fnAndPSD[1], fnAndPSD[0]);
                }
                catch (e) { }
            }
        }
        return this;
    };
    Transaction.prototype._locked = function () {
        return this._reculock && PSD.lockOwnerFor !== this;
    };
    Transaction.prototype.create = function (idbtrans) {
        var _this = this;
        if (!this.mode)
            return this;
        var idbdb = this.db.idbdb;
        var dbOpenError = this.db._state.dbOpenError;
        assert(!this.idbtrans);
        if (!idbtrans && !idbdb) {
            switch (dbOpenError && dbOpenError.name) {
                case "DatabaseClosedError":
                    throw new exceptions.DatabaseClosed(dbOpenError);
                case "MissingAPIError":
                    throw new exceptions.MissingAPI(dbOpenError.message, dbOpenError);
                default:
                    throw new exceptions.OpenFailed(dbOpenError);
            }
        }
        if (!this.active)
            throw new exceptions.TransactionInactive();
        assert(this._completion._state === null);
        idbtrans = this.idbtrans = idbtrans ||
            (this.db.core
                ? this.db.core.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability })
                : idbdb.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability }));
        idbtrans.onerror = wrap(function (ev) {
            preventDefault(ev);
            _this._reject(idbtrans.error);
        });
        idbtrans.onabort = wrap(function (ev) {
            preventDefault(ev);
            _this.active && _this._reject(new exceptions.Abort(idbtrans.error));
            _this.active = false;
            _this.on("abort").fire(ev);
        });
        idbtrans.oncomplete = wrap(function () {
            _this.active = false;
            _this._resolve();
            if ('mutatedParts' in idbtrans) {
                globalEvents.storagemutated.fire(idbtrans["mutatedParts"]);
            }
        });
        return this;
    };
    Transaction.prototype._promise = function (mode, fn, bWriteLock) {
        var _this = this;
        if (mode === 'readwrite' && this.mode !== 'readwrite')
            return rejection(new exceptions.ReadOnly("Transaction is readonly"));
        if (!this.active)
            return rejection(new exceptions.TransactionInactive());
        if (this._locked()) {
            return new DexiePromise(function (resolve, reject) {
                _this._blockedFuncs.push([function () {
                        _this._promise(mode, fn, bWriteLock).then(resolve, reject);
                    }, PSD]);
            });
        }
        else if (bWriteLock) {
            return newScope(function () {
                var p = new DexiePromise(function (resolve, reject) {
                    _this._lock();
                    var rv = fn(resolve, reject, _this);
                    if (rv && rv.then)
                        rv.then(resolve, reject);
                });
                p.finally(function () { return _this._unlock(); });
                p._lib = true;
                return p;
            });
        }
        else {
            var p = new DexiePromise(function (resolve, reject) {
                var rv = fn(resolve, reject, _this);
                if (rv && rv.then)
                    rv.then(resolve, reject);
            });
            p._lib = true;
            return p;
        }
    };
    Transaction.prototype._root = function () {
        return this.parent ? this.parent._root() : this;
    };
    Transaction.prototype.waitFor = function (promiseLike) {
        var root = this._root();
        var promise = DexiePromise.resolve(promiseLike);
        if (root._waitingFor) {
            root._waitingFor = root._waitingFor.then(function () { return promise; });
        }
        else {
            root._waitingFor = promise;
            root._waitingQueue = [];
            var store = root.idbtrans.objectStore(root.storeNames[0]);
            (function spin() {
                ++root._spinCount;
                while (root._waitingQueue.length)
                    (root._waitingQueue.shift())();
                if (root._waitingFor)
                    store.get(-Infinity).onsuccess = spin;
            }());
        }
        var currentWaitPromise = root._waitingFor;
        return new DexiePromise(function (resolve, reject) {
            promise.then(function (res) { return root._waitingQueue.push(wrap(resolve.bind(null, res))); }, function (err) { return root._waitingQueue.push(wrap(reject.bind(null, err))); }).finally(function () {
                if (root._waitingFor === currentWaitPromise) {
                    root._waitingFor = null;
                }
            });
        });
    };
    Transaction.prototype.abort = function () {
        if (this.active) {
            this.active = false;
            if (this.idbtrans)
                this.idbtrans.abort();
            this._reject(new exceptions.Abort());
        }
    };
    Transaction.prototype.table = function (tableName) {
        var memoizedTables = (this._memoizedTables || (this._memoizedTables = {}));
        if (hasOwn(memoizedTables, tableName))
            return memoizedTables[tableName];
        var tableSchema = this.schema[tableName];
        if (!tableSchema) {
            throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
        }
        var transactionBoundTable = new this.db.Table(tableName, tableSchema, this);
        transactionBoundTable.core = this.db.core.table(tableName);
        memoizedTables[tableName] = transactionBoundTable;
        return transactionBoundTable;
    };
    return Transaction;
}());

function createTransactionConstructor(db) {
    return makeClassConstructor(Transaction.prototype, function Transaction(mode, storeNames, dbschema, chromeTransactionDurability, parent) {
        var _this = this;
        this.db = db;
        this.mode = mode;
        this.storeNames = storeNames;
        this.schema = dbschema;
        this.chromeTransactionDurability = chromeTransactionDurability;
        this.idbtrans = null;
        this.on = Events(this, "complete", "error", "abort");
        this.parent = parent || null;
        this.active = true;
        this._reculock = 0;
        this._blockedFuncs = [];
        this._resolve = null;
        this._reject = null;
        this._waitingFor = null;
        this._waitingQueue = null;
        this._spinCount = 0;
        this._completion = new DexiePromise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
        this._completion.then(function () {
            _this.active = false;
            _this.on.complete.fire();
        }, function (e) {
            var wasActive = _this.active;
            _this.active = false;
            _this.on.error.fire(e);
            _this.parent ?
                _this.parent._reject(e) :
                wasActive && _this.idbtrans && _this.idbtrans.abort();
            return rejection(e);
        });
    });
}

function createIndexSpec(name, keyPath, unique, multi, auto, compound, isPrimKey) {
    return {
        name: name,
        keyPath: keyPath,
        unique: unique,
        multi: multi,
        auto: auto,
        compound: compound,
        src: (unique && !isPrimKey ? '&' : '') + (multi ? '*' : '') + (auto ? "++" : "") + nameFromKeyPath(keyPath)
    };
}
function nameFromKeyPath(keyPath) {
    return typeof keyPath === 'string' ?
        keyPath :
        keyPath ? ('[' + [].join.call(keyPath, '+') + ']') : "";
}

function createTableSchema(name, primKey, indexes) {
    return {
        name: name,
        primKey: primKey,
        indexes: indexes,
        mappedClass: null,
        idxByName: arrayToObject(indexes, function (index) { return [index.name, index]; })
    };
}

function safariMultiStoreFix(storeNames) {
    return storeNames.length === 1 ? storeNames[0] : storeNames;
}
var getMaxKey = function (IdbKeyRange) {
    try {
        IdbKeyRange.only([[]]);
        getMaxKey = function () { return [[]]; };
        return [[]];
    }
    catch (e) {
        getMaxKey = function () { return maxString; };
        return maxString;
    }
};

function getKeyExtractor(keyPath) {
    if (keyPath == null) {
        return function () { return undefined; };
    }
    else if (typeof keyPath === 'string') {
        return getSinglePathKeyExtractor(keyPath);
    }
    else {
        return function (obj) { return getByKeyPath(obj, keyPath); };
    }
}
function getSinglePathKeyExtractor(keyPath) {
    var split = keyPath.split('.');
    if (split.length === 1) {
        return function (obj) { return obj[keyPath]; };
    }
    else {
        return function (obj) { return getByKeyPath(obj, keyPath); };
    }
}

function arrayify(arrayLike) {
    return [].slice.call(arrayLike);
}
var _id_counter = 0;
function getKeyPathAlias(keyPath) {
    return keyPath == null ?
        ":id" :
        typeof keyPath === 'string' ?
            keyPath :
            "[" + keyPath.join('+') + "]";
}
function createDBCore(db, IdbKeyRange, tmpTrans) {
    function extractSchema(db, trans) {
        var tables = arrayify(db.objectStoreNames);
        return {
            schema: {
                name: db.name,
                tables: tables.map(function (table) { return trans.objectStore(table); }).map(function (store) {
                    var keyPath = store.keyPath, autoIncrement = store.autoIncrement;
                    var compound = isArray(keyPath);
                    var outbound = keyPath == null;
                    var indexByKeyPath = {};
                    var result = {
                        name: store.name,
                        primaryKey: {
                            name: null,
                            isPrimaryKey: true,
                            outbound: outbound,
                            compound: compound,
                            keyPath: keyPath,
                            autoIncrement: autoIncrement,
                            unique: true,
                            extractKey: getKeyExtractor(keyPath)
                        },
                        indexes: arrayify(store.indexNames).map(function (indexName) { return store.index(indexName); })
                            .map(function (index) {
                            var name = index.name, unique = index.unique, multiEntry = index.multiEntry, keyPath = index.keyPath;
                            var compound = isArray(keyPath);
                            var result = {
                                name: name,
                                compound: compound,
                                keyPath: keyPath,
                                unique: unique,
                                multiEntry: multiEntry,
                                extractKey: getKeyExtractor(keyPath)
                            };
                            indexByKeyPath[getKeyPathAlias(keyPath)] = result;
                            return result;
                        }),
                        getIndexByKeyPath: function (keyPath) { return indexByKeyPath[getKeyPathAlias(keyPath)]; }
                    };
                    indexByKeyPath[":id"] = result.primaryKey;
                    if (keyPath != null) {
                        indexByKeyPath[getKeyPathAlias(keyPath)] = result.primaryKey;
                    }
                    return result;
                })
            },
            hasGetAll: tables.length > 0 && ('getAll' in trans.objectStore(tables[0])) &&
                !(typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
                    !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
                    [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604)
        };
    }
    function makeIDBKeyRange(range) {
        if (range.type === 3 )
            return null;
        if (range.type === 4 )
            throw new Error("Cannot convert never type to IDBKeyRange");
        var lower = range.lower, upper = range.upper, lowerOpen = range.lowerOpen, upperOpen = range.upperOpen;
        var idbRange = lower === undefined ?
            upper === undefined ?
                null :
                IdbKeyRange.upperBound(upper, !!upperOpen) :
            upper === undefined ?
                IdbKeyRange.lowerBound(lower, !!lowerOpen) :
                IdbKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
        return idbRange;
    }
    function createDbCoreTable(tableSchema) {
        var tableName = tableSchema.name;
        function mutate(_a) {
            var trans = _a.trans, type = _a.type, keys = _a.keys, values = _a.values, range = _a.range;
            return new Promise(function (resolve, reject) {
                resolve = wrap(resolve);
                var store = trans.objectStore(tableName);
                var outbound = store.keyPath == null;
                var isAddOrPut = type === "put" || type === "add";
                if (!isAddOrPut && type !== 'delete' && type !== 'deleteRange')
                    throw new Error("Invalid operation type: " + type);
                var length = (keys || values || { length: 1 }).length;
                if (keys && values && keys.length !== values.length) {
                    throw new Error("Given keys array must have same length as given values array.");
                }
                if (length === 0)
                    return resolve({ numFailures: 0, failures: {}, results: [], lastResult: undefined });
                var req;
                var reqs = [];
                var failures = [];
                var numFailures = 0;
                var errorHandler = function (event) {
                    ++numFailures;
                    preventDefault(event);
                };
                if (type === 'deleteRange') {
                    if (range.type === 4 )
                        return resolve({ numFailures: numFailures, failures: failures, results: [], lastResult: undefined });
                    if (range.type === 3 )
                        reqs.push(req = store.clear());
                    else
                        reqs.push(req = store.delete(makeIDBKeyRange(range)));
                }
                else {
                    var _a = isAddOrPut ?
                        outbound ?
                            [values, keys] :
                            [values, null] :
                        [keys, null], args1 = _a[0], args2 = _a[1];
                    if (isAddOrPut) {
                        for (var i = 0; i < length; ++i) {
                            reqs.push(req = (args2 && args2[i] !== undefined ?
                                store[type](args1[i], args2[i]) :
                                store[type](args1[i])));
                            req.onerror = errorHandler;
                        }
                    }
                    else {
                        for (var i = 0; i < length; ++i) {
                            reqs.push(req = store[type](args1[i]));
                            req.onerror = errorHandler;
                        }
                    }
                }
                var done = function (event) {
                    var lastResult = event.target.result;
                    reqs.forEach(function (req, i) { return req.error != null && (failures[i] = req.error); });
                    resolve({
                        numFailures: numFailures,
                        failures: failures,
                        results: type === "delete" ? keys : reqs.map(function (req) { return req.result; }),
                        lastResult: lastResult
                    });
                };
                req.onerror = function (event) {
                    errorHandler(event);
                    done(event);
                };
                req.onsuccess = done;
            });
        }
        function openCursor(_a) {
            var trans = _a.trans, values = _a.values, query = _a.query, reverse = _a.reverse, unique = _a.unique;
            return new Promise(function (resolve, reject) {
                resolve = wrap(resolve);
                var index = query.index, range = query.range;
                var store = trans.objectStore(tableName);
                var source = index.isPrimaryKey ?
                    store :
                    store.index(index.name);
                var direction = reverse ?
                    unique ?
                        "prevunique" :
                        "prev" :
                    unique ?
                        "nextunique" :
                        "next";
                var req = values || !('openKeyCursor' in source) ?
                    source.openCursor(makeIDBKeyRange(range), direction) :
                    source.openKeyCursor(makeIDBKeyRange(range), direction);
                req.onerror = eventRejectHandler(reject);
                req.onsuccess = wrap(function (ev) {
                    var cursor = req.result;
                    if (!cursor) {
                        resolve(null);
                        return;
                    }
                    cursor.___id = ++_id_counter;
                    cursor.done = false;
                    var _cursorContinue = cursor.continue.bind(cursor);
                    var _cursorContinuePrimaryKey = cursor.continuePrimaryKey;
                    if (_cursorContinuePrimaryKey)
                        _cursorContinuePrimaryKey = _cursorContinuePrimaryKey.bind(cursor);
                    var _cursorAdvance = cursor.advance.bind(cursor);
                    var doThrowCursorIsNotStarted = function () { throw new Error("Cursor not started"); };
                    var doThrowCursorIsStopped = function () { throw new Error("Cursor not stopped"); };
                    cursor.trans = trans;
                    cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsNotStarted;
                    cursor.fail = wrap(reject);
                    cursor.next = function () {
                        var _this = this;
                        var gotOne = 1;
                        return this.start(function () { return gotOne-- ? _this.continue() : _this.stop(); }).then(function () { return _this; });
                    };
                    cursor.start = function (callback) {
                        var iterationPromise = new Promise(function (resolveIteration, rejectIteration) {
                            resolveIteration = wrap(resolveIteration);
                            req.onerror = eventRejectHandler(rejectIteration);
                            cursor.fail = rejectIteration;
                            cursor.stop = function (value) {
                                cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
                                resolveIteration(value);
                            };
                        });
                        var guardedCallback = function () {
                            if (req.result) {
                                try {
                                    callback();
                                }
                                catch (err) {
                                    cursor.fail(err);
                                }
                            }
                            else {
                                cursor.done = true;
                                cursor.start = function () { throw new Error("Cursor behind last entry"); };
                                cursor.stop();
                            }
                        };
                        req.onsuccess = wrap(function (ev) {
                            req.onsuccess = guardedCallback;
                            guardedCallback();
                        });
                        cursor.continue = _cursorContinue;
                        cursor.continuePrimaryKey = _cursorContinuePrimaryKey;
                        cursor.advance = _cursorAdvance;
                        guardedCallback();
                        return iterationPromise;
                    };
                    resolve(cursor);
                }, reject);
            });
        }
        function query(hasGetAll) {
            return function (request) {
                return new Promise(function (resolve, reject) {
                    resolve = wrap(resolve);
                    var trans = request.trans, values = request.values, limit = request.limit, query = request.query;
                    var nonInfinitLimit = limit === Infinity ? undefined : limit;
                    var index = query.index, range = query.range;
                    var store = trans.objectStore(tableName);
                    var source = index.isPrimaryKey ? store : store.index(index.name);
                    var idbKeyRange = makeIDBKeyRange(range);
                    if (limit === 0)
                        return resolve({ result: [] });
                    if (hasGetAll) {
                        var req = values ?
                            source.getAll(idbKeyRange, nonInfinitLimit) :
                            source.getAllKeys(idbKeyRange, nonInfinitLimit);
                        req.onsuccess = function (event) { return resolve({ result: event.target.result }); };
                        req.onerror = eventRejectHandler(reject);
                    }
                    else {
                        var count_1 = 0;
                        var req_1 = values || !('openKeyCursor' in source) ?
                            source.openCursor(idbKeyRange) :
                            source.openKeyCursor(idbKeyRange);
                        var result_1 = [];
                        req_1.onsuccess = function (event) {
                            var cursor = req_1.result;
                            if (!cursor)
                                return resolve({ result: result_1 });
                            result_1.push(values ? cursor.value : cursor.primaryKey);
                            if (++count_1 === limit)
                                return resolve({ result: result_1 });
                            cursor.continue();
                        };
                        req_1.onerror = eventRejectHandler(reject);
                    }
                });
            };
        }
        return {
            name: tableName,
            schema: tableSchema,
            mutate: mutate,
            getMany: function (_a) {
                var trans = _a.trans, keys = _a.keys;
                return new Promise(function (resolve, reject) {
                    resolve = wrap(resolve);
                    var store = trans.objectStore(tableName);
                    var length = keys.length;
                    var result = new Array(length);
                    var keyCount = 0;
                    var callbackCount = 0;
                    var req;
                    var successHandler = function (event) {
                        var req = event.target;
                        if ((result[req._pos] = req.result) != null)
                            ;
                        if (++callbackCount === keyCount)
                            resolve(result);
                    };
                    var errorHandler = eventRejectHandler(reject);
                    for (var i = 0; i < length; ++i) {
                        var key = keys[i];
                        if (key != null) {
                            req = store.get(keys[i]);
                            req._pos = i;
                            req.onsuccess = successHandler;
                            req.onerror = errorHandler;
                            ++keyCount;
                        }
                    }
                    if (keyCount === 0)
                        resolve(result);
                });
            },
            get: function (_a) {
                var trans = _a.trans, key = _a.key;
                return new Promise(function (resolve, reject) {
                    resolve = wrap(resolve);
                    var store = trans.objectStore(tableName);
                    var req = store.get(key);
                    req.onsuccess = function (event) { return resolve(event.target.result); };
                    req.onerror = eventRejectHandler(reject);
                });
            },
            query: query(hasGetAll),
            openCursor: openCursor,
            count: function (_a) {
                var query = _a.query, trans = _a.trans;
                var index = query.index, range = query.range;
                return new Promise(function (resolve, reject) {
                    var store = trans.objectStore(tableName);
                    var source = index.isPrimaryKey ? store : store.index(index.name);
                    var idbKeyRange = makeIDBKeyRange(range);
                    var req = idbKeyRange ? source.count(idbKeyRange) : source.count();
                    req.onsuccess = wrap(function (ev) { return resolve(ev.target.result); });
                    req.onerror = eventRejectHandler(reject);
                });
            }
        };
    }
    var _a = extractSchema(db, tmpTrans), schema = _a.schema, hasGetAll = _a.hasGetAll;
    var tables = schema.tables.map(function (tableSchema) { return createDbCoreTable(tableSchema); });
    var tableMap = {};
    tables.forEach(function (table) { return tableMap[table.name] = table; });
    return {
        stack: "dbcore",
        transaction: db.transaction.bind(db),
        table: function (name) {
            var result = tableMap[name];
            if (!result)
                throw new Error("Table '" + name + "' not found");
            return tableMap[name];
        },
        MIN_KEY: -Infinity,
        MAX_KEY: getMaxKey(IdbKeyRange),
        schema: schema
    };
}

function createMiddlewareStack(stackImpl, middlewares) {
    return middlewares.reduce(function (down, _a) {
        var create = _a.create;
        return (__assign(__assign({}, down), create(down)));
    }, stackImpl);
}
function createMiddlewareStacks(middlewares, idbdb, _a, tmpTrans) {
    var IDBKeyRange = _a.IDBKeyRange; _a.indexedDB;
    var dbcore = createMiddlewareStack(createDBCore(idbdb, IDBKeyRange, tmpTrans), middlewares.dbcore);
    return {
        dbcore: dbcore
    };
}
function generateMiddlewareStacks(_a, tmpTrans) {
    var db = _a._novip;
    var idbdb = tmpTrans.db;
    var stacks = createMiddlewareStacks(db._middlewares, idbdb, db._deps, tmpTrans);
    db.core = stacks.dbcore;
    db.tables.forEach(function (table) {
        var tableName = table.name;
        if (db.core.schema.tables.some(function (tbl) { return tbl.name === tableName; })) {
            table.core = db.core.table(tableName);
            if (db[tableName] instanceof db.Table) {
                db[tableName].core = table.core;
            }
        }
    });
}

function setApiOnPlace(_a, objs, tableNames, dbschema) {
    var db = _a._novip;
    tableNames.forEach(function (tableName) {
        var schema = dbschema[tableName];
        objs.forEach(function (obj) {
            var propDesc = getPropertyDescriptor(obj, tableName);
            if (!propDesc || ("value" in propDesc && propDesc.value === undefined)) {
                if (obj === db.Transaction.prototype || obj instanceof db.Transaction) {
                    setProp(obj, tableName, {
                        get: function () { return this.table(tableName); },
                        set: function (value) {
                            defineProperty(this, tableName, { value: value, writable: true, configurable: true, enumerable: true });
                        }
                    });
                }
                else {
                    obj[tableName] = new db.Table(tableName, schema);
                }
            }
        });
    });
}
function removeTablesApi(_a, objs) {
    var db = _a._novip;
    objs.forEach(function (obj) {
        for (var key in obj) {
            if (obj[key] instanceof db.Table)
                delete obj[key];
        }
    });
}
function lowerVersionFirst(a, b) {
    return a._cfg.version - b._cfg.version;
}
function runUpgraders(db, oldVersion, idbUpgradeTrans, reject) {
    var globalSchema = db._dbSchema;
    var trans = db._createTransaction('readwrite', db._storeNames, globalSchema);
    trans.create(idbUpgradeTrans);
    trans._completion.catch(reject);
    var rejectTransaction = trans._reject.bind(trans);
    var transless = PSD.transless || PSD;
    newScope(function () {
        PSD.trans = trans;
        PSD.transless = transless;
        if (oldVersion === 0) {
            keys(globalSchema).forEach(function (tableName) {
                createTable(idbUpgradeTrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
            });
            generateMiddlewareStacks(db, idbUpgradeTrans);
            DexiePromise.follow(function () { return db.on.populate.fire(trans); }).catch(rejectTransaction);
        }
        else
            updateTablesAndIndexes(db, oldVersion, trans, idbUpgradeTrans).catch(rejectTransaction);
    });
}
function updateTablesAndIndexes(_a, oldVersion, trans, idbUpgradeTrans) {
    var db = _a._novip;
    var queue = [];
    var versions = db._versions;
    var globalSchema = db._dbSchema = buildGlobalSchema(db, db.idbdb, idbUpgradeTrans);
    var anyContentUpgraderHasRun = false;
    var versToRun = versions.filter(function (v) { return v._cfg.version >= oldVersion; });
    versToRun.forEach(function (version) {
        queue.push(function () {
            var oldSchema = globalSchema;
            var newSchema = version._cfg.dbschema;
            adjustToExistingIndexNames(db, oldSchema, idbUpgradeTrans);
            adjustToExistingIndexNames(db, newSchema, idbUpgradeTrans);
            globalSchema = db._dbSchema = newSchema;
            var diff = getSchemaDiff(oldSchema, newSchema);
            diff.add.forEach(function (tuple) {
                createTable(idbUpgradeTrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
            });
            diff.change.forEach(function (change) {
                if (change.recreate) {
                    throw new exceptions.Upgrade("Not yet support for changing primary key");
                }
                else {
                    var store_1 = idbUpgradeTrans.objectStore(change.name);
                    change.add.forEach(function (idx) { return addIndex(store_1, idx); });
                    change.change.forEach(function (idx) {
                        store_1.deleteIndex(idx.name);
                        addIndex(store_1, idx);
                    });
                    change.del.forEach(function (idxName) { return store_1.deleteIndex(idxName); });
                }
            });
            var contentUpgrade = version._cfg.contentUpgrade;
            if (contentUpgrade && version._cfg.version > oldVersion) {
                generateMiddlewareStacks(db, idbUpgradeTrans);
                trans._memoizedTables = {};
                anyContentUpgraderHasRun = true;
                var upgradeSchema_1 = shallowClone(newSchema);
                diff.del.forEach(function (table) {
                    upgradeSchema_1[table] = oldSchema[table];
                });
                removeTablesApi(db, [db.Transaction.prototype]);
                setApiOnPlace(db, [db.Transaction.prototype], keys(upgradeSchema_1), upgradeSchema_1);
                trans.schema = upgradeSchema_1;
                var contentUpgradeIsAsync_1 = isAsyncFunction(contentUpgrade);
                if (contentUpgradeIsAsync_1) {
                    incrementExpectedAwaits();
                }
                var returnValue_1;
                var promiseFollowed = DexiePromise.follow(function () {
                    returnValue_1 = contentUpgrade(trans);
                    if (returnValue_1) {
                        if (contentUpgradeIsAsync_1) {
                            var decrementor = decrementExpectedAwaits.bind(null, null);
                            returnValue_1.then(decrementor, decrementor);
                        }
                    }
                });
                return (returnValue_1 && typeof returnValue_1.then === 'function' ?
                    DexiePromise.resolve(returnValue_1) : promiseFollowed.then(function () { return returnValue_1; }));
            }
        });
        queue.push(function (idbtrans) {
            if (!anyContentUpgraderHasRun || !hasIEDeleteObjectStoreBug) {
                var newSchema = version._cfg.dbschema;
                deleteRemovedTables(newSchema, idbtrans);
            }
            removeTablesApi(db, [db.Transaction.prototype]);
            setApiOnPlace(db, [db.Transaction.prototype], db._storeNames, db._dbSchema);
            trans.schema = db._dbSchema;
        });
    });
    function runQueue() {
        return queue.length ? DexiePromise.resolve(queue.shift()(trans.idbtrans)).then(runQueue) :
            DexiePromise.resolve();
    }
    return runQueue().then(function () {
        createMissingTables(globalSchema, idbUpgradeTrans);
    });
}
function getSchemaDiff(oldSchema, newSchema) {
    var diff = {
        del: [],
        add: [],
        change: []
    };
    var table;
    for (table in oldSchema) {
        if (!newSchema[table])
            diff.del.push(table);
    }
    for (table in newSchema) {
        var oldDef = oldSchema[table], newDef = newSchema[table];
        if (!oldDef) {
            diff.add.push([table, newDef]);
        }
        else {
            var change = {
                name: table,
                def: newDef,
                recreate: false,
                del: [],
                add: [],
                change: []
            };
            if ((
            '' + (oldDef.primKey.keyPath || '')) !== ('' + (newDef.primKey.keyPath || '')) ||
                (oldDef.primKey.auto !== newDef.primKey.auto && !isIEOrEdge))
             {
                change.recreate = true;
                diff.change.push(change);
            }
            else {
                var oldIndexes = oldDef.idxByName;
                var newIndexes = newDef.idxByName;
                var idxName = void 0;
                for (idxName in oldIndexes) {
                    if (!newIndexes[idxName])
                        change.del.push(idxName);
                }
                for (idxName in newIndexes) {
                    var oldIdx = oldIndexes[idxName], newIdx = newIndexes[idxName];
                    if (!oldIdx)
                        change.add.push(newIdx);
                    else if (oldIdx.src !== newIdx.src)
                        change.change.push(newIdx);
                }
                if (change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                    diff.change.push(change);
                }
            }
        }
    }
    return diff;
}
function createTable(idbtrans, tableName, primKey, indexes) {
    var store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ?
        { keyPath: primKey.keyPath, autoIncrement: primKey.auto } :
        { autoIncrement: primKey.auto });
    indexes.forEach(function (idx) { return addIndex(store, idx); });
    return store;
}
function createMissingTables(newSchema, idbtrans) {
    keys(newSchema).forEach(function (tableName) {
        if (!idbtrans.db.objectStoreNames.contains(tableName)) {
            createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
        }
    });
}
function deleteRemovedTables(newSchema, idbtrans) {
    [].slice.call(idbtrans.db.objectStoreNames).forEach(function (storeName) {
        return newSchema[storeName] == null && idbtrans.db.deleteObjectStore(storeName);
    });
}
function addIndex(store, idx) {
    store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
}
function buildGlobalSchema(db, idbdb, tmpTrans) {
    var globalSchema = {};
    var dbStoreNames = slice(idbdb.objectStoreNames, 0);
    dbStoreNames.forEach(function (storeName) {
        var store = tmpTrans.objectStore(storeName);
        var keyPath = store.keyPath;
        var primKey = createIndexSpec(nameFromKeyPath(keyPath), keyPath || "", false, false, !!store.autoIncrement, keyPath && typeof keyPath !== "string", true);
        var indexes = [];
        for (var j = 0; j < store.indexNames.length; ++j) {
            var idbindex = store.index(store.indexNames[j]);
            keyPath = idbindex.keyPath;
            var index = createIndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== "string", false);
            indexes.push(index);
        }
        globalSchema[storeName] = createTableSchema(storeName, primKey, indexes);
    });
    return globalSchema;
}
function readGlobalSchema(_a, idbdb, tmpTrans) {
    var db = _a._novip;
    db.verno = idbdb.version / 10;
    var globalSchema = db._dbSchema = buildGlobalSchema(db, idbdb, tmpTrans);
    db._storeNames = slice(idbdb.objectStoreNames, 0);
    setApiOnPlace(db, [db._allTables], keys(globalSchema), globalSchema);
}
function verifyInstalledSchema(db, tmpTrans) {
    var installedSchema = buildGlobalSchema(db, db.idbdb, tmpTrans);
    var diff = getSchemaDiff(installedSchema, db._dbSchema);
    return !(diff.add.length || diff.change.some(function (ch) { return ch.add.length || ch.change.length; }));
}
function adjustToExistingIndexNames(_a, schema, idbtrans) {
    var db = _a._novip;
    var storeNames = idbtrans.db.objectStoreNames;
    for (var i = 0; i < storeNames.length; ++i) {
        var storeName = storeNames[i];
        var store = idbtrans.objectStore(storeName);
        db._hasGetAll = 'getAll' in store;
        for (var j = 0; j < store.indexNames.length; ++j) {
            var indexName = store.indexNames[j];
            var keyPath = store.index(indexName).keyPath;
            var dexieName = typeof keyPath === 'string' ? keyPath : "[" + slice(keyPath).join('+') + "]";
            if (schema[storeName]) {
                var indexSpec = schema[storeName].idxByName[dexieName];
                if (indexSpec) {
                    indexSpec.name = indexName;
                    delete schema[storeName].idxByName[dexieName];
                    schema[storeName].idxByName[indexName] = indexSpec;
                }
            }
        }
    }
    if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
        !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
        _global.WorkerGlobalScope && _global instanceof _global.WorkerGlobalScope &&
        [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) {
        db._hasGetAll = false;
    }
}
function parseIndexSyntax(primKeyAndIndexes) {
    return primKeyAndIndexes.split(',').map(function (index, indexNum) {
        index = index.trim();
        var name = index.replace(/([&*]|\+\+)/g, "");
        var keyPath = /^\[/.test(name) ? name.match(/^\[(.*)\]$/)[1].split('+') : name;
        return createIndexSpec(name, keyPath || null, /\&/.test(index), /\*/.test(index), /\+\+/.test(index), isArray(keyPath), indexNum === 0);
    });
}

var Version =  (function () {
    function Version() {
    }
    Version.prototype._parseStoresSpec = function (stores, outSchema) {
        keys(stores).forEach(function (tableName) {
            if (stores[tableName] !== null) {
                var indexes = parseIndexSyntax(stores[tableName]);
                var primKey = indexes.shift();
                if (primKey.multi)
                    throw new exceptions.Schema("Primary key cannot be multi-valued");
                indexes.forEach(function (idx) {
                    if (idx.auto)
                        throw new exceptions.Schema("Only primary key can be marked as autoIncrement (++)");
                    if (!idx.keyPath)
                        throw new exceptions.Schema("Index must have a name and cannot be an empty string");
                });
                outSchema[tableName] = createTableSchema(tableName, primKey, indexes);
            }
        });
    };
    Version.prototype.stores = function (stores) {
        var db = this.db;
        this._cfg.storesSource = this._cfg.storesSource ?
            extend(this._cfg.storesSource, stores) :
            stores;
        var versions = db._versions;
        var storesSpec = {};
        var dbschema = {};
        versions.forEach(function (version) {
            extend(storesSpec, version._cfg.storesSource);
            dbschema = (version._cfg.dbschema = {});
            version._parseStoresSpec(storesSpec, dbschema);
        });
        db._dbSchema = dbschema;
        removeTablesApi(db, [db._allTables, db, db.Transaction.prototype]);
        setApiOnPlace(db, [db._allTables, db, db.Transaction.prototype, this._cfg.tables], keys(dbschema), dbschema);
        db._storeNames = keys(dbschema);
        return this;
    };
    Version.prototype.upgrade = function (upgradeFunction) {
        this._cfg.contentUpgrade = promisableChain(this._cfg.contentUpgrade || nop, upgradeFunction);
        return this;
    };
    return Version;
}());

function createVersionConstructor(db) {
    return makeClassConstructor(Version.prototype, function Version(versionNumber) {
        this.db = db;
        this._cfg = {
            version: versionNumber,
            storesSource: null,
            dbschema: {},
            tables: {},
            contentUpgrade: null
        };
    });
}

function getDbNamesTable(indexedDB, IDBKeyRange) {
    var dbNamesDB = indexedDB["_dbNamesDB"];
    if (!dbNamesDB) {
        dbNamesDB = indexedDB["_dbNamesDB"] = new Dexie$1(DBNAMES_DB, {
            addons: [],
            indexedDB: indexedDB,
            IDBKeyRange: IDBKeyRange,
        });
        dbNamesDB.version(1).stores({ dbnames: "name" });
    }
    return dbNamesDB.table("dbnames");
}
function hasDatabasesNative(indexedDB) {
    return indexedDB && typeof indexedDB.databases === "function";
}
function getDatabaseNames(_a) {
    var indexedDB = _a.indexedDB, IDBKeyRange = _a.IDBKeyRange;
    return hasDatabasesNative(indexedDB)
        ? Promise.resolve(indexedDB.databases()).then(function (infos) {
            return infos
                .map(function (info) { return info.name; })
                .filter(function (name) { return name !== DBNAMES_DB; });
        })
        : getDbNamesTable(indexedDB, IDBKeyRange).toCollection().primaryKeys();
}
function _onDatabaseCreated(_a, name) {
    var indexedDB = _a.indexedDB, IDBKeyRange = _a.IDBKeyRange;
    !hasDatabasesNative(indexedDB) &&
        name !== DBNAMES_DB &&
        getDbNamesTable(indexedDB, IDBKeyRange).put({ name: name }).catch(nop);
}
function _onDatabaseDeleted(_a, name) {
    var indexedDB = _a.indexedDB, IDBKeyRange = _a.IDBKeyRange;
    !hasDatabasesNative(indexedDB) &&
        name !== DBNAMES_DB &&
        getDbNamesTable(indexedDB, IDBKeyRange).delete(name).catch(nop);
}

function vip(fn) {
    return newScope(function () {
        PSD.letThrough = true;
        return fn();
    });
}

function idbReady() {
    var isSafari = !navigator.userAgentData &&
        /Safari\//.test(navigator.userAgent) &&
        !/Chrom(e|ium)\//.test(navigator.userAgent);
    if (!isSafari || !indexedDB.databases)
        return Promise.resolve();
    var intervalId;
    return new Promise(function (resolve) {
        var tryIdb = function () { return indexedDB.databases().finally(resolve); };
        intervalId = setInterval(tryIdb, 100);
        tryIdb();
    }).finally(function () { return clearInterval(intervalId); });
}

function dexieOpen(db) {
    var state = db._state;
    var indexedDB = db._deps.indexedDB;
    if (state.isBeingOpened || db.idbdb)
        return state.dbReadyPromise.then(function () { return state.dbOpenError ?
            rejection(state.dbOpenError) :
            db; });
    debug && (state.openCanceller._stackHolder = getErrorWithStack());
    state.isBeingOpened = true;
    state.dbOpenError = null;
    state.openComplete = false;
    var openCanceller = state.openCanceller;
    function throwIfCancelled() {
        if (state.openCanceller !== openCanceller)
            throw new exceptions.DatabaseClosed('db.open() was cancelled');
    }
    var resolveDbReady = state.dbReadyResolve,
    upgradeTransaction = null, wasCreated = false;
    return DexiePromise.race([openCanceller, (typeof navigator === 'undefined' ? DexiePromise.resolve() : idbReady()).then(function () { return new DexiePromise(function (resolve, reject) {
            throwIfCancelled();
            if (!indexedDB)
                throw new exceptions.MissingAPI();
            var dbName = db.name;
            var req = state.autoSchema ?
                indexedDB.open(dbName) :
                indexedDB.open(dbName, Math.round(db.verno * 10));
            if (!req)
                throw new exceptions.MissingAPI();
            req.onerror = eventRejectHandler(reject);
            req.onblocked = wrap(db._fireOnBlocked);
            req.onupgradeneeded = wrap(function (e) {
                upgradeTransaction = req.transaction;
                if (state.autoSchema && !db._options.allowEmptyDB) {
                    req.onerror = preventDefault;
                    upgradeTransaction.abort();
                    req.result.close();
                    var delreq = indexedDB.deleteDatabase(dbName);
                    delreq.onsuccess = delreq.onerror = wrap(function () {
                        reject(new exceptions.NoSuchDatabase("Database " + dbName + " doesnt exist"));
                    });
                }
                else {
                    upgradeTransaction.onerror = eventRejectHandler(reject);
                    var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion;
                    wasCreated = oldVer < 1;
                    db._novip.idbdb = req.result;
                    runUpgraders(db, oldVer / 10, upgradeTransaction, reject);
                }
            }, reject);
            req.onsuccess = wrap(function () {
                upgradeTransaction = null;
                var idbdb = db._novip.idbdb = req.result;
                var objectStoreNames = slice(idbdb.objectStoreNames);
                if (objectStoreNames.length > 0)
                    try {
                        var tmpTrans = idbdb.transaction(safariMultiStoreFix(objectStoreNames), 'readonly');
                        if (state.autoSchema)
                            readGlobalSchema(db, idbdb, tmpTrans);
                        else {
                            adjustToExistingIndexNames(db, db._dbSchema, tmpTrans);
                            if (!verifyInstalledSchema(db, tmpTrans)) {
                                console.warn("Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Some queries may fail.");
                            }
                        }
                        generateMiddlewareStacks(db, tmpTrans);
                    }
                    catch (e) {
                    }
                connections.push(db);
                idbdb.onversionchange = wrap(function (ev) {
                    state.vcFired = true;
                    db.on("versionchange").fire(ev);
                });
                idbdb.onclose = wrap(function (ev) {
                    db.on("close").fire(ev);
                });
                if (wasCreated)
                    _onDatabaseCreated(db._deps, dbName);
                resolve();
            }, reject);
        }); })]).then(function () {
        throwIfCancelled();
        state.onReadyBeingFired = [];
        return DexiePromise.resolve(vip(function () { return db.on.ready.fire(db.vip); })).then(function fireRemainders() {
            if (state.onReadyBeingFired.length > 0) {
                var remainders_1 = state.onReadyBeingFired.reduce(promisableChain, nop);
                state.onReadyBeingFired = [];
                return DexiePromise.resolve(vip(function () { return remainders_1(db.vip); })).then(fireRemainders);
            }
        });
    }).finally(function () {
        state.onReadyBeingFired = null;
        state.isBeingOpened = false;
    }).then(function () {
        return db;
    }).catch(function (err) {
        state.dbOpenError = err;
        try {
            upgradeTransaction && upgradeTransaction.abort();
        }
        catch (_a) { }
        if (openCanceller === state.openCanceller) {
            db._close();
        }
        return rejection(err);
    }).finally(function () {
        state.openComplete = true;
        resolveDbReady();
    });
}

function awaitIterator(iterator) {
    var callNext = function (result) { return iterator.next(result); }, doThrow = function (error) { return iterator.throw(error); }, onSuccess = step(callNext), onError = step(doThrow);
    function step(getNext) {
        return function (val) {
            var next = getNext(val), value = next.value;
            return next.done ? value :
                (!value || typeof value.then !== 'function' ?
                    isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) :
                    value.then(onSuccess, onError));
        };
    }
    return step(callNext)();
}

function extractTransactionArgs(mode, _tableArgs_, scopeFunc) {
    var i = arguments.length;
    if (i < 2)
        throw new exceptions.InvalidArgument("Too few arguments");
    var args = new Array(i - 1);
    while (--i)
        args[i - 1] = arguments[i];
    scopeFunc = args.pop();
    var tables = flatten(args);
    return [mode, tables, scopeFunc];
}
function enterTransactionScope(db, mode, storeNames, parentTransaction, scopeFunc) {
    return DexiePromise.resolve().then(function () {
        var transless = PSD.transless || PSD;
        var trans = db._createTransaction(mode, storeNames, db._dbSchema, parentTransaction);
        var zoneProps = {
            trans: trans,
            transless: transless
        };
        if (parentTransaction) {
            trans.idbtrans = parentTransaction.idbtrans;
        }
        else {
            try {
                trans.create();
                db._state.PR1398_maxLoop = 3;
            }
            catch (ex) {
                if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
                    console.warn('Dexie: Need to reopen db');
                    db._close();
                    return db.open().then(function () { return enterTransactionScope(db, mode, storeNames, null, scopeFunc); });
                }
                return rejection(ex);
            }
        }
        var scopeFuncIsAsync = isAsyncFunction(scopeFunc);
        if (scopeFuncIsAsync) {
            incrementExpectedAwaits();
        }
        var returnValue;
        var promiseFollowed = DexiePromise.follow(function () {
            returnValue = scopeFunc.call(trans, trans);
            if (returnValue) {
                if (scopeFuncIsAsync) {
                    var decrementor = decrementExpectedAwaits.bind(null, null);
                    returnValue.then(decrementor, decrementor);
                }
                else if (typeof returnValue.next === 'function' && typeof returnValue.throw === 'function') {
                    returnValue = awaitIterator(returnValue);
                }
            }
        }, zoneProps);
        return (returnValue && typeof returnValue.then === 'function' ?
            DexiePromise.resolve(returnValue).then(function (x) { return trans.active ?
                x
                : rejection(new exceptions.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn")); })
            : promiseFollowed.then(function () { return returnValue; })).then(function (x) {
            if (parentTransaction)
                trans._resolve();
            return trans._completion.then(function () { return x; });
        }).catch(function (e) {
            trans._reject(e);
            return rejection(e);
        });
    });
}

function pad(a, value, count) {
    var result = isArray(a) ? a.slice() : [a];
    for (var i = 0; i < count; ++i)
        result.push(value);
    return result;
}
function createVirtualIndexMiddleware(down) {
    return __assign(__assign({}, down), { table: function (tableName) {
            var table = down.table(tableName);
            var schema = table.schema;
            var indexLookup = {};
            var allVirtualIndexes = [];
            function addVirtualIndexes(keyPath, keyTail, lowLevelIndex) {
                var keyPathAlias = getKeyPathAlias(keyPath);
                var indexList = (indexLookup[keyPathAlias] = indexLookup[keyPathAlias] || []);
                var keyLength = keyPath == null ? 0 : typeof keyPath === 'string' ? 1 : keyPath.length;
                var isVirtual = keyTail > 0;
                var virtualIndex = __assign(__assign({}, lowLevelIndex), { isVirtual: isVirtual, keyTail: keyTail, keyLength: keyLength, extractKey: getKeyExtractor(keyPath), unique: !isVirtual && lowLevelIndex.unique });
                indexList.push(virtualIndex);
                if (!virtualIndex.isPrimaryKey) {
                    allVirtualIndexes.push(virtualIndex);
                }
                if (keyLength > 1) {
                    var virtualKeyPath = keyLength === 2 ?
                        keyPath[0] :
                        keyPath.slice(0, keyLength - 1);
                    addVirtualIndexes(virtualKeyPath, keyTail + 1, lowLevelIndex);
                }
                indexList.sort(function (a, b) { return a.keyTail - b.keyTail; });
                return virtualIndex;
            }
            var primaryKey = addVirtualIndexes(schema.primaryKey.keyPath, 0, schema.primaryKey);
            indexLookup[":id"] = [primaryKey];
            for (var _i = 0, _a = schema.indexes; _i < _a.length; _i++) {
                var index = _a[_i];
                addVirtualIndexes(index.keyPath, 0, index);
            }
            function findBestIndex(keyPath) {
                var result = indexLookup[getKeyPathAlias(keyPath)];
                return result && result[0];
            }
            function translateRange(range, keyTail) {
                return {
                    type: range.type === 1  ?
                        2  :
                        range.type,
                    lower: pad(range.lower, range.lowerOpen ? down.MAX_KEY : down.MIN_KEY, keyTail),
                    lowerOpen: true,
                    upper: pad(range.upper, range.upperOpen ? down.MIN_KEY : down.MAX_KEY, keyTail),
                    upperOpen: true
                };
            }
            function translateRequest(req) {
                var index = req.query.index;
                return index.isVirtual ? __assign(__assign({}, req), { query: {
                        index: index,
                        range: translateRange(req.query.range, index.keyTail)
                    } }) : req;
            }
            var result = __assign(__assign({}, table), { schema: __assign(__assign({}, schema), { primaryKey: primaryKey, indexes: allVirtualIndexes, getIndexByKeyPath: findBestIndex }), count: function (req) {
                    return table.count(translateRequest(req));
                }, query: function (req) {
                    return table.query(translateRequest(req));
                }, openCursor: function (req) {
                    var _a = req.query.index, keyTail = _a.keyTail, isVirtual = _a.isVirtual, keyLength = _a.keyLength;
                    if (!isVirtual)
                        return table.openCursor(req);
                    function createVirtualCursor(cursor) {
                        function _continue(key) {
                            key != null ?
                                cursor.continue(pad(key, req.reverse ? down.MAX_KEY : down.MIN_KEY, keyTail)) :
                                req.unique ?
                                    cursor.continue(cursor.key.slice(0, keyLength)
                                        .concat(req.reverse
                                        ? down.MIN_KEY
                                        : down.MAX_KEY, keyTail)) :
                                    cursor.continue();
                        }
                        var virtualCursor = Object.create(cursor, {
                            continue: { value: _continue },
                            continuePrimaryKey: {
                                value: function (key, primaryKey) {
                                    cursor.continuePrimaryKey(pad(key, down.MAX_KEY, keyTail), primaryKey);
                                }
                            },
                            primaryKey: {
                                get: function () {
                                    return cursor.primaryKey;
                                }
                            },
                            key: {
                                get: function () {
                                    var key = cursor.key;
                                    return keyLength === 1 ?
                                        key[0] :
                                        key.slice(0, keyLength);
                                }
                            },
                            value: {
                                get: function () {
                                    return cursor.value;
                                }
                            }
                        });
                        return virtualCursor;
                    }
                    return table.openCursor(translateRequest(req))
                        .then(function (cursor) { return cursor && createVirtualCursor(cursor); });
                } });
            return result;
        } });
}
var virtualIndexMiddleware = {
    stack: "dbcore",
    name: "VirtualIndexMiddleware",
    level: 1,
    create: createVirtualIndexMiddleware
};

function getObjectDiff(a, b, rv, prfx) {
    rv = rv || {};
    prfx = prfx || '';
    keys(a).forEach(function (prop) {
        if (!hasOwn(b, prop)) {
            rv[prfx + prop] = undefined;
        }
        else {
            var ap = a[prop], bp = b[prop];
            if (typeof ap === 'object' && typeof bp === 'object' && ap && bp) {
                var apTypeName = toStringTag(ap);
                var bpTypeName = toStringTag(bp);
                if (apTypeName !== bpTypeName) {
                    rv[prfx + prop] = b[prop];
                }
                else if (apTypeName === 'Object') {
                    getObjectDiff(ap, bp, rv, prfx + prop + '.');
                }
                else if (ap !== bp) {
                    rv[prfx + prop] = b[prop];
                }
            }
            else if (ap !== bp)
                rv[prfx + prop] = b[prop];
        }
    });
    keys(b).forEach(function (prop) {
        if (!hasOwn(a, prop)) {
            rv[prfx + prop] = b[prop];
        }
    });
    return rv;
}

function getEffectiveKeys(primaryKey, req) {
    if (req.type === 'delete')
        return req.keys;
    return req.keys || req.values.map(primaryKey.extractKey);
}

var hooksMiddleware = {
    stack: "dbcore",
    name: "HooksMiddleware",
    level: 2,
    create: function (downCore) { return (__assign(__assign({}, downCore), { table: function (tableName) {
            var downTable = downCore.table(tableName);
            var primaryKey = downTable.schema.primaryKey;
            var tableMiddleware = __assign(__assign({}, downTable), { mutate: function (req) {
                    var dxTrans = PSD.trans;
                    var _a = dxTrans.table(tableName).hook, deleting = _a.deleting, creating = _a.creating, updating = _a.updating;
                    switch (req.type) {
                        case 'add':
                            if (creating.fire === nop)
                                break;
                            return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                        case 'put':
                            if (creating.fire === nop && updating.fire === nop)
                                break;
                            return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                        case 'delete':
                            if (deleting.fire === nop)
                                break;
                            return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                        case 'deleteRange':
                            if (deleting.fire === nop)
                                break;
                            return dxTrans._promise('readwrite', function () { return deleteRange(req); }, true);
                    }
                    return downTable.mutate(req);
                    function addPutOrDelete(req) {
                        var dxTrans = PSD.trans;
                        var keys = req.keys || getEffectiveKeys(primaryKey, req);
                        if (!keys)
                            throw new Error("Keys missing");
                        req = req.type === 'add' || req.type === 'put' ? __assign(__assign({}, req), { keys: keys }) : __assign({}, req);
                        if (req.type !== 'delete')
                            req.values = __spreadArray([], req.values, true);
                        if (req.keys)
                            req.keys = __spreadArray([], req.keys, true);
                        return getExistingValues(downTable, req, keys).then(function (existingValues) {
                            var contexts = keys.map(function (key, i) {
                                var existingValue = existingValues[i];
                                var ctx = { onerror: null, onsuccess: null };
                                if (req.type === 'delete') {
                                    deleting.fire.call(ctx, key, existingValue, dxTrans);
                                }
                                else if (req.type === 'add' || existingValue === undefined) {
                                    var generatedPrimaryKey = creating.fire.call(ctx, key, req.values[i], dxTrans);
                                    if (key == null && generatedPrimaryKey != null) {
                                        key = generatedPrimaryKey;
                                        req.keys[i] = key;
                                        if (!primaryKey.outbound) {
                                            setByKeyPath(req.values[i], primaryKey.keyPath, key);
                                        }
                                    }
                                }
                                else {
                                    var objectDiff = getObjectDiff(existingValue, req.values[i]);
                                    var additionalChanges_1 = updating.fire.call(ctx, objectDiff, key, existingValue, dxTrans);
                                    if (additionalChanges_1) {
                                        var requestedValue_1 = req.values[i];
                                        Object.keys(additionalChanges_1).forEach(function (keyPath) {
                                            if (hasOwn(requestedValue_1, keyPath)) {
                                                requestedValue_1[keyPath] = additionalChanges_1[keyPath];
                                            }
                                            else {
                                                setByKeyPath(requestedValue_1, keyPath, additionalChanges_1[keyPath]);
                                            }
                                        });
                                    }
                                }
                                return ctx;
                            });
                            return downTable.mutate(req).then(function (_a) {
                                var failures = _a.failures, results = _a.results, numFailures = _a.numFailures, lastResult = _a.lastResult;
                                for (var i = 0; i < keys.length; ++i) {
                                    var primKey = results ? results[i] : keys[i];
                                    var ctx = contexts[i];
                                    if (primKey == null) {
                                        ctx.onerror && ctx.onerror(failures[i]);
                                    }
                                    else {
                                        ctx.onsuccess && ctx.onsuccess(req.type === 'put' && existingValues[i] ?
                                            req.values[i] :
                                            primKey
                                        );
                                    }
                                }
                                return { failures: failures, results: results, numFailures: numFailures, lastResult: lastResult };
                            }).catch(function (error) {
                                contexts.forEach(function (ctx) { return ctx.onerror && ctx.onerror(error); });
                                return Promise.reject(error);
                            });
                        });
                    }
                    function deleteRange(req) {
                        return deleteNextChunk(req.trans, req.range, 10000);
                    }
                    function deleteNextChunk(trans, range, limit) {
                        return downTable.query({ trans: trans, values: false, query: { index: primaryKey, range: range }, limit: limit })
                            .then(function (_a) {
                            var result = _a.result;
                            return addPutOrDelete({ type: 'delete', keys: result, trans: trans }).then(function (res) {
                                if (res.numFailures > 0)
                                    return Promise.reject(res.failures[0]);
                                if (result.length < limit) {
                                    return { failures: [], numFailures: 0, lastResult: undefined };
                                }
                                else {
                                    return deleteNextChunk(trans, __assign(__assign({}, range), { lower: result[result.length - 1], lowerOpen: true }), limit);
                                }
                            });
                        });
                    }
                } });
            return tableMiddleware;
        } })); }
};
function getExistingValues(table, req, effectiveKeys) {
    return req.type === "add"
        ? Promise.resolve([])
        : table.getMany({ trans: req.trans, keys: effectiveKeys, cache: "immutable" });
}

function getFromTransactionCache(keys, cache, clone) {
    try {
        if (!cache)
            return null;
        if (cache.keys.length < keys.length)
            return null;
        var result = [];
        for (var i = 0, j = 0; i < cache.keys.length && j < keys.length; ++i) {
            if (cmp(cache.keys[i], keys[j]) !== 0)
                continue;
            result.push(clone ? deepClone(cache.values[i]) : cache.values[i]);
            ++j;
        }
        return result.length === keys.length ? result : null;
    }
    catch (_a) {
        return null;
    }
}
var cacheExistingValuesMiddleware = {
    stack: "dbcore",
    level: -1,
    create: function (core) {
        return {
            table: function (tableName) {
                var table = core.table(tableName);
                return __assign(__assign({}, table), { getMany: function (req) {
                        if (!req.cache) {
                            return table.getMany(req);
                        }
                        var cachedResult = getFromTransactionCache(req.keys, req.trans["_cache"], req.cache === "clone");
                        if (cachedResult) {
                            return DexiePromise.resolve(cachedResult);
                        }
                        return table.getMany(req).then(function (res) {
                            req.trans["_cache"] = {
                                keys: req.keys,
                                values: req.cache === "clone" ? deepClone(res) : res,
                            };
                            return res;
                        });
                    }, mutate: function (req) {
                        if (req.type !== "add")
                            req.trans["_cache"] = null;
                        return table.mutate(req);
                    } });
            },
        };
    },
};

var _a;
function isEmptyRange(node) {
    return !("from" in node);
}
var RangeSet = function (fromOrTree, to) {
    if (this) {
        extend(this, arguments.length ? { d: 1, from: fromOrTree, to: arguments.length > 1 ? to : fromOrTree } : { d: 0 });
    }
    else {
        var rv = new RangeSet();
        if (fromOrTree && ("d" in fromOrTree)) {
            extend(rv, fromOrTree);
        }
        return rv;
    }
};
props(RangeSet.prototype, (_a = {
        add: function (rangeSet) {
            mergeRanges(this, rangeSet);
            return this;
        },
        addKey: function (key) {
            addRange(this, key, key);
            return this;
        },
        addKeys: function (keys) {
            var _this = this;
            keys.forEach(function (key) { return addRange(_this, key, key); });
            return this;
        }
    },
    _a[iteratorSymbol] = function () {
        return getRangeSetIterator(this);
    },
    _a));
function addRange(target, from, to) {
    var diff = cmp(from, to);
    if (isNaN(diff))
        return;
    if (diff > 0)
        throw RangeError();
    if (isEmptyRange(target))
        return extend(target, { from: from, to: to, d: 1 });
    var left = target.l;
    var right = target.r;
    if (cmp(to, target.from) < 0) {
        left
            ? addRange(left, from, to)
            : (target.l = { from: from, to: to, d: 1, l: null, r: null });
        return rebalance(target);
    }
    if (cmp(from, target.to) > 0) {
        right
            ? addRange(right, from, to)
            : (target.r = { from: from, to: to, d: 1, l: null, r: null });
        return rebalance(target);
    }
    if (cmp(from, target.from) < 0) {
        target.from = from;
        target.l = null;
        target.d = right ? right.d + 1 : 1;
    }
    if (cmp(to, target.to) > 0) {
        target.to = to;
        target.r = null;
        target.d = target.l ? target.l.d + 1 : 1;
    }
    var rightWasCutOff = !target.r;
    if (left && !target.l) {
        mergeRanges(target, left);
    }
    if (right && rightWasCutOff) {
        mergeRanges(target, right);
    }
}
function mergeRanges(target, newSet) {
    function _addRangeSet(target, _a) {
        var from = _a.from, to = _a.to, l = _a.l, r = _a.r;
        addRange(target, from, to);
        if (l)
            _addRangeSet(target, l);
        if (r)
            _addRangeSet(target, r);
    }
    if (!isEmptyRange(newSet))
        _addRangeSet(target, newSet);
}
function rangesOverlap(rangeSet1, rangeSet2) {
    var i1 = getRangeSetIterator(rangeSet2);
    var nextResult1 = i1.next();
    if (nextResult1.done)
        return false;
    var a = nextResult1.value;
    var i2 = getRangeSetIterator(rangeSet1);
    var nextResult2 = i2.next(a.from);
    var b = nextResult2.value;
    while (!nextResult1.done && !nextResult2.done) {
        if (cmp(b.from, a.to) <= 0 && cmp(b.to, a.from) >= 0)
            return true;
        cmp(a.from, b.from) < 0
            ? (a = (nextResult1 = i1.next(b.from)).value)
            : (b = (nextResult2 = i2.next(a.from)).value);
    }
    return false;
}
function getRangeSetIterator(node) {
    var state = isEmptyRange(node) ? null : { s: 0, n: node };
    return {
        next: function (key) {
            var keyProvided = arguments.length > 0;
            while (state) {
                switch (state.s) {
                    case 0:
                        state.s = 1;
                        if (keyProvided) {
                            while (state.n.l && cmp(key, state.n.from) < 0)
                                state = { up: state, n: state.n.l, s: 1 };
                        }
                        else {
                            while (state.n.l)
                                state = { up: state, n: state.n.l, s: 1 };
                        }
                    case 1:
                        state.s = 2;
                        if (!keyProvided || cmp(key, state.n.to) <= 0)
                            return { value: state.n, done: false };
                    case 2:
                        if (state.n.r) {
                            state.s = 3;
                            state = { up: state, n: state.n.r, s: 0 };
                            continue;
                        }
                    case 3:
                        state = state.up;
                }
            }
            return { done: true };
        },
    };
}
function rebalance(target) {
    var _a, _b;
    var diff = (((_a = target.r) === null || _a === void 0 ? void 0 : _a.d) || 0) - (((_b = target.l) === null || _b === void 0 ? void 0 : _b.d) || 0);
    var r = diff > 1 ? "r" : diff < -1 ? "l" : "";
    if (r) {
        var l = r === "r" ? "l" : "r";
        var rootClone = __assign({}, target);
        var oldRootRight = target[r];
        target.from = oldRootRight.from;
        target.to = oldRootRight.to;
        target[r] = oldRootRight[r];
        rootClone[r] = oldRootRight[l];
        target[l] = rootClone;
        rootClone.d = computeDepth(rootClone);
    }
    target.d = computeDepth(target);
}
function computeDepth(_a) {
    var r = _a.r, l = _a.l;
    return (r ? (l ? Math.max(r.d, l.d) : r.d) : l ? l.d : 0) + 1;
}

var observabilityMiddleware = {
    stack: "dbcore",
    level: 0,
    create: function (core) {
        var dbName = core.schema.name;
        var FULL_RANGE = new RangeSet(core.MIN_KEY, core.MAX_KEY);
        return __assign(__assign({}, core), { table: function (tableName) {
                var table = core.table(tableName);
                var schema = table.schema;
                var primaryKey = schema.primaryKey;
                var extractKey = primaryKey.extractKey, outbound = primaryKey.outbound;
                var tableClone = __assign(__assign({}, table), { mutate: function (req) {
                        var trans = req.trans;
                        var mutatedParts = trans.mutatedParts || (trans.mutatedParts = {});
                        var getRangeSet = function (indexName) {
                            var part = "idb://" + dbName + "/" + tableName + "/" + indexName;
                            return (mutatedParts[part] ||
                                (mutatedParts[part] = new RangeSet()));
                        };
                        var pkRangeSet = getRangeSet("");
                        var delsRangeSet = getRangeSet(":dels");
                        var type = req.type;
                        var _a = req.type === "deleteRange"
                            ? [req.range]
                            : req.type === "delete"
                                ? [req.keys]
                                : req.values.length < 50
                                    ? [[], req.values]
                                    : [], keys = _a[0], newObjs = _a[1];
                        var oldCache = req.trans["_cache"];
                        return table.mutate(req).then(function (res) {
                            if (isArray(keys)) {
                                if (type !== "delete")
                                    keys = res.results;
                                pkRangeSet.addKeys(keys);
                                var oldObjs = getFromTransactionCache(keys, oldCache);
                                if (!oldObjs && type !== "add") {
                                    delsRangeSet.addKeys(keys);
                                }
                                if (oldObjs || newObjs) {
                                    trackAffectedIndexes(getRangeSet, schema, oldObjs, newObjs);
                                }
                            }
                            else if (keys) {
                                var range = { from: keys.lower, to: keys.upper };
                                delsRangeSet.add(range);
                                pkRangeSet.add(range);
                            }
                            else {
                                pkRangeSet.add(FULL_RANGE);
                                delsRangeSet.add(FULL_RANGE);
                                schema.indexes.forEach(function (idx) { return getRangeSet(idx.name).add(FULL_RANGE); });
                            }
                            return res;
                        });
                    } });
                var getRange = function (_a) {
                    var _b, _c;
                    var _d = _a.query, index = _d.index, range = _d.range;
                    return [
                        index,
                        new RangeSet((_b = range.lower) !== null && _b !== void 0 ? _b : core.MIN_KEY, (_c = range.upper) !== null && _c !== void 0 ? _c : core.MAX_KEY),
                    ];
                };
                var readSubscribers = {
                    get: function (req) { return [primaryKey, new RangeSet(req.key)]; },
                    getMany: function (req) { return [primaryKey, new RangeSet().addKeys(req.keys)]; },
                    count: getRange,
                    query: getRange,
                    openCursor: getRange,
                };
                keys(readSubscribers).forEach(function (method) {
                    tableClone[method] = function (req) {
                        var subscr = PSD.subscr;
                        if (subscr) {
                            var getRangeSet = function (indexName) {
                                var part = "idb://" + dbName + "/" + tableName + "/" + indexName;
                                return (subscr[part] ||
                                    (subscr[part] = new RangeSet()));
                            };
                            var pkRangeSet_1 = getRangeSet("");
                            var delsRangeSet_1 = getRangeSet(":dels");
                            var _a = readSubscribers[method](req), queriedIndex = _a[0], queriedRanges = _a[1];
                            getRangeSet(queriedIndex.name || "").add(queriedRanges);
                            if (!queriedIndex.isPrimaryKey) {
                                if (method === "count") {
                                    delsRangeSet_1.add(FULL_RANGE);
                                }
                                else {
                                    var keysPromise_1 = method === "query" &&
                                        outbound &&
                                        req.values &&
                                        table.query(__assign(__assign({}, req), { values: false }));
                                    return table[method].apply(this, arguments).then(function (res) {
                                        if (method === "query") {
                                            if (outbound && req.values) {
                                                return keysPromise_1.then(function (_a) {
                                                    var resultingKeys = _a.result;
                                                    pkRangeSet_1.addKeys(resultingKeys);
                                                    return res;
                                                });
                                            }
                                            var pKeys = req.values
                                                ? res.result.map(extractKey)
                                                : res.result;
                                            if (req.values) {
                                                pkRangeSet_1.addKeys(pKeys);
                                            }
                                            else {
                                                delsRangeSet_1.addKeys(pKeys);
                                            }
                                        }
                                        else if (method === "openCursor") {
                                            var cursor_1 = res;
                                            var wantValues_1 = req.values;
                                            return (cursor_1 &&
                                                Object.create(cursor_1, {
                                                    key: {
                                                        get: function () {
                                                            delsRangeSet_1.addKey(cursor_1.primaryKey);
                                                            return cursor_1.key;
                                                        },
                                                    },
                                                    primaryKey: {
                                                        get: function () {
                                                            var pkey = cursor_1.primaryKey;
                                                            delsRangeSet_1.addKey(pkey);
                                                            return pkey;
                                                        },
                                                    },
                                                    value: {
                                                        get: function () {
                                                            wantValues_1 && pkRangeSet_1.addKey(cursor_1.primaryKey);
                                                            return cursor_1.value;
                                                        },
                                                    },
                                                }));
                                        }
                                        return res;
                                    });
                                }
                            }
                        }
                        return table[method].apply(this, arguments);
                    };
                });
                return tableClone;
            } });
    },
};
function trackAffectedIndexes(getRangeSet, schema, oldObjs, newObjs) {
    function addAffectedIndex(ix) {
        var rangeSet = getRangeSet(ix.name || "");
        function extractKey(obj) {
            return obj != null ? ix.extractKey(obj) : null;
        }
        var addKeyOrKeys = function (key) { return ix.multiEntry && isArray(key)
            ? key.forEach(function (key) { return rangeSet.addKey(key); })
            : rangeSet.addKey(key); };
        (oldObjs || newObjs).forEach(function (_, i) {
            var oldKey = oldObjs && extractKey(oldObjs[i]);
            var newKey = newObjs && extractKey(newObjs[i]);
            if (cmp(oldKey, newKey) !== 0) {
                if (oldKey != null)
                    addKeyOrKeys(oldKey);
                if (newKey != null)
                    addKeyOrKeys(newKey);
            }
        });
    }
    schema.indexes.forEach(addAffectedIndex);
}

var Dexie$1 =  (function () {
    function Dexie(name, options) {
        var _this = this;
        this._middlewares = {};
        this.verno = 0;
        var deps = Dexie.dependencies;
        this._options = options = __assign({
            addons: Dexie.addons, autoOpen: true,
            indexedDB: deps.indexedDB, IDBKeyRange: deps.IDBKeyRange }, options);
        this._deps = {
            indexedDB: options.indexedDB,
            IDBKeyRange: options.IDBKeyRange
        };
        var addons = options.addons;
        this._dbSchema = {};
        this._versions = [];
        this._storeNames = [];
        this._allTables = {};
        this.idbdb = null;
        this._novip = this;
        var state = {
            dbOpenError: null,
            isBeingOpened: false,
            onReadyBeingFired: null,
            openComplete: false,
            dbReadyResolve: nop,
            dbReadyPromise: null,
            cancelOpen: nop,
            openCanceller: null,
            autoSchema: true,
            PR1398_maxLoop: 3
        };
        state.dbReadyPromise = new DexiePromise(function (resolve) {
            state.dbReadyResolve = resolve;
        });
        state.openCanceller = new DexiePromise(function (_, reject) {
            state.cancelOpen = reject;
        });
        this._state = state;
        this.name = name;
        this.on = Events(this, "populate", "blocked", "versionchange", "close", { ready: [promisableChain, nop] });
        this.on.ready.subscribe = override(this.on.ready.subscribe, function (subscribe) {
            return function (subscriber, bSticky) {
                Dexie.vip(function () {
                    var state = _this._state;
                    if (state.openComplete) {
                        if (!state.dbOpenError)
                            DexiePromise.resolve().then(subscriber);
                        if (bSticky)
                            subscribe(subscriber);
                    }
                    else if (state.onReadyBeingFired) {
                        state.onReadyBeingFired.push(subscriber);
                        if (bSticky)
                            subscribe(subscriber);
                    }
                    else {
                        subscribe(subscriber);
                        var db_1 = _this;
                        if (!bSticky)
                            subscribe(function unsubscribe() {
                                db_1.on.ready.unsubscribe(subscriber);
                                db_1.on.ready.unsubscribe(unsubscribe);
                            });
                    }
                });
            };
        });
        this.Collection = createCollectionConstructor(this);
        this.Table = createTableConstructor(this);
        this.Transaction = createTransactionConstructor(this);
        this.Version = createVersionConstructor(this);
        this.WhereClause = createWhereClauseConstructor(this);
        this.on("versionchange", function (ev) {
            if (ev.newVersion > 0)
                console.warn("Another connection wants to upgrade database '" + _this.name + "'. Closing db now to resume the upgrade.");
            else
                console.warn("Another connection wants to delete database '" + _this.name + "'. Closing db now to resume the delete request.");
            _this.close();
        });
        this.on("blocked", function (ev) {
            if (!ev.newVersion || ev.newVersion < ev.oldVersion)
                console.warn("Dexie.delete('" + _this.name + "') was blocked");
            else
                console.warn("Upgrade '" + _this.name + "' blocked by other connection holding version " + ev.oldVersion / 10);
        });
        this._maxKey = getMaxKey(options.IDBKeyRange);
        this._createTransaction = function (mode, storeNames, dbschema, parentTransaction) { return new _this.Transaction(mode, storeNames, dbschema, _this._options.chromeTransactionDurability, parentTransaction); };
        this._fireOnBlocked = function (ev) {
            _this.on("blocked").fire(ev);
            connections
                .filter(function (c) { return c.name === _this.name && c !== _this && !c._state.vcFired; })
                .map(function (c) { return c.on("versionchange").fire(ev); });
        };
        this.use(virtualIndexMiddleware);
        this.use(hooksMiddleware);
        this.use(observabilityMiddleware);
        this.use(cacheExistingValuesMiddleware);
        this.vip = Object.create(this, { _vip: { value: true } });
        addons.forEach(function (addon) { return addon(_this); });
    }
    Dexie.prototype.version = function (versionNumber) {
        if (isNaN(versionNumber) || versionNumber < 0.1)
            throw new exceptions.Type("Given version is not a positive number");
        versionNumber = Math.round(versionNumber * 10) / 10;
        if (this.idbdb || this._state.isBeingOpened)
            throw new exceptions.Schema("Cannot add version when database is open");
        this.verno = Math.max(this.verno, versionNumber);
        var versions = this._versions;
        var versionInstance = versions.filter(function (v) { return v._cfg.version === versionNumber; })[0];
        if (versionInstance)
            return versionInstance;
        versionInstance = new this.Version(versionNumber);
        versions.push(versionInstance);
        versions.sort(lowerVersionFirst);
        versionInstance.stores({});
        this._state.autoSchema = false;
        return versionInstance;
    };
    Dexie.prototype._whenReady = function (fn) {
        var _this = this;
        return (this.idbdb && (this._state.openComplete || PSD.letThrough || this._vip)) ? fn() : new DexiePromise(function (resolve, reject) {
            if (_this._state.openComplete) {
                return reject(new exceptions.DatabaseClosed(_this._state.dbOpenError));
            }
            if (!_this._state.isBeingOpened) {
                if (!_this._options.autoOpen) {
                    reject(new exceptions.DatabaseClosed());
                    return;
                }
                _this.open().catch(nop);
            }
            _this._state.dbReadyPromise.then(resolve, reject);
        }).then(fn);
    };
    Dexie.prototype.use = function (_a) {
        var stack = _a.stack, create = _a.create, level = _a.level, name = _a.name;
        if (name)
            this.unuse({ stack: stack, name: name });
        var middlewares = this._middlewares[stack] || (this._middlewares[stack] = []);
        middlewares.push({ stack: stack, create: create, level: level == null ? 10 : level, name: name });
        middlewares.sort(function (a, b) { return a.level - b.level; });
        return this;
    };
    Dexie.prototype.unuse = function (_a) {
        var stack = _a.stack, name = _a.name, create = _a.create;
        if (stack && this._middlewares[stack]) {
            this._middlewares[stack] = this._middlewares[stack].filter(function (mw) {
                return create ? mw.create !== create :
                    name ? mw.name !== name :
                        false;
            });
        }
        return this;
    };
    Dexie.prototype.open = function () {
        return dexieOpen(this);
    };
    Dexie.prototype._close = function () {
        var state = this._state;
        var idx = connections.indexOf(this);
        if (idx >= 0)
            connections.splice(idx, 1);
        if (this.idbdb) {
            try {
                this.idbdb.close();
            }
            catch (e) { }
            this._novip.idbdb = null;
        }
        state.dbReadyPromise = new DexiePromise(function (resolve) {
            state.dbReadyResolve = resolve;
        });
        state.openCanceller = new DexiePromise(function (_, reject) {
            state.cancelOpen = reject;
        });
    };
    Dexie.prototype.close = function () {
        this._close();
        var state = this._state;
        this._options.autoOpen = false;
        state.dbOpenError = new exceptions.DatabaseClosed();
        if (state.isBeingOpened)
            state.cancelOpen(state.dbOpenError);
    };
    Dexie.prototype.delete = function () {
        var _this = this;
        var hasArguments = arguments.length > 0;
        var state = this._state;
        return new DexiePromise(function (resolve, reject) {
            var doDelete = function () {
                _this.close();
                var req = _this._deps.indexedDB.deleteDatabase(_this.name);
                req.onsuccess = wrap(function () {
                    _onDatabaseDeleted(_this._deps, _this.name);
                    resolve();
                });
                req.onerror = eventRejectHandler(reject);
                req.onblocked = _this._fireOnBlocked;
            };
            if (hasArguments)
                throw new exceptions.InvalidArgument("Arguments not allowed in db.delete()");
            if (state.isBeingOpened) {
                state.dbReadyPromise.then(doDelete);
            }
            else {
                doDelete();
            }
        });
    };
    Dexie.prototype.backendDB = function () {
        return this.idbdb;
    };
    Dexie.prototype.isOpen = function () {
        return this.idbdb !== null;
    };
    Dexie.prototype.hasBeenClosed = function () {
        var dbOpenError = this._state.dbOpenError;
        return dbOpenError && (dbOpenError.name === 'DatabaseClosed');
    };
    Dexie.prototype.hasFailed = function () {
        return this._state.dbOpenError !== null;
    };
    Dexie.prototype.dynamicallyOpened = function () {
        return this._state.autoSchema;
    };
    Object.defineProperty(Dexie.prototype, "tables", {
        get: function () {
            var _this = this;
            return keys(this._allTables).map(function (name) { return _this._allTables[name]; });
        },
        enumerable: false,
        configurable: true
    });
    Dexie.prototype.transaction = function () {
        var args = extractTransactionArgs.apply(this, arguments);
        return this._transaction.apply(this, args);
    };
    Dexie.prototype._transaction = function (mode, tables, scopeFunc) {
        var _this = this;
        var parentTransaction = PSD.trans;
        if (!parentTransaction || parentTransaction.db !== this || mode.indexOf('!') !== -1)
            parentTransaction = null;
        var onlyIfCompatible = mode.indexOf('?') !== -1;
        mode = mode.replace('!', '').replace('?', '');
        var idbMode, storeNames;
        try {
            storeNames = tables.map(function (table) {
                var storeName = table instanceof _this.Table ? table.name : table;
                if (typeof storeName !== 'string')
                    throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
                return storeName;
            });
            if (mode == "r" || mode === READONLY)
                idbMode = READONLY;
            else if (mode == "rw" || mode == READWRITE)
                idbMode = READWRITE;
            else
                throw new exceptions.InvalidArgument("Invalid transaction mode: " + mode);
            if (parentTransaction) {
                if (parentTransaction.mode === READONLY && idbMode === READWRITE) {
                    if (onlyIfCompatible) {
                        parentTransaction = null;
                    }
                    else
                        throw new exceptions.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                }
                if (parentTransaction) {
                    storeNames.forEach(function (storeName) {
                        if (parentTransaction && parentTransaction.storeNames.indexOf(storeName) === -1) {
                            if (onlyIfCompatible) {
                                parentTransaction = null;
                            }
                            else
                                throw new exceptions.SubTransaction("Table " + storeName +
                                    " not included in parent transaction.");
                        }
                    });
                }
                if (onlyIfCompatible && parentTransaction && !parentTransaction.active) {
                    parentTransaction = null;
                }
            }
        }
        catch (e) {
            return parentTransaction ?
                parentTransaction._promise(null, function (_, reject) { reject(e); }) :
                rejection(e);
        }
        var enterTransaction = enterTransactionScope.bind(null, this, idbMode, storeNames, parentTransaction, scopeFunc);
        return (parentTransaction ?
            parentTransaction._promise(idbMode, enterTransaction, "lock") :
            PSD.trans ?
                usePSD(PSD.transless, function () { return _this._whenReady(enterTransaction); }) :
                this._whenReady(enterTransaction));
    };
    Dexie.prototype.table = function (tableName) {
        if (!hasOwn(this._allTables, tableName)) {
            throw new exceptions.InvalidTable("Table " + tableName + " does not exist");
        }
        return this._allTables[tableName];
    };
    return Dexie;
}());

var symbolObservable = typeof Symbol !== "undefined" && "observable" in Symbol
    ? Symbol.observable
    : "@@observable";
var Observable =  (function () {
    function Observable(subscribe) {
        this._subscribe = subscribe;
    }
    Observable.prototype.subscribe = function (x, error, complete) {
        return this._subscribe(!x || typeof x === "function" ? { next: x, error: error, complete: complete } : x);
    };
    Observable.prototype[symbolObservable] = function () {
        return this;
    };
    return Observable;
}());

function extendObservabilitySet(target, newSet) {
    keys(newSet).forEach(function (part) {
        var rangeSet = target[part] || (target[part] = new RangeSet());
        mergeRanges(rangeSet, newSet[part]);
    });
    return target;
}

function liveQuery(querier) {
    return new Observable(function (observer) {
        var scopeFuncIsAsync = isAsyncFunction(querier);
        function execute(subscr) {
            if (scopeFuncIsAsync) {
                incrementExpectedAwaits();
            }
            var exec = function () { return newScope(querier, { subscr: subscr, trans: null }); };
            var rv = PSD.trans
                ?
                    usePSD(PSD.transless, exec)
                : exec();
            if (scopeFuncIsAsync) {
                rv.then(decrementExpectedAwaits, decrementExpectedAwaits);
            }
            return rv;
        }
        var closed = false;
        var accumMuts = {};
        var currentObs = {};
        var subscription = {
            get closed() {
                return closed;
            },
            unsubscribe: function () {
                closed = true;
                globalEvents.storagemutated.unsubscribe(mutationListener);
            },
        };
        observer.start && observer.start(subscription);
        var querying = false, startedListening = false;
        function shouldNotify() {
            return keys(currentObs).some(function (key) {
                return accumMuts[key] && rangesOverlap(accumMuts[key], currentObs[key]);
            });
        }
        var mutationListener = function (parts) {
            extendObservabilitySet(accumMuts, parts);
            if (shouldNotify()) {
                doQuery();
            }
        };
        var doQuery = function () {
            if (querying || closed)
                return;
            accumMuts = {};
            var subscr = {};
            var ret = execute(subscr);
            if (!startedListening) {
                globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, mutationListener);
                startedListening = true;
            }
            querying = true;
            Promise.resolve(ret).then(function (result) {
                querying = false;
                if (closed)
                    return;
                if (shouldNotify()) {
                    doQuery();
                }
                else {
                    accumMuts = {};
                    currentObs = subscr;
                    observer.next && observer.next(result);
                }
            }, function (err) {
                querying = false;
                observer.error && observer.error(err);
                subscription.unsubscribe();
            });
        };
        doQuery();
        return subscription;
    });
}

var domDeps;
try {
    domDeps = {
        indexedDB: _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
        IDBKeyRange: _global.IDBKeyRange || _global.webkitIDBKeyRange
    };
}
catch (e) {
    domDeps = { indexedDB: null, IDBKeyRange: null };
}

var Dexie = Dexie$1;
props(Dexie, __assign(__assign({}, fullNameExceptions), {
    delete: function (databaseName) {
        var db = new Dexie(databaseName, { addons: [] });
        return db.delete();
    },
    exists: function (name) {
        return new Dexie(name, { addons: [] }).open().then(function (db) {
            db.close();
            return true;
        }).catch('NoSuchDatabaseError', function () { return false; });
    },
    getDatabaseNames: function (cb) {
        try {
            return getDatabaseNames(Dexie.dependencies).then(cb);
        }
        catch (_a) {
            return rejection(new exceptions.MissingAPI());
        }
    },
    defineClass: function () {
        function Class(content) {
            extend(this, content);
        }
        return Class;
    }, ignoreTransaction: function (scopeFunc) {
        return PSD.trans ?
            usePSD(PSD.transless, scopeFunc) :
            scopeFunc();
    }, vip: vip, async: function (generatorFn) {
        return function () {
            try {
                var rv = awaitIterator(generatorFn.apply(this, arguments));
                if (!rv || typeof rv.then !== 'function')
                    return DexiePromise.resolve(rv);
                return rv;
            }
            catch (e) {
                return rejection(e);
            }
        };
    }, spawn: function (generatorFn, args, thiz) {
        try {
            var rv = awaitIterator(generatorFn.apply(thiz, args || []));
            if (!rv || typeof rv.then !== 'function')
                return DexiePromise.resolve(rv);
            return rv;
        }
        catch (e) {
            return rejection(e);
        }
    },
    currentTransaction: {
        get: function () { return PSD.trans || null; }
    }, waitFor: function (promiseOrFunction, optionalTimeout) {
        var promise = DexiePromise.resolve(typeof promiseOrFunction === 'function' ?
            Dexie.ignoreTransaction(promiseOrFunction) :
            promiseOrFunction)
            .timeout(optionalTimeout || 60000);
        return PSD.trans ?
            PSD.trans.waitFor(promise) :
            promise;
    },
    Promise: DexiePromise,
    debug: {
        get: function () { return debug; },
        set: function (value) {
            setDebug(value, value === 'dexie' ? function () { return true; } : dexieStackFrameFilter);
        }
    },
    derive: derive, extend: extend, props: props, override: override,
    Events: Events, on: globalEvents, liveQuery: liveQuery, extendObservabilitySet: extendObservabilitySet,
    getByKeyPath: getByKeyPath, setByKeyPath: setByKeyPath, delByKeyPath: delByKeyPath, shallowClone: shallowClone, deepClone: deepClone, getObjectDiff: getObjectDiff, cmp: cmp, asap: asap$1,
    minKey: minKey,
    addons: [],
    connections: connections,
    errnames: errnames,
    dependencies: domDeps,
    semVer: DEXIE_VERSION, version: DEXIE_VERSION.split('.')
        .map(function (n) { return parseInt(n); })
        .reduce(function (p, c, i) { return p + (c / Math.pow(10, i * 2)); }) }));
Dexie.maxKey = getMaxKey(Dexie.dependencies.IDBKeyRange);

if (typeof dispatchEvent !== 'undefined' && typeof addEventListener !== 'undefined') {
    globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, function (updatedParts) {
        if (!propagatingLocally) {
            var event_1;
            if (isIEOrEdge) {
                event_1 = document.createEvent('CustomEvent');
                event_1.initCustomEvent(STORAGE_MUTATED_DOM_EVENT_NAME, true, true, updatedParts);
            }
            else {
                event_1 = new CustomEvent(STORAGE_MUTATED_DOM_EVENT_NAME, {
                    detail: updatedParts
                });
            }
            propagatingLocally = true;
            dispatchEvent(event_1);
            propagatingLocally = false;
        }
    });
    addEventListener(STORAGE_MUTATED_DOM_EVENT_NAME, function (_a) {
        var detail = _a.detail;
        if (!propagatingLocally) {
            propagateLocally(detail);
        }
    });
}
function propagateLocally(updateParts) {
    var wasMe = propagatingLocally;
    try {
        propagatingLocally = true;
        globalEvents.storagemutated.fire(updateParts);
    }
    finally {
        propagatingLocally = wasMe;
    }
}
var propagatingLocally = false;

if (typeof BroadcastChannel !== 'undefined') {
    var bc_1 = new BroadcastChannel(STORAGE_MUTATED_DOM_EVENT_NAME);
    globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, function (changedParts) {
        if (!propagatingLocally) {
            bc_1.postMessage(changedParts);
        }
    });
    bc_1.onmessage = function (ev) {
        if (ev.data)
            propagateLocally(ev.data);
    };
}
else if (typeof self !== 'undefined' && typeof navigator !== 'undefined') {
    globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, function (changedParts) {
        try {
            if (!propagatingLocally) {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_MUTATED_DOM_EVENT_NAME, JSON.stringify({
                        trig: Math.random(),
                        changedParts: changedParts,
                    }));
                }
                if (typeof self['clients'] === 'object') {
                    __spreadArray([], self['clients'].matchAll({ includeUncontrolled: true }), true).forEach(function (client) {
                        return client.postMessage({
                            type: STORAGE_MUTATED_DOM_EVENT_NAME,
                            changedParts: changedParts,
                        });
                    });
                }
            }
        }
        catch (_a) { }
    });
    if (typeof addEventListener !== 'undefined') {
        addEventListener('storage', function (ev) {
            if (ev.key === STORAGE_MUTATED_DOM_EVENT_NAME) {
                var data = JSON.parse(ev.newValue);
                if (data)
                    propagateLocally(data.changedParts);
            }
        });
    }
    var swContainer = self.document && navigator.serviceWorker;
    if (swContainer) {
        swContainer.addEventListener('message', propagateMessageLocally);
    }
}
function propagateMessageLocally(_a) {
    var data = _a.data;
    if (data && data.type === STORAGE_MUTATED_DOM_EVENT_NAME) {
        propagateLocally(data.changedParts);
    }
}

DexiePromise.rejectionMapper = mapError;
setDebug(debug, dexieStackFrameFilter);

const db = new Dexie$1("db");
db.version(1).stores({
  messages: "++id,ToUserName,FromUserName,MMActualContent"
});
const messages = db["messages"];
function insertMessage(msg) {
  return messages.add(msg);
}
function getMessages(username, limit) {
  return messages.where("ToUserName").equals(username).or("FromUserName").equals(username).limit(limit).toArray();
}
function removeByUserName(username) {
  messages.where("ToUserName").equals(username).or("FromUserName").equals(username).delete();
}

const hooks = {};
function initHookControllers(controller) {
  patch(controller, "controller", (param) => {
    const [name, deps] = param.args;
    console.log("controller", name, hooks);
    if (hooks[name]) {
      console.log(param.args);
      const fn = deps.pop();
      return param.original.apply(param.context, [
        name,
        [
          ...deps,
          (...injected) => {
            return hooks[name].f(
              fn(...injected),
              injected
            );
          }
        ]
      ]);
    }
    return param.original.apply(param.context, param.args);
  });
}
function registerControllerHook(name, hook) {
  hooks[name] = hook;
}

const chatHistory = () => {
  registerServicesHook("chatFactory", {
    f: (chatFactory, [
      _$rootScope,
      _$timeout,
      _$http,
      _$q,
      _contactFactory,
      _accountFactory,
      _emojiFactory,
      confFactory,
      _notificationFactory,
      _utilFactory,
      _reportService,
      _mmHttp,
      _titleRemind
    ]) => {
      patch(chatFactory, "initChatList", ({ context, original, args }) => {
        original.apply(context, args);
        const [userNames] = args;
        userNames.split(",").forEach((userName) => {
          getMessages(userName, 300)?.then(
            (msgs) => {
              for (const msg of msgs) {
                chatFactory.addChatMessage(msg, true);
              }
            }
          );
        });
      });
      patch(chatFactory, "addChatMessage", ({ original, context, args }) => {
        original.apply(context, args);
        const [msg, notSave] = args;
        if (!notSave) {
          const m = { ...msg };
          m.MMStatus = confFactory.MSG_SEND_STATUS_SUCC;
          insertMessage(m);
        }
      });
      return chatFactory;
    }
  });
  registerControllerHook("contentChatController", {
    f: (_, [
      $scope,
      _$timeout,
      _$state,
      _$log,
      _$doc,
      _$com,
      _chatFactory
    ]) => {
      $scope.$on("root:cleanMsg", (_2, un) => {
        removeByUserName(un);
      });
    }
  });
};

const exts = [
  chatHistory,
  hookUploadImg,
  hookScreenshot,
  mention
];
function init() {
  while (exts.length) {
    exts.pop()();
  }
}

export { init, initHookControllers, initHookServices, initTemplateHook };
