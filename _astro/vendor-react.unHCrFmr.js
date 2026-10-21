function v(t){return t&&t.__esModule&&Object.prototype.hasOwnProperty.call(t,"default")?t.default:t}var o={exports:{}},u={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var a;function x(){if(a)return u;a=1;var t=Symbol.for("react.transitional.element"),R=Symbol.for("react.fragment");function i(p,r,e){var n=null;if(e!==void 0&&(n=""+e),r.key!==void 0&&(n=""+r.key),"key"in r){e={};for(var s in r)s!=="key"&&(e[s]=r[s])}else e=r;return r=e.ref,{$$typeof:t,type:p,key:n,ref:r!==void 0?r:null,props:e}}return u.Fragment=R,u.jsx=i,u.jsxs=i,u}var l;function d(){return l||(l=1,o.exports=x()),o.exports}var E=d();export{v as g,E as j};
