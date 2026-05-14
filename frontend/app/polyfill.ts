// Polyfill per expo-modules-core su web export
// Alcuni moduli nativi cercano registerWebModule che potrebbe mancare nel bundle web
if (typeof window !== 'undefined') {
  const w = window as any;
  w.expo = w.expo || {};
  w.expo.modules = w.expo.modules || {};
  if (typeof w.expo.modules.registerWebModule !== 'function') {
    w.expo.modules.registerWebModule = () => {};
  }
}
