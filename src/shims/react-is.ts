// Shim for `react-is` — React 19 removed the react-is package.
// Recharts (es6/util/ReactUtils.js) imports { isFragment } from 'react-is'
// and calls it inside toArray() to detect React Fragments.
// Returning `false` always causes recharts to silently drop Fragment children,
// which can lead to undefined children arrays and runtime crashes.

export function isFragment(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    (obj as any).$$typeof === Symbol.for('react.element') &&
    (obj as any).type === Symbol.for('react.fragment')
  );
}

export function isElement(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    (obj as any).$$typeof === Symbol.for('react.element')
  );
}

export const typeOf = (obj: unknown): symbol | undefined => {
  if (isElement(obj)) {
    return typeof (obj as any).type === 'symbol' ? (obj as any).type : undefined;
  }
  return undefined;
};

export const ContextConsumer = Symbol.for('react.context');
export const ContextProvider = Symbol.for('react.provider');
export const ForwardRef = Symbol.for('react.forward_ref');
export const Memo = Symbol.for('react.memo');

