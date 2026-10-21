import{j as U}from"./jsx-runtime.D_zvdyIk.js";import{r as H}from"./index.DYn5FPbd.js";import{U as be,M as at,D as nt,u as De,a as qe,B as Ae,O as Se,F as q,b as ot,S as xe,V as Pe,W as lt,R as ht,L as Re,c as ct,E as ut,d as dt,e as Ee,f as _t,g as mt,C as pt,h as re}from"./react-three-fiber.esm.CIEGuc_U.js";import"./index.Bb8JjhAW.js";function ft(){return U.jsx(U.Fragment,{children:U.jsx("ambientLight",{intensity:1.2*Math.PI})})}var gt=`// #pragma glslify: cnoise3 = require(glsl-noise/classic/3d) 

// noise source from https://github.com/hughsk/glsl-noise/blob/master/periodic/3d.glsl

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}

//-------- start here ------------

mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 rotateY(vec3 v, float angle) { return rotation3dY(angle) * v; }

varying vec3 vNormal;
varying float displacement;
varying vec3 vPos;
varying float vDistort;

varying vec2 vUv;

uniform float uTime;
uniform float uSpeed;

uniform float uLoadingTime;

uniform float uNoiseDensity;
uniform float uNoiseStrength;

#define STANDARD
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
#ifdef USE_TANGENT
varying vec3 vTangent;
varying vec3 vBitangent;
#endif
#endif
#include <clipping_planes_pars_vertex>
#include <color_pars_vertex>
#include <common>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <morphtarget_pars_vertex>
#include <shadowmap_pars_vertex>
#include <skinning_pars_vertex>
#include <uv2_pars_vertex>
#include <uv_pars_vertex>

void main() {

  #include <beginnormal_vertex>
  #include <color_vertex>
  #include <defaultnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <uv2_vertex>
  #include <uv_vertex>
  #ifndef FLAT_SHADED
    vNormal = normalize(transformedNormal);
  #ifdef USE_TANGENT
    vTangent = normalize(transformedTangent);
    vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
  #endif
  #endif
  #include <begin_vertex>

  #include <clipping_planes_vertex>
  #include <displacementmap_vertex>
  #include <logdepthbuf_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>
  #include <skinning_vertex>
    vViewPosition = -mvPosition.xyz;
  #include <fog_vertex>
  #include <shadowmap_vertex>
  #include <worldpos_vertex>

  //-------- start vertex ------------
  vUv = uv;

  float t = uTime * uSpeed;
  // Create a sine wave from top to bottom of the sphere
  float distortion = 0.75 * cnoise(0.43 * position * uNoiseDensity + t);

  vec3 pos = position + normal * distortion * uNoiseStrength * uLoadingTime;
  vPos = pos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}
`,yt=`
#define STANDARD
#ifdef PHYSICAL
#define REFLECTIVITY
#define CLEARCOAT
#define TRANSMISSION
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef TRANSMISSION
uniform float transmission;
#endif
#ifdef REFLECTIVITY
uniform float reflectivity;
#endif
#ifdef CLEARCOAT
uniform float clearcoat;
uniform float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
uniform vec3 sheen;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
#ifdef USE_TANGENT
varying vec3 vTangent;
varying vec3 vBitangent;
#endif
#endif
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <color_pars_fragment>
#include <common>
#include <dithering_pars_fragment>
#include <emissivemap_pars_fragment>
#include <lightmap_pars_fragment>
#include <map_pars_fragment>
#include <packing>
#include <uv2_pars_fragment>
#include <uv_pars_fragment>
// #include <transmissionmap_pars_fragment>
#include <bsdfs>
#include <bumpmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <shadowmap_pars_fragment>
// include를 통해 가져온 값은 대부분 환경, 빛 등을 계산하기 위해서 기본 fragment
// shader의 값들을 받아왔습니다. 일단은 무시하셔도 됩니다.

varying vec3 vNormal;
varying float displacement;
varying vec3 vPos;
varying float vDistort;

uniform float uC1r;
uniform float uC1g;
uniform float uC1b;
uniform float uC2r;
uniform float uC2g;
uniform float uC2b;
uniform float uC3r;
uniform float uC3g;
uniform float uC3b;

varying vec3 color1;
varying vec3 color2;
varying vec3 color3;

// for npm package, need to add this manually
float linearToRelativeLuminance2( const in vec3 color ) {
    vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
    return dot( weights, color.rgb );
}

void main() {

  //-------- basic gradient ------------
  vec3 color1 = vec3(uC1r, uC1g, uC1b);
  vec3 color2 = vec3(uC2r, uC2g, uC2b);
  vec3 color3 = vec3(uC3r, uC3g, uC3b);
  float clearcoat = 1.0;
  float clearcoatRoughness = 0.5;

  #include <clipping_planes_fragment>

  vec4 diffuseColor = vec4(
      mix(mix(color1, color2, smoothstep(-3.0, 3.0, vPos.x)), color3, vPos.z),
      1);
  // diffuseColor는 오브젝트의 베이스 색상 (환경이나 빛이 고려되지 않은 본연의
  // 색)

  // mix(x, y, a): a를 축으로 했을 때 가장 낮은 값에서 x값의 영향력을 100%, 가장
  // 높은 값에서 y값의 영향력을 100%로 만든다. smoothstep(x, y, a): a축을
  // 기준으로 x를 최소값, y를 최대값으로 그 사이의 값을 쪼갠다. x와 y 사이를
  // 0-100 사이의 그라디언트처럼 단계별로 표현하고, x 미만의 값은 0, y 이상의
  // 값은 100으로 처리

  // 1. smoothstep(-3.0, 3.0,vPos.x)로 x축의 그라디언트가 표현 될 범위를 -3,
  // 3으로 정한다.
  // 2. mix(color1, color3, smoothstep(-3.0, 3.0,vPos.x))로 color1과 color3을
  // 위의 범위 안에서 그라디언트로 표현한다.
  // 예를 들어 color1이 노랑, color3이 파랑이라고 치면, x축 기준 -3부터 3까지
  // 노랑과 파랑 사이의 그라디언트가 나타나고, -3보다 작은 값에서는 계속 노랑,
  // 3보다 큰 값에서는 계속 파랑이 나타난다.
  // 3. mix()를 한 번 더 사용해서 위의 그라디언트와 color2를 z축 기준으로
  // 분배한다.

  //-------- materiality ------------
  ReflectedLight reflectedLight =
      ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
  vec3 totalEmissiveRadiance = emissive;

  #ifdef TRANSMISSION
    float totalTransmission = transmission;
  #endif
  #include <logdepthbuf_fragment>
  #include <map_fragment>
  #include <color_fragment>
  #include <alphamap_fragment>
  #include <alphatest_fragment>
  #include <roughnessmap_fragment>
  #include <metalnessmap_fragment>
  #include <normal_fragment_begin>
  #include <normal_fragment_maps>
  #include <clearcoat_normal_fragment_begin>
  #include <clearcoat_normal_fragment_maps>
  #include <emissivemap_fragment>
  // #include <transmissionmap_fragment>
  #include <lights_physical_fragment>
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
  #include <aomap_fragment>
    vec3 outgoingLight =
        reflectedLight.directDiffuse + reflectedLight.indirectDiffuse +
        reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    //위에서 정의한 diffuseColor에 환경이나 반사값들을 반영한 값.
  #ifdef TRANSMISSION
    diffuseColor.a *=
        mix(saturate(1. - totalTransmission +
                    linearToRelativeLuminance2(reflectedLight.directSpecular +
                                              reflectedLight.indirectSpecular)),
            1.0, metalness);
  #endif


  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <fog_fragment>
  #include <premultiplied_alpha_fragment>
  #include <dithering_fragment>


  gl_FragColor = vec4(outgoingLight, diffuseColor.a);
  // gl_FragColor가 fragment shader를 통해 나타나는 최종값으로, diffuseColor에서
  // 정의한 그라디언트 색상 위에 반사나 빛을 계산한 값을 최종값으로 정의.
  // gl_FragColor = vec4(mix(mix(color1, color3, smoothstep(-3.0, 3.0,vPos.x)),
  // color2, vNormal.z), 1.0); 위처럼 최종값을 그라디언트 값 자체를 넣으면 환경
  // 영향없는 그라디언트만 표현됨.
}
`;function vt({type:s}){return U.jsxs(U.Fragment,{children:[s==="plane"&&U.jsx("planeGeometry",{args:[10,10,1,192]}),s==="sphere"&&U.jsx("icosahedronGeometry",{args:[1,192/3]}),s==="waterPlane"&&U.jsx("planeGeometry",{args:[10,10,192,192]})]})}function Ct(s){let e=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(s);return e?{r:parseInt(e[1],16),g:parseInt(e[2],16),b:parseInt(e[3],16)}:null}function xt(s){let e=s.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);return e?{r:parseInt(e[1]),g:parseInt(e[2]),b:parseInt(e[3])}:null}function _e(s){if(s.startsWith("#"))return Ct(s);if(s.startsWith("rgb"))return xt(s);throw new Error("Invalid color format")}function V(s=0){return s/255}var Et=Object.create,Le=Object.defineProperty,Tt=Object.defineProperties,Ot=Object.getOwnPropertyDescriptor,bt=Object.getOwnPropertyDescriptors,Dt=Object.getOwnPropertyNames,he=Object.getOwnPropertySymbols,At=Object.getPrototypeOf,Ue=Object.prototype.hasOwnProperty,We=Object.prototype.propertyIsEnumerable,ze=(s,e,t)=>e in s?Le(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t,I=(s,e)=>{for(var t in e||(e={}))Ue.call(e,t)&&ze(s,t,e[t]);if(he)for(var t of he(e))We.call(e,t)&&ze(s,t,e[t]);return s},St=(s,e)=>Tt(s,bt(e)),Te=(s,e)=>{var t={};for(var i in s)Ue.call(s,i)&&e.indexOf(i)<0&&(t[i]=s[i]);if(s!=null&&he)for(var i of he(s))e.indexOf(i)<0&&We.call(s,i)&&(t[i]=s[i]);return t},se=(s,e)=>()=>(e||s((e={exports:{}}).exports,e),e.exports),Lt=(s,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let a of Dt(e))!Ue.call(s,a)&&a!==t&&Le(s,a,{get:()=>e[a],enumerable:!(i=Ot(e,a))||i.enumerable});return s},Ut=(s,e,t)=>(t=s!=null?Et(At(s)):{},Lt(!s||!s.__esModule?Le(t,"default",{value:s,enumerable:!0}):t,s)),wt=({uniforms:s,vertexShader:e,fragmentShader:t,onInit:i})=>{let a=H.useMemo(()=>{let o=Object.entries(s),u=s.colors,p=_e(u[0]),d=_e(u[1]),g=_e(u[2]),f={uC1r:{value:V(p?.r)},uC1g:{value:V(p?.g)},uC1b:{value:V(p?.b)},uC2r:{value:V(d?.r)},uC2g:{value:V(d?.g)},uC2b:{value:V(d?.b)},uC3r:{value:V(g?.r)},uC3g:{value:V(g?.g)},uC3b:{value:V(g?.b)}},C=o.reduce((y,[A,E])=>{let S=be.clone({[A]:{value:E}});return I(I({},y),S)},{}),b=new at({userData:C,metalness:.2,side:nt,onBeforeCompile:y=>{y.uniforms=I(I(I({},y.uniforms),C),f),y.vertexShader=e,y.fragmentShader=t}});return o.forEach(([y])=>Object.defineProperty(b,y,{get:()=>b.uniforms[y].value,set:A=>b.uniforms[y].value=A})),i&&i(b),b},[s,e,t,i]);return H.useEffect(()=>()=>{a.dispose()},[a]),De(({clock:o})=>{a.userData.uTime&&(a.userData.uTime.value=o.getElapsedTime())}),U.jsx("primitive",{attach:"material",object:a})};function Bt({positionX:s,positionY:e,positionZ:t,rotationX:i,rotationY:a,rotationZ:o,type:u,color1:p,color2:d,color3:g,uTime:f,uSpeed:C,uDensity:b,uStrength:y,uFrequency:A,uAmplitude:E}){return U.jsxs("mesh",{name:"shadergradient-mesh",position:[s,e,t],rotation:[i,a,o],children:[U.jsx(vt,{type:u}),U.jsx(wt,{uniforms:{colors:[p,d,g],uTime:f,uSpeed:C,uLoadingTime:1,uNoiseDensity:b,uNoiseStrength:y,uFrequency:A,uAmplitude:E,uIntensity:.5},vertexShader:gt,fragmentShader:yt,onInit:S=>{console.log("material (onInit)",S)}})]})}var ce=class{constructor(){this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}},Pt=new Se(-1,1,1,-1,0,1),we=new Ae;we.setAttribute("position",new q([-1,3,0,-1,-1,0,3,-1,0],3));we.setAttribute("uv",new q([0,2,0,0,2,0],2));var Rt=class{constructor(e){this._mesh=new qe(we,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Pt)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},zt=class extends ce{constructor(e,t,i,a,o){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=a,this.clearAlpha=o!==void 0?o:0,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new ot}render(e,t,i){let a=e.autoClear;e.autoClear=!1;let o,u;this.overrideMaterial!==void 0&&(u=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor&&(e.getClearColor(this._oldClearColor),o=e.getClearAlpha(),e.setClearColor(this.clearColor,this.clearAlpha)),this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor&&e.setClearColor(this._oldClearColor,o),this.overrideMaterial!==void 0&&(this.scene.overrideMaterial=u),e.autoClear=a}},Fe=class extends ce{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof xe?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=be.clone(e.uniforms),this.material=new xe({defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new Rt(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}},Me={uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`},Ie=class extends ce{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){let a=e.getContext(),o=e.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0);let u,p;this.inverse?(u=0,p=1):(u=1,p=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),o.buffers.stencil.setFunc(a.ALWAYS,u,4294967295),o.buffers.stencil.setClear(p),o.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(a.EQUAL,1,4294967295),o.buffers.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),o.buffers.stencil.setLocked(!0)}},Ft=class extends ce{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},Mt=class{constructor(e,t){if(this.renderer=e,t===void 0){let i={minFilter:Re,magFilter:Re,format:ht},a=e.getSize(new Pe);this._pixelRatio=e.getPixelRatio(),this._width=a.width,this._height=a.height,t=new lt(this._width*this._pixelRatio,this._height*this._pixelRatio,i),t.texture.name="EffectComposer.rt1"}else this._pixelRatio=1,this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],Me===void 0&&console.error("THREE.EffectComposer relies on CopyShader"),Fe===void 0&&console.error("THREE.EffectComposer relies on ShaderPass"),this.copyPass=new Fe(Me),this.clock=new ct}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());let t=this.renderer.getRenderTarget(),i=!1;for(let a=0,o=this.passes.length;a<o;a++){let u=this.passes[a];if(u.enabled!==!1){if(u.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(a),u.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),u.needsSwap){if(i){let p=this.renderer.getContext(),d=this.renderer.state.buffers.stencil;d.setFunc(p.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),d.setFunc(p.EQUAL,1,4294967295)}this.swapBuffers()}Ie!==void 0&&(u instanceof Ie?i=!0:u instanceof Ft&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Pe);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let i=this._width*this._pixelRatio,a=this._height*this._pixelRatio;this.renderTarget1.setSize(i,a),this.renderTarget2.setSize(i,a);for(let o=0;o<this.passes.length;o++)this.passes[o].setSize(i,a)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}};new Se(-1,1,1,-1,0,1);var Je=new Ae;Je.setAttribute("position",new q([-1,3,0,-1,-1,0,3,-1,0],3));Je.setAttribute("uv",new q([0,2,0,0,2,0],2));var Z={uniforms:{tDiffuse:{value:null},shape:{value:1},radius:{value:2},rotateR:{value:Math.PI/12*1},rotateG:{value:Math.PI/12*2},rotateB:{value:Math.PI/12*3},scatter:{value:1},width:{value:20},height:{value:20},blending:{value:1},blendingMode:{value:1},greyscale:{value:!1},disable:{value:!1}},vertexShader:`

		varying vec2 vUV;
		varying vec3 vPosition;

		void main() {

			vUV = uv;
			vPosition = position;

			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

		}`,fragmentShader:`

		#define SQRT2_MINUS_ONE 0.41421356
		#define SQRT2_HALF_MINUS_ONE 0.20710678
		#define PI2 6.28318531
		#define SHAPE_DOT 1
		#define SHAPE_ELLIPSE 2
		#define SHAPE_LINE 3
		#define SHAPE_SQUARE 4
		#define BLENDING_LINEAR 1
		#define BLENDING_MULTIPLY 2
		#define BLENDING_ADD 3
		#define BLENDING_LIGHTER 4
		#define BLENDING_DARKER 5
		uniform sampler2D tDiffuse;
		uniform float radius;
		uniform float rotateR;
		uniform float rotateG;
		uniform float rotateB;
		uniform float scatter;
		uniform float width;
		uniform float height;
		uniform int shape;
		uniform bool disable;
		uniform float blending;
		uniform int blendingMode;
		varying vec2 vUV;
		varying vec3 vPosition;
		uniform bool greyscale;
		const int samples = 8;

		float blend( float a, float b, float t ) {

		// linear blend
			return a * ( 1.0 - t ) + b * t;

		}

		float hypot( float x, float y ) {

		// vector magnitude
			return sqrt( x * x + y * y );

		}

		float rand( vec2 seed ){

		// get pseudo-random number
			return fract( sin( dot( seed.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );

		}

		float distanceToDotRadius( float channel, vec2 coord, vec2 normal, vec2 p, float angle, float rad_max ) {

		// apply shape-specific transforms
			float dist = hypot( coord.x - p.x, coord.y - p.y );
			float rad = channel;

			if ( shape == SHAPE_DOT ) {

				rad = pow( abs( rad ), 1.125 ) * rad_max;

			} else if ( shape == SHAPE_ELLIPSE ) {

				rad = pow( abs( rad ), 1.125 ) * rad_max;

				if ( dist != 0.0 ) {
					float dot_p = abs( ( p.x - coord.x ) / dist * normal.x + ( p.y - coord.y ) / dist * normal.y );
					dist = ( dist * ( 1.0 - SQRT2_HALF_MINUS_ONE ) ) + dot_p * dist * SQRT2_MINUS_ONE;
				}

			} else if ( shape == SHAPE_LINE ) {

				rad = pow( abs( rad ), 1.5) * rad_max;
				float dot_p = ( p.x - coord.x ) * normal.x + ( p.y - coord.y ) * normal.y;
				dist = hypot( normal.x * dot_p, normal.y * dot_p );

			} else if ( shape == SHAPE_SQUARE ) {

				float theta = atan( p.y - coord.y, p.x - coord.x ) - angle;
				float sin_t = abs( sin( theta ) );
				float cos_t = abs( cos( theta ) );
				rad = pow( abs( rad ), 1.4 );
				rad = rad_max * ( rad + ( ( sin_t > cos_t ) ? rad - sin_t * rad : rad - cos_t * rad ) );

			}

			return rad - dist;

		}

		struct Cell {

		// grid sample positions
			vec2 normal;
			vec2 p1;
			vec2 p2;
			vec2 p3;
			vec2 p4;
			float samp2;
			float samp1;
			float samp3;
			float samp4;

		};

		vec4 getSample( vec2 point ) {

		// multi-sampled point
			vec4 tex = texture2D( tDiffuse, vec2( point.x / width, point.y / height ) );
			float base = rand( vec2( floor( point.x ), floor( point.y ) ) ) * PI2;
			float step = PI2 / float( samples );
			// float dist = radius * 0.66;
			float dist = radius * 0.0;

			for ( int i = 0; i < samples; ++i ) {

				float r = base + step * float( i );
				vec2 coord = point + vec2( cos( r ) * dist, sin( r ) * dist );
				tex += texture2D( tDiffuse, vec2( coord.x / width, coord.y / height ) );

			}

			tex /= float( samples ) + 1.0;
			return tex;

		}

		float getDotColour( Cell c, vec2 p, int channel, float angle, float aa ) {

		// get colour for given point
			float dist_c_1, dist_c_2, dist_c_3, dist_c_4, res;

			if ( channel == 0 ) {

				c.samp1 = getSample( c.p1 ).r;
				c.samp2 = getSample( c.p2 ).r;
				c.samp3 = getSample( c.p3 ).r;
				c.samp4 = getSample( c.p4 ).r;

			} else if (channel == 1) {

				c.samp1 = getSample( c.p1 ).g;
				c.samp2 = getSample( c.p2 ).g;
				c.samp3 = getSample( c.p3 ).g;
				c.samp4 = getSample( c.p4 ).g;

			} else {

				c.samp1 = getSample( c.p1 ).b;
				c.samp3 = getSample( c.p3 ).b;
				c.samp2 = getSample( c.p2 ).b;
				c.samp4 = getSample( c.p4 ).b;

			}

			dist_c_1 = distanceToDotRadius( c.samp1, c.p1, c.normal, p, angle, radius );
			dist_c_2 = distanceToDotRadius( c.samp2, c.p2, c.normal, p, angle, radius );
			dist_c_3 = distanceToDotRadius( c.samp3, c.p3, c.normal, p, angle, radius );
			dist_c_4 = distanceToDotRadius( c.samp4, c.p4, c.normal, p, angle, radius );
			res = ( dist_c_1 > 0.0 ) ? clamp( dist_c_1 / aa, 0.0, 1.0 ) : 0.0;
			// res = 0.0;
			res += ( dist_c_2 > 0.0 ) ? clamp( dist_c_2 / aa, 0.0, 1.0 ) : 0.0;
			res += ( dist_c_3 > 0.0 ) ? clamp( dist_c_3 / aa, 0.0, 1.0 ) : 0.0;
			res += ( dist_c_4 > 0.0 ) ? clamp( dist_c_4 / aa, 0.0, 1.0 ) : 0.0;
			res = clamp( res, 0.0, 1.0 );

			return res;
			// return 2

		}

		Cell getReferenceCell( vec2 p, vec2 origin, float grid_angle, float step ) {

		// get containing cell
			Cell c;

		// calc grid
			vec2 n = vec2( cos( grid_angle ), sin( grid_angle ) );
			float threshold = step * 0.5;
			float dot_normal = n.x * ( p.x - origin.x ) + n.y * ( p.y - origin.y );
			float dot_line = -n.y * ( p.x - origin.x ) + n.x * ( p.y - origin.y );
			vec2 offset = vec2( n.x * dot_normal, n.y * dot_normal );
			float offset_normal = mod( hypot( offset.x, offset.y ), step );
			float normal_dir = ( dot_normal < 0.0 ) ? 1.0 : -1.0;
			float normal_scale = ( ( offset_normal < threshold ) ? -offset_normal : step - offset_normal ) * normal_dir;
			float offset_line = mod( hypot( ( p.x - offset.x ) - origin.x, ( p.y - offset.y ) - origin.y ), step );
			float line_dir = ( dot_line < 0.0 ) ? 1.0 : -1.0;
			float line_scale = ( ( offset_line < threshold ) ? -offset_line : step - offset_line ) * line_dir;

		// get closest corner
			c.normal = n;
			c.p1.x = p.x - n.x * normal_scale + n.y * line_scale;
			c.p1.y = p.y - n.y * normal_scale - n.x * line_scale;

		// scatter
			if ( scatter != 0.0 ) {

				float off_mag = scatter * threshold * 0.5;
				float off_angle = rand( vec2( floor( c.p1.x ), floor( c.p1.y ) ) ) * PI2;
				c.p1.x += cos( off_angle ) * off_mag;
				c.p1.y += sin( off_angle ) * off_mag;

			}

		// find corners
			float normal_step = normal_dir * ( ( offset_normal < threshold ) ? step : -step );
			float line_step = line_dir * ( ( offset_line < threshold ) ? step : -step );
			c.p2.x = c.p1.x - n.x * normal_step;
			c.p2.y = c.p1.y - n.y * normal_step;
			c.p3.x = c.p1.x + n.y * line_step;
			c.p3.y = c.p1.y - n.x * line_step;
			c.p4.x = c.p1.x - n.x * normal_step + n.y * line_step;
			c.p4.y = c.p1.y - n.y * normal_step - n.x * line_step;

			return c;

		}

		float blendColour( float a, float b, float t ) {

		// blend colours
			if ( blendingMode == BLENDING_LINEAR ) {
				return blend( a, b, 1.0 - t );
			} else if ( blendingMode == BLENDING_ADD ) {
				return blend( a, min( 1.0, a + b ), t );
			} else if ( blendingMode == BLENDING_MULTIPLY ) {
				return blend( a, max( 0.0, a * b ), t );
			} else if ( blendingMode == BLENDING_LIGHTER ) {
				return blend( a, max( a, b ), t );
			} else if ( blendingMode == BLENDING_DARKER ) {
				return blend( a, min( a, b ), t );
			} else {
				return blend( a, b, 1.0 - t );
			}

		}

		void main() {

			if ( ! disable ) {

		// setup
				vec2 p = vec2( vUV.x * width, vUV.y * height ) - vec2(vPosition.x, vPosition.y) * 3.0; // - position values to remove black borders.
				vec2 origin = vec2( 0, 0 );
				float aa = ( radius < 2.5 ) ? radius * 0.5 : 1.25;
				// float aa = 0.0;

		// get channel samples
				Cell cell_r = getReferenceCell( p, origin, rotateR, radius );
				Cell cell_g = getReferenceCell( p, origin, rotateG, radius );
				Cell cell_b = getReferenceCell( p, origin, rotateB, radius );
				float r = getDotColour( cell_r, p, 0, rotateR, aa );
				float g = getDotColour( cell_g, p, 1, rotateG, aa );
				float b = getDotColour( cell_b, p, 2, rotateB, aa );

		// blend with original
				vec4 colour = texture2D( tDiffuse, vUV );
				
				// add masking before blendColour
				if (colour.r == 0.0) {
					r = 0.0;
				} else {
					r = blendColour( r, colour.r, blending );
				}

				if (colour.g == 0.0) {
					g = 0.0;
				} else {
					g = blendColour( g, colour.g, blending );
				}

				if (colour.b == 0.0) {
					b = 0.0;
				} else {
					b = blendColour( b, colour.b, blending );
				}
				
				
				

				if ( greyscale ) {
					r = g = b = (r + b + g) / 3.0;
				}

				// add alpha channel to each r, g, b colors
				vec4 vR;
				vec4 vG;
				vec4 vB;
	
				// apply transparent to outside of mesh
				if (r == 0.0 && colour.r == 0.0) {
					vR = vec4( 0, 0, 0, 0 );
				} else {
					vR = vec4( r, 0, 0, 1 );
				}
	
				if (g == 0.0 && colour.g == 0.0) {
					vG = vec4( 0, 0, 0, 0 );
				} else {
					vG = vec4( 0, g, 0, 1 );
				}
	
				if (b == 0.0 && colour.b == 0.0) {
					vB = vec4( 0, 0, 0, 0 );
				} else {
					vB = vec4( 0, 0, b, 1 );
				}

				// gl_FragColor = vec4( r, g, b, 1.0 );
				gl_FragColor = vR + vG + vB;

			} else {

				gl_FragColor = texture2D( tDiffuse, vUV );

			}

		}`},It=class{constructor(){this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}},Nt=new Se(-1,1,1,-1,0,1),Be=new Ae;Be.setAttribute("position",new q([-1,3,0,-1,-1,0,3,-1,0],3));Be.setAttribute("uv",new q([0,2,0,0,2,0],2));var kt=class{constructor(e){this._mesh=new qe(Be,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Nt)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},P={SKIP:0,ADD:1,ALPHA:2,AVERAGE:3,COLOR_BURN:4,COLOR_DODGE:5,DARKEN:6,DIFFERENCE:7,EXCLUSION:8,LIGHTEN:9,MULTIPLY:10,DIVIDE:11,NEGATION:12,NORMAL:13,OVERLAY:14,REFLECT:15,SCREEN:16,SOFT_LIGHT:17,SUBTRACT:18},Ht=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return min(x + y, 1.0) * opacity + x * (1.0 - opacity);

}
`,Vt=`vec3 blend(const in vec3 x, const in vec3 y, const in float opacity) {

	return y * opacity + x * (1.0 - opacity);

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	float a = min(y.a, opacity);

	return vec4(blend(x.rgb, y.rgb, a), max(x.a, a));

}
`,Yt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return (x + y) * 0.5 * opacity + x * (1.0 - opacity);

}
`,jt=`float blend(const in float x, const in float y) {

	return (y == 0.0) ? y : max(1.0 - (1.0 - x) / y, 0.0);

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,$t=`float blend(const in float x, const in float y) {

	return (y == 1.0) ? y : min(x / (1.0 - y), 1.0);

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,Zt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return min(x, y) * opacity + x * (1.0 - opacity);

}
`,Gt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return abs(x - y) * opacity + x * (1.0 - opacity);

}
`,Kt=`float blend(const in float x, const in float y) {

	return (y > 0.0) ? min(x / y, 1.0) : 1.0;

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,Qt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return (x + y - 2.0 * x * y) * opacity + x * (1.0 - opacity);

}
`,Xt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return max(x, y) * opacity + x * (1.0 - opacity);

}
`,qt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return x * y * opacity + x * (1.0 - opacity);

}
`,Wt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return (1.0 - abs(1.0 - x - y)) * opacity + x * (1.0 - opacity);

}
`,Jt=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return y * opacity + x * (1.0 - opacity);

}
`,ei=`float blend(const in float x, const in float y) {

	return (x < 0.5) ? (2.0 * x * y) : (1.0 - 2.0 * (1.0 - x) * (1.0 - y));

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,ti=`float blend(const in float x, const in float y) {

	return (y == 1.0) ? y : min(x * x / (1.0 - y), 1.0);

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,ii=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return (1.0 - (1.0 - x) * (1.0 - y)) * opacity + x * (1.0 - opacity);

}
`,si=`float blend(const in float x, const in float y) {

	return (y < 0.5) ?
		(2.0 * x * y + x * x * (1.0 - 2.0 * y)) :
		(sqrt(x) * (2.0 * y - 1.0) + 2.0 * x * (1.0 - y));

}

vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	vec4 z = vec4(
		blend(x.r, y.r),
		blend(x.g, y.g),
		blend(x.b, y.b),
		blend(x.a, y.a)
	);

	return z * opacity + x * (1.0 - opacity);

}
`,ri=`vec4 blend(const in vec4 x, const in vec4 y, const in float opacity) {

	return max(x + y - 1.0, 0.0) * opacity + x * (1.0 - opacity);

}
`,ai=new Map([[P.SKIP,null],[P.ADD,Ht],[P.ALPHA,Vt],[P.AVERAGE,Yt],[P.COLOR_BURN,jt],[P.COLOR_DODGE,$t],[P.DARKEN,Zt],[P.DIFFERENCE,Gt],[P.EXCLUSION,Qt],[P.LIGHTEN,Xt],[P.MULTIPLY,qt],[P.DIVIDE,Kt],[P.NEGATION,Wt],[P.NORMAL,Jt],[P.OVERLAY,ei],[P.REFLECT,ti],[P.SCREEN,ii],[P.SOFT_LIGHT,si],[P.SUBTRACT,ri]]),ni=class extends ut{constructor(s,e=1){super(),this.blendFunction=s,this.opacity=new dt(e)}getBlendFunction(){return this.blendFunction}setBlendFunction(s){this.blendFunction=s,this.dispatchEvent({type:"change"})}getShaderCode(){return ai.get(this.blendFunction)}},oi=class extends It{constructor(s,e,t){super(),Z===void 0&&console.error("THREE.HalftonePass requires HalftoneShader"),this.uniforms=be.clone(Z.uniforms),this.material=new xe({uniforms:this.uniforms,fragmentShader:Z.fragmentShader,vertexShader:Z.vertexShader}),this.uniforms.width.value=s,this.uniforms.height.value=e,this.uniforms.disable.value=t.disable,this.fsQuad=new kt(this.material),this.blendMode=new ni(P.SCREEN),this.extensions=null}render(s,e,t){this.material.uniforms.tDiffuse.value=t.texture,this.renderToScreen?(s.setRenderTarget(null),this.fsQuad.render(s)):(s.setRenderTarget(e),this.clear&&s.clear(),this.fsQuad.render(s))}setSize(s,e){this.uniforms.width.value=s,this.uniforms.height.value=e}initialize(s,e,t){}addEventListener(){}getAttributes(){return this.attributes}getFragmentShader(){return Z.fragmentShader}getVertexShader(){return Z.vertexShader}update(s,e,t){}};function li({disable:s=!1}){let{gl:e,scene:t,camera:i,size:a}=Ee(),o=H.useMemo(()=>{let u=new Mt(e);u.addPass(new zt(t,i));let p={shape:1,radius:2,rotateR:Math.PI/12,rotateB:Math.PI/12*2,rotateG:Math.PI/12*3,scatter:1,blending:1,blendingMode:1,greyscale:!1,disable:s},d=new oi(a.width,a.height,p);return u.addPass(d),u},[e,t,i,a,s]);return H.useEffect(()=>o?.setSize(a.width,a.height),[o,a]),De((u,p)=>(e.autoClear=!0,void o.render(p)),1),U.jsx(U.Fragment,{})}function Ne(s){return s/180*Math.PI}function hi(s){return s.replace("http://localhost:3001/customize","").replace("https://shadergradient.co/customize","").replace("https://www.shadergradient.co/customize","")}var ci=(s,e)=>({dpr:s,camera:{fov:e},linear:!0,flat:!0,gl:{preserveDrawingBuffer:!0}}),ui=1,di=14,ke={zoom:1,distance:14},He={zoom:5,distance:14};function _i({type:s,cAzimuthAngle:e,cPolarAngle:t,cDistance:i,cameraZoom:a,zoomOut:o,enableTransition:u=!0}){let p=H.useRef();return De((d,g)=>p.current.update(g)),H.useEffect(()=>{let d=p.current;d?.rotateTo(Ne(e),Ne(t),u)},[p,e,t]),H.useEffect(()=>{let d=p.current;o?s==="sphere"?(d?.dollyTo(He.distance,u),d?.zoomTo(He.zoom,u)):(d?.dollyTo(ke.distance,u),d?.zoomTo(ke.zoom,u)):s==="sphere"?(d?.zoomTo(a,u),d?.dollyTo(di,u)):(d?.dollyTo(i,u),d?.zoomTo(ui,u))},[p,o,s,a,i]),p}var B={LEFT:1,RIGHT:2,MIDDLE:4},l=Object.freeze({NONE:0,ROTATE:1,TRUCK:2,OFFSET:4,DOLLY:8,ZOOM:16,TOUCH_ROTATE:32,TOUCH_TRUCK:64,TOUCH_OFFSET:128,TOUCH_DOLLY:256,TOUCH_ZOOM:512,TOUCH_DOLLY_TRUCK:1024,TOUCH_DOLLY_OFFSET:2048,TOUCH_DOLLY_ROTATE:4096,TOUCH_ZOOM_TRUCK:8192,TOUCH_ZOOM_OFFSET:16384,TOUCH_ZOOM_ROTATE:32768}),G={NONE:0,IN:1,OUT:-1};function j(s){return s.isPerspectiveCamera}function Y(s){return s.isOrthographicCamera}var K=Math.PI*2,Ve=Math.PI/2,et=1e-5,W=Math.PI/180;function M(s,e,t){return Math.max(e,Math.min(t,s))}function w(s,e=et){return Math.abs(s)<e}function L(s,e,t=et){return w(s-e,t)}function Ye(s,e){return Math.round(s/e)*e}function J(s){return isFinite(s)?s:s<0?-Number.MAX_VALUE:Number.MAX_VALUE}function ee(s){return Math.abs(s)<Number.MAX_VALUE?s:s*(1/0)}function ae(s,e,t,i,a=1/0,o){i=Math.max(1e-4,i);let u=2/i,p=u*o,d=1/(1+p+.48*p*p+.235*p*p*p),g=s-e,f=e,C=a*i;g=M(g,-C,C),e=s-g;let b=(t.value+u*g)*o;t.value=(t.value-u*b)*d;let y=e+(g+b)*d;return f-s>0==y>f&&(y=f,t.value=(y-f)/o),y}function je(s,e,t,i,a=1/0,o,u){i=Math.max(1e-4,i);let p=2/i,d=p*o,g=1/(1+d+.48*d*d+.235*d*d*d),f=e.x,C=e.y,b=e.z,y=s.x-f,A=s.y-C,E=s.z-b,S=f,m=C,r=b,n=a*i,h=n*n,c=y*y+A*A+E*E;if(c>h){let de=Math.sqrt(c);y=y/de*n,A=A/de*n,E=E/de*n}f=s.x-y,C=s.y-A,b=s.z-E;let _=(t.x+p*y)*o,T=(t.y+p*A)*o,v=(t.z+p*E)*o;t.x=(t.x-p*_)*g,t.y=(t.y-p*T)*g,t.z=(t.z-p*v)*g,u.x=f+(y+_)*g,u.y=C+(A+T)*g,u.z=b+(E+v)*g;let R=S-s.x,ue=m-s.y,tt=r-s.z,it=u.x-S,st=u.y-m,rt=u.z-r;return R*it+ue*st+tt*rt>0&&(u.x=S,u.y=m,u.z=r,t.x=(u.x-S)/o,t.y=(u.y-m)/o,t.z=(u.z-r)/o),u}function me(s,e){e.set(0,0),s.forEach(t=>{e.x+=t.clientX,e.y+=t.clientY}),e.x/=s.length,e.y/=s.length}function pe(s,e){return Y(s)?(console.warn(`${e} is not supported in OrthographicCamera`),!0):!1}var mi=class{constructor(){this._listeners={}}addEventListener(s,e){let t=this._listeners;t[s]===void 0&&(t[s]=[]),t[s].indexOf(e)===-1&&t[s].push(e)}hasEventListener(s,e){let t=this._listeners;return t[s]!==void 0&&t[s].indexOf(e)!==-1}removeEventListener(s,e){let t=this._listeners[s];if(t!==void 0){let i=t.indexOf(e);i!==-1&&t.splice(i,1)}}removeAllEventListeners(s){if(!s){this._listeners={};return}Array.isArray(this._listeners[s])&&(this._listeners[s].length=0)}dispatchEvent(s){let e=this._listeners[s.type];if(e!==void 0){s.target=this;let t=e.slice(0);for(let i=0,a=t.length;i<a;i++)t[i].call(this,s)}}},fe,pi="2.9.0",ne=1/8,fi=/Mac/.test((fe=globalThis?.navigator)===null||fe===void 0?void 0:fe.platform),x,$e,oe,ge,z,O,D,Q,te,N,k,$,Ze,Ge,F,ie,X,Ke,ye,Qe,ve,Ce,le,Xe=class Oe extends mi{static install(e){x=e.THREE,$e=Object.freeze(new x.Vector3(0,0,0)),oe=Object.freeze(new x.Vector3(0,1,0)),ge=Object.freeze(new x.Vector3(0,0,1)),z=new x.Vector2,O=new x.Vector3,D=new x.Vector3,Q=new x.Vector3,te=new x.Vector3,N=new x.Vector3,k=new x.Vector3,$=new x.Vector3,Ze=new x.Vector3,Ge=new x.Vector3,F=new x.Spherical,ie=new x.Spherical,X=new x.Box3,Ke=new x.Box3,ye=new x.Sphere,Qe=new x.Quaternion,ve=new x.Quaternion,Ce=new x.Matrix4,le=new x.Raycaster}static get ACTION(){return l}constructor(e,t){super(),this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.minDistance=Number.EPSILON,this.maxDistance=1/0,this.infinityDolly=!1,this.minZoom=.01,this.maxZoom=1/0,this.smoothTime=.25,this.draggingSmoothTime=.125,this.maxSpeed=1/0,this.azimuthRotateSpeed=1,this.polarRotateSpeed=1,this.dollySpeed=1,this.dollyDragInverted=!1,this.truckSpeed=2,this.dollyToCursor=!1,this.dragToOffset=!1,this.verticalDragToForward=!1,this.boundaryFriction=0,this.restThreshold=.01,this.colliderMeshes=[],this.cancel=()=>{},this._enabled=!0,this._state=l.NONE,this._viewport=null,this._changedDolly=0,this._changedZoom=0,this._hasRested=!0,this._boundaryEnclosesCamera=!1,this._needsUpdate=!0,this._updatedLastTime=!1,this._elementRect=new DOMRect,this._isDragging=!1,this._dragNeedsUpdate=!0,this._activePointers=[],this._lockedPointer=null,this._interactiveArea=new DOMRect(0,0,1,1),this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._isUserControllingOffset=!1,this._isUserControllingZoom=!1,this._lastDollyDirection=G.NONE,this._thetaVelocity={value:0},this._phiVelocity={value:0},this._radiusVelocity={value:0},this._targetVelocity=new x.Vector3,this._focalOffsetVelocity=new x.Vector3,this._zoomVelocity={value:0},this._truckInternal=(m,r,n)=>{let h,c;if(j(this._camera)){let _=O.copy(this._camera.position).sub(this._target),T=this._camera.getEffectiveFOV()*W,v=_.length()*Math.tan(T*.5);h=this.truckSpeed*m*v/this._elementRect.height,c=this.truckSpeed*r*v/this._elementRect.height}else if(Y(this._camera)){let _=this._camera;h=m*(_.right-_.left)/_.zoom/this._elementRect.width,c=r*(_.top-_.bottom)/_.zoom/this._elementRect.height}else return;this.verticalDragToForward?(n?this.setFocalOffset(this._focalOffsetEnd.x+h,this._focalOffsetEnd.y,this._focalOffsetEnd.z,!0):this.truck(h,0,!0),this.forward(-c,!0)):n?this.setFocalOffset(this._focalOffsetEnd.x+h,this._focalOffsetEnd.y+c,this._focalOffsetEnd.z,!0):this.truck(h,c,!0)},this._rotateInternal=(m,r)=>{let n=K*this.azimuthRotateSpeed*m/this._elementRect.height,h=K*this.polarRotateSpeed*r/this._elementRect.height;this.rotate(n,h,!0)},this._dollyInternal=(m,r,n)=>{let h=Math.pow(.95,-m*this.dollySpeed),c=this._sphericalEnd.radius,_=this._sphericalEnd.radius*h,T=M(_,this.minDistance,this.maxDistance),v=T-_;this.infinityDolly&&this.dollyToCursor?this._dollyToNoClamp(_,!0):this.infinityDolly&&!this.dollyToCursor?(this.dollyInFixed(v,!0),this._dollyToNoClamp(T,!0)):this._dollyToNoClamp(T,!0),this.dollyToCursor&&(this._changedDolly+=(this.infinityDolly?_:T)-c,this._dollyControlCoord.set(r,n)),this._lastDollyDirection=Math.sign(-m)},this._zoomInternal=(m,r,n)=>{let h=Math.pow(.95,m*this.dollySpeed),c=this._zoom,_=this._zoom*h;this.zoomTo(_,!0),this.dollyToCursor&&(this._changedZoom+=_-c,this._dollyControlCoord.set(r,n))},typeof x>"u"&&console.error("camera-controls: `THREE` is undefined. You must first run `CameraControls.install( { THREE: THREE } )`. Check the docs for further information."),this._camera=e,this._yAxisUpSpace=new x.Quaternion().setFromUnitVectors(this._camera.up,oe),this._yAxisUpSpaceInverse=this._yAxisUpSpace.clone().invert(),this._state=l.NONE,this._target=new x.Vector3,this._targetEnd=this._target.clone(),this._focalOffset=new x.Vector3,this._focalOffsetEnd=this._focalOffset.clone(),this._spherical=new x.Spherical().setFromVector3(O.copy(this._camera.position).applyQuaternion(this._yAxisUpSpace)),this._sphericalEnd=this._spherical.clone(),this._lastDistance=this._spherical.radius,this._zoom=this._camera.zoom,this._zoomEnd=this._zoom,this._lastZoom=this._zoom,this._nearPlaneCorners=[new x.Vector3,new x.Vector3,new x.Vector3,new x.Vector3],this._updateNearPlaneCorners(),this._boundary=new x.Box3(new x.Vector3(-1/0,-1/0,-1/0),new x.Vector3(1/0,1/0,1/0)),this._cameraUp0=this._camera.up.clone(),this._target0=this._target.clone(),this._position0=this._camera.position.clone(),this._zoom0=this._zoom,this._focalOffset0=this._focalOffset.clone(),this._dollyControlCoord=new x.Vector2,this.mouseButtons={left:l.ROTATE,middle:l.DOLLY,right:l.TRUCK,wheel:j(this._camera)?l.DOLLY:Y(this._camera)?l.ZOOM:l.NONE},this.touches={one:l.TOUCH_ROTATE,two:j(this._camera)?l.TOUCH_DOLLY_TRUCK:Y(this._camera)?l.TOUCH_ZOOM_TRUCK:l.NONE,three:l.TOUCH_TRUCK};let i=new x.Vector2,a=new x.Vector2,o=new x.Vector2,u=m=>{if(!this._enabled||!this._domElement)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let h=this._domElement.getBoundingClientRect(),c=m.clientX/h.width,_=m.clientY/h.height;if(c<this._interactiveArea.left||c>this._interactiveArea.right||_<this._interactiveArea.top||_>this._interactiveArea.bottom)return}let r=m.pointerType!=="mouse"?null:(m.buttons&B.LEFT)===B.LEFT?B.LEFT:(m.buttons&B.MIDDLE)===B.MIDDLE?B.MIDDLE:(m.buttons&B.RIGHT)===B.RIGHT?B.RIGHT:null;if(r!==null){let h=this._findPointerByMouseButton(r);h&&this._disposePointer(h)}if((m.buttons&B.LEFT)===B.LEFT&&this._lockedPointer)return;let n={pointerId:m.pointerId,clientX:m.clientX,clientY:m.clientY,deltaX:0,deltaY:0,mouseButton:r};this._activePointers.push(n),this._domElement.ownerDocument.removeEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.ownerDocument.addEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",d),this._isDragging=!0,b(m)},p=m=>{m.cancelable&&m.preventDefault();let r=m.pointerId,n=this._lockedPointer||this._findPointerById(r);if(n){if(n.clientX=m.clientX,n.clientY=m.clientY,n.deltaX=m.movementX,n.deltaY=m.movementY,this._state=0,m.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else(!this._isDragging&&this._lockedPointer||this._isDragging&&(m.buttons&B.LEFT)===B.LEFT)&&(this._state=this._state|this.mouseButtons.left),this._isDragging&&(m.buttons&B.MIDDLE)===B.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),this._isDragging&&(m.buttons&B.RIGHT)===B.RIGHT&&(this._state=this._state|this.mouseButtons.right);y()}},d=m=>{let r=this._findPointerById(m.pointerId);if(!(r&&r===this._lockedPointer)){if(r&&this._disposePointer(r),m.pointerType==="touch")switch(this._activePointers.length){case 0:this._state=l.NONE;break;case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else this._state=l.NONE;A()}},g=-1,f=m=>{if(!this._domElement||!this._enabled||this.mouseButtons.wheel===l.NONE)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let _=this._domElement.getBoundingClientRect(),T=m.clientX/_.width,v=m.clientY/_.height;if(T<this._interactiveArea.left||T>this._interactiveArea.right||v<this._interactiveArea.top||v>this._interactiveArea.bottom)return}if(m.preventDefault(),this.dollyToCursor||this.mouseButtons.wheel===l.ROTATE||this.mouseButtons.wheel===l.TRUCK){let _=performance.now();g-_<1e3&&this._getClientRect(this._elementRect),g=_}let r=fi?-1:-3,n=m.deltaMode===1?m.deltaY/r:m.deltaY/(r*10),h=this.dollyToCursor?(m.clientX-this._elementRect.x)/this._elementRect.width*2-1:0,c=this.dollyToCursor?(m.clientY-this._elementRect.y)/this._elementRect.height*-2+1:0;switch(this.mouseButtons.wheel){case l.ROTATE:{this._rotateInternal(m.deltaX,m.deltaY),this._isUserControllingRotate=!0;break}case l.TRUCK:{this._truckInternal(m.deltaX,m.deltaY,!1),this._isUserControllingTruck=!0;break}case l.OFFSET:{this._truckInternal(m.deltaX,m.deltaY,!0),this._isUserControllingOffset=!0;break}case l.DOLLY:{this._dollyInternal(-n,h,c),this._isUserControllingDolly=!0;break}case l.ZOOM:{this._zoomInternal(-n,h,c),this._isUserControllingZoom=!0;break}}this.dispatchEvent({type:"control"})},C=m=>{if(!(!this._domElement||!this._enabled)){if(this.mouseButtons.right===Oe.ACTION.NONE){let r=m instanceof PointerEvent?m.pointerId:0,n=this._findPointerById(r);n&&this._disposePointer(n),this._domElement.ownerDocument.removeEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d);return}m.preventDefault()}},b=m=>{if(this._enabled){if(me(this._activePointers,z),this._getClientRect(this._elementRect),i.copy(z),a.copy(z),this._activePointers.length>=2){let r=z.x-this._activePointers[1].clientX,n=z.y-this._activePointers[1].clientY,h=Math.sqrt(r*r+n*n);o.set(0,h);let c=(this._activePointers[0].clientX+this._activePointers[1].clientX)*.5,_=(this._activePointers[0].clientY+this._activePointers[1].clientY)*.5;a.set(c,_)}if(this._state=0,!m)this._lockedPointer&&(this._state=this._state|this.mouseButtons.left);else if("pointerType"in m&&m.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else!this._lockedPointer&&(m.buttons&B.LEFT)===B.LEFT&&(this._state=this._state|this.mouseButtons.left),(m.buttons&B.MIDDLE)===B.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),(m.buttons&B.RIGHT)===B.RIGHT&&(this._state=this._state|this.mouseButtons.right);((this._state&l.ROTATE)===l.ROTATE||(this._state&l.TOUCH_ROTATE)===l.TOUCH_ROTATE||(this._state&l.TOUCH_DOLLY_ROTATE)===l.TOUCH_DOLLY_ROTATE||(this._state&l.TOUCH_ZOOM_ROTATE)===l.TOUCH_ZOOM_ROTATE)&&(this._sphericalEnd.theta=this._spherical.theta,this._sphericalEnd.phi=this._spherical.phi,this._thetaVelocity.value=0,this._phiVelocity.value=0),((this._state&l.TRUCK)===l.TRUCK||(this._state&l.TOUCH_TRUCK)===l.TOUCH_TRUCK||(this._state&l.TOUCH_DOLLY_TRUCK)===l.TOUCH_DOLLY_TRUCK||(this._state&l.TOUCH_ZOOM_TRUCK)===l.TOUCH_ZOOM_TRUCK)&&(this._targetEnd.copy(this._target),this._targetVelocity.set(0,0,0)),((this._state&l.DOLLY)===l.DOLLY||(this._state&l.TOUCH_DOLLY)===l.TOUCH_DOLLY||(this._state&l.TOUCH_DOLLY_TRUCK)===l.TOUCH_DOLLY_TRUCK||(this._state&l.TOUCH_DOLLY_OFFSET)===l.TOUCH_DOLLY_OFFSET||(this._state&l.TOUCH_DOLLY_ROTATE)===l.TOUCH_DOLLY_ROTATE)&&(this._sphericalEnd.radius=this._spherical.radius,this._radiusVelocity.value=0),((this._state&l.ZOOM)===l.ZOOM||(this._state&l.TOUCH_ZOOM)===l.TOUCH_ZOOM||(this._state&l.TOUCH_ZOOM_TRUCK)===l.TOUCH_ZOOM_TRUCK||(this._state&l.TOUCH_ZOOM_OFFSET)===l.TOUCH_ZOOM_OFFSET||(this._state&l.TOUCH_ZOOM_ROTATE)===l.TOUCH_ZOOM_ROTATE)&&(this._zoomEnd=this._zoom,this._zoomVelocity.value=0),((this._state&l.OFFSET)===l.OFFSET||(this._state&l.TOUCH_OFFSET)===l.TOUCH_OFFSET||(this._state&l.TOUCH_DOLLY_OFFSET)===l.TOUCH_DOLLY_OFFSET||(this._state&l.TOUCH_ZOOM_OFFSET)===l.TOUCH_ZOOM_OFFSET)&&(this._focalOffsetEnd.copy(this._focalOffset),this._focalOffsetVelocity.set(0,0,0)),this.dispatchEvent({type:"controlstart"})}},y=()=>{if(!this._enabled||!this._dragNeedsUpdate)return;this._dragNeedsUpdate=!1,me(this._activePointers,z);let m=this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement?this._lockedPointer||this._activePointers[0]:null,r=m?-m.deltaX:a.x-z.x,n=m?-m.deltaY:a.y-z.y;if(a.copy(z),((this._state&l.ROTATE)===l.ROTATE||(this._state&l.TOUCH_ROTATE)===l.TOUCH_ROTATE||(this._state&l.TOUCH_DOLLY_ROTATE)===l.TOUCH_DOLLY_ROTATE||(this._state&l.TOUCH_ZOOM_ROTATE)===l.TOUCH_ZOOM_ROTATE)&&(this._rotateInternal(r,n),this._isUserControllingRotate=!0),(this._state&l.DOLLY)===l.DOLLY||(this._state&l.ZOOM)===l.ZOOM){let h=this.dollyToCursor?(i.x-this._elementRect.x)/this._elementRect.width*2-1:0,c=this.dollyToCursor?(i.y-this._elementRect.y)/this._elementRect.height*-2+1:0,_=this.dollyDragInverted?-1:1;(this._state&l.DOLLY)===l.DOLLY?(this._dollyInternal(_*n*ne,h,c),this._isUserControllingDolly=!0):(this._zoomInternal(_*n*ne,h,c),this._isUserControllingZoom=!0)}if((this._state&l.TOUCH_DOLLY)===l.TOUCH_DOLLY||(this._state&l.TOUCH_ZOOM)===l.TOUCH_ZOOM||(this._state&l.TOUCH_DOLLY_TRUCK)===l.TOUCH_DOLLY_TRUCK||(this._state&l.TOUCH_ZOOM_TRUCK)===l.TOUCH_ZOOM_TRUCK||(this._state&l.TOUCH_DOLLY_OFFSET)===l.TOUCH_DOLLY_OFFSET||(this._state&l.TOUCH_ZOOM_OFFSET)===l.TOUCH_ZOOM_OFFSET||(this._state&l.TOUCH_DOLLY_ROTATE)===l.TOUCH_DOLLY_ROTATE||(this._state&l.TOUCH_ZOOM_ROTATE)===l.TOUCH_ZOOM_ROTATE){let h=z.x-this._activePointers[1].clientX,c=z.y-this._activePointers[1].clientY,_=Math.sqrt(h*h+c*c),T=o.y-_;o.set(0,_);let v=this.dollyToCursor?(a.x-this._elementRect.x)/this._elementRect.width*2-1:0,R=this.dollyToCursor?(a.y-this._elementRect.y)/this._elementRect.height*-2+1:0;(this._state&l.TOUCH_DOLLY)===l.TOUCH_DOLLY||(this._state&l.TOUCH_DOLLY_ROTATE)===l.TOUCH_DOLLY_ROTATE||(this._state&l.TOUCH_DOLLY_TRUCK)===l.TOUCH_DOLLY_TRUCK||(this._state&l.TOUCH_DOLLY_OFFSET)===l.TOUCH_DOLLY_OFFSET?(this._dollyInternal(T*ne,v,R),this._isUserControllingDolly=!0):(this._zoomInternal(T*ne,v,R),this._isUserControllingZoom=!0)}((this._state&l.TRUCK)===l.TRUCK||(this._state&l.TOUCH_TRUCK)===l.TOUCH_TRUCK||(this._state&l.TOUCH_DOLLY_TRUCK)===l.TOUCH_DOLLY_TRUCK||(this._state&l.TOUCH_ZOOM_TRUCK)===l.TOUCH_ZOOM_TRUCK)&&(this._truckInternal(r,n,!1),this._isUserControllingTruck=!0),((this._state&l.OFFSET)===l.OFFSET||(this._state&l.TOUCH_OFFSET)===l.TOUCH_OFFSET||(this._state&l.TOUCH_DOLLY_OFFSET)===l.TOUCH_DOLLY_OFFSET||(this._state&l.TOUCH_ZOOM_OFFSET)===l.TOUCH_ZOOM_OFFSET)&&(this._truckInternal(r,n,!0),this._isUserControllingOffset=!0),this.dispatchEvent({type:"control"})},A=()=>{me(this._activePointers,z),a.copy(z),this._dragNeedsUpdate=!1,(this._activePointers.length===0||this._activePointers.length===1&&this._activePointers[0]===this._lockedPointer)&&(this._isDragging=!1),this._activePointers.length===0&&this._domElement&&(this._domElement.ownerDocument.removeEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this.dispatchEvent({type:"controlend"}))};this.lockPointer=()=>{!this._enabled||!this._domElement||(this.cancel(),this._lockedPointer={pointerId:-1,clientX:0,clientY:0,deltaX:0,deltaY:0,mouseButton:null},this._activePointers.push(this._lockedPointer),this._domElement.ownerDocument.removeEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.requestPointerLock(),this._domElement.ownerDocument.addEventListener("pointerlockchange",E),this._domElement.ownerDocument.addEventListener("pointerlockerror",S),this._domElement.ownerDocument.addEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",d),b())},this.unlockPointer=()=>{var m,r,n;this._lockedPointer!==null&&(this._disposePointer(this._lockedPointer),this._lockedPointer=null),(m=this._domElement)===null||m===void 0||m.ownerDocument.exitPointerLock(),(r=this._domElement)===null||r===void 0||r.ownerDocument.removeEventListener("pointerlockchange",E),(n=this._domElement)===null||n===void 0||n.ownerDocument.removeEventListener("pointerlockerror",S),this.cancel()};let E=()=>{this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement||this.unlockPointer()},S=()=>{this.unlockPointer()};this._addAllEventListeners=m=>{this._domElement=m,this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none",this._domElement.addEventListener("pointerdown",u),this._domElement.addEventListener("pointercancel",d),this._domElement.addEventListener("wheel",f,{passive:!1}),this._domElement.addEventListener("contextmenu",C)},this._removeAllEventListeners=()=>{this._domElement&&(this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect="",this._domElement.removeEventListener("pointerdown",u),this._domElement.removeEventListener("pointercancel",d),this._domElement.removeEventListener("wheel",f,{passive:!1}),this._domElement.removeEventListener("contextmenu",C),this._domElement.ownerDocument.removeEventListener("pointermove",p,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.ownerDocument.removeEventListener("pointerlockchange",E),this._domElement.ownerDocument.removeEventListener("pointerlockerror",S))},this.cancel=()=>{this._state!==l.NONE&&(this._state=l.NONE,this._activePointers.length=0,A())},t&&this.connect(t),this.update(0)}get camera(){return this._camera}set camera(e){this._camera=e,this.updateCameraUp(),this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0}get enabled(){return this._enabled}set enabled(e){this._enabled=e,this._domElement&&(e?(this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none"):(this.cancel(),this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect=""))}get active(){return!this._hasRested}get currentAction(){return this._state}get distance(){return this._spherical.radius}set distance(e){this._spherical.radius===e&&this._sphericalEnd.radius===e||(this._spherical.radius=e,this._sphericalEnd.radius=e,this._needsUpdate=!0)}get azimuthAngle(){return this._spherical.theta}set azimuthAngle(e){this._spherical.theta===e&&this._sphericalEnd.theta===e||(this._spherical.theta=e,this._sphericalEnd.theta=e,this._needsUpdate=!0)}get polarAngle(){return this._spherical.phi}set polarAngle(e){this._spherical.phi===e&&this._sphericalEnd.phi===e||(this._spherical.phi=e,this._sphericalEnd.phi=e,this._needsUpdate=!0)}get boundaryEnclosesCamera(){return this._boundaryEnclosesCamera}set boundaryEnclosesCamera(e){this._boundaryEnclosesCamera=e,this._needsUpdate=!0}set interactiveArea(e){this._interactiveArea.width=M(e.width,0,1),this._interactiveArea.height=M(e.height,0,1),this._interactiveArea.x=M(e.x,0,1-this._interactiveArea.width),this._interactiveArea.y=M(e.y,0,1-this._interactiveArea.height)}addEventListener(e,t){super.addEventListener(e,t)}removeEventListener(e,t){super.removeEventListener(e,t)}rotate(e,t,i=!1){return this.rotateTo(this._sphericalEnd.theta+e,this._sphericalEnd.phi+t,i)}rotateAzimuthTo(e,t=!1){return this.rotateTo(e,this._sphericalEnd.phi,t)}rotatePolarTo(e,t=!1){return this.rotateTo(this._sphericalEnd.theta,e,t)}rotateTo(e,t,i=!1){this._isUserControllingRotate=!1;let a=M(e,this.minAzimuthAngle,this.maxAzimuthAngle),o=M(t,this.minPolarAngle,this.maxPolarAngle);this._sphericalEnd.theta=a,this._sphericalEnd.phi=o,this._sphericalEnd.makeSafe(),this._needsUpdate=!0,i||(this._spherical.theta=this._sphericalEnd.theta,this._spherical.phi=this._sphericalEnd.phi);let u=!i||L(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&L(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold);return this._createOnRestPromise(u)}dolly(e,t=!1){return this.dollyTo(this._sphericalEnd.radius-e,t)}dollyTo(e,t=!1){return this._isUserControllingDolly=!1,this._lastDollyDirection=G.NONE,this._changedDolly=0,this._dollyToNoClamp(M(e,this.minDistance,this.maxDistance),t)}_dollyToNoClamp(e,t=!1){let i=this._sphericalEnd.radius;if(this.colliderMeshes.length>=1){let o=this._collisionTest(),u=L(o,this._spherical.radius);if(!(i>e)&&u)return Promise.resolve();this._sphericalEnd.radius=Math.min(e,o)}else this._sphericalEnd.radius=e;this._needsUpdate=!0,t||(this._spherical.radius=this._sphericalEnd.radius);let a=!t||L(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(a)}dollyInFixed(e,t=!1){this._targetEnd.add(this._getCameraDirection(te).multiplyScalar(e)),t||this._target.copy(this._targetEnd);let i=!t||L(this._target.x,this._targetEnd.x,this.restThreshold)&&L(this._target.y,this._targetEnd.y,this.restThreshold)&&L(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(i)}zoom(e,t=!1){return this.zoomTo(this._zoomEnd+e,t)}zoomTo(e,t=!1){this._isUserControllingZoom=!1,this._zoomEnd=M(e,this.minZoom,this.maxZoom),this._needsUpdate=!0,t||(this._zoom=this._zoomEnd);let i=!t||L(this._zoom,this._zoomEnd,this.restThreshold);return this._changedZoom=0,this._createOnRestPromise(i)}pan(e,t,i=!1){return console.warn("`pan` has been renamed to `truck`"),this.truck(e,t,i)}truck(e,t,i=!1){this._camera.updateMatrix(),N.setFromMatrixColumn(this._camera.matrix,0),k.setFromMatrixColumn(this._camera.matrix,1),N.multiplyScalar(e),k.multiplyScalar(-t);let a=O.copy(N).add(k),o=D.copy(this._targetEnd).add(a);return this.moveTo(o.x,o.y,o.z,i)}forward(e,t=!1){O.setFromMatrixColumn(this._camera.matrix,0),O.crossVectors(this._camera.up,O),O.multiplyScalar(e);let i=D.copy(this._targetEnd).add(O);return this.moveTo(i.x,i.y,i.z,t)}elevate(e,t=!1){return O.copy(this._camera.up).multiplyScalar(e),this.moveTo(this._targetEnd.x+O.x,this._targetEnd.y+O.y,this._targetEnd.z+O.z,t)}moveTo(e,t,i,a=!1){this._isUserControllingTruck=!1;let o=O.set(e,t,i).sub(this._targetEnd);this._encloseToBoundary(this._targetEnd,o,this.boundaryFriction),this._needsUpdate=!0,a||this._target.copy(this._targetEnd);let u=!a||L(this._target.x,this._targetEnd.x,this.restThreshold)&&L(this._target.y,this._targetEnd.y,this.restThreshold)&&L(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(u)}lookInDirectionOf(e,t,i,a=!1){let o=O.set(e,t,i).sub(this._targetEnd).normalize().multiplyScalar(-this._sphericalEnd.radius).add(this._targetEnd);return this.setPosition(o.x,o.y,o.z,a)}fitToBox(e,t,{cover:i=!1,paddingLeft:a=0,paddingRight:o=0,paddingBottom:u=0,paddingTop:p=0}={}){let d=[],g=e.isBox3?X.copy(e):X.setFromObject(e);g.isEmpty()&&(console.warn("camera-controls: fitTo() cannot be used with an empty box. Aborting"),Promise.resolve());let f=Ye(this._sphericalEnd.theta,Ve),C=Ye(this._sphericalEnd.phi,Ve);d.push(this.rotateTo(f,C,t));let b=O.setFromSpherical(this._sphericalEnd).normalize(),y=Qe.setFromUnitVectors(b,ge),A=L(Math.abs(b.y),1);A&&y.multiply(ve.setFromAxisAngle(oe,f)),y.multiply(this._yAxisUpSpaceInverse);let E=Ke.makeEmpty();D.copy(g.min).applyQuaternion(y),E.expandByPoint(D),D.copy(g.min).setX(g.max.x).applyQuaternion(y),E.expandByPoint(D),D.copy(g.min).setY(g.max.y).applyQuaternion(y),E.expandByPoint(D),D.copy(g.max).setZ(g.min.z).applyQuaternion(y),E.expandByPoint(D),D.copy(g.min).setZ(g.max.z).applyQuaternion(y),E.expandByPoint(D),D.copy(g.max).setY(g.min.y).applyQuaternion(y),E.expandByPoint(D),D.copy(g.max).setX(g.min.x).applyQuaternion(y),E.expandByPoint(D),D.copy(g.max).applyQuaternion(y),E.expandByPoint(D),E.min.x-=a,E.min.y-=u,E.max.x+=o,E.max.y+=p,y.setFromUnitVectors(ge,b),A&&y.premultiply(ve.invert()),y.premultiply(this._yAxisUpSpace);let S=E.getSize(O),m=E.getCenter(D).applyQuaternion(y);if(j(this._camera)){let r=this.getDistanceToFitBox(S.x,S.y,S.z,i);d.push(this.moveTo(m.x,m.y,m.z,t)),d.push(this.dollyTo(r,t)),d.push(this.setFocalOffset(0,0,0,t))}else if(Y(this._camera)){let r=this._camera,n=r.right-r.left,h=r.top-r.bottom,c=i?Math.max(n/S.x,h/S.y):Math.min(n/S.x,h/S.y);d.push(this.moveTo(m.x,m.y,m.z,t)),d.push(this.zoomTo(c,t)),d.push(this.setFocalOffset(0,0,0,t))}return Promise.all(d)}fitToSphere(e,t){let i=[],a="isObject3D"in e?Oe.createBoundingSphere(e,ye):ye.copy(e);if(i.push(this.moveTo(a.center.x,a.center.y,a.center.z,t)),j(this._camera)){let o=this.getDistanceToFitSphere(a.radius);i.push(this.dollyTo(o,t))}else if(Y(this._camera)){let o=this._camera.right-this._camera.left,u=this._camera.top-this._camera.bottom,p=2*a.radius,d=Math.min(o/p,u/p);i.push(this.zoomTo(d,t))}return i.push(this.setFocalOffset(0,0,0,t)),Promise.all(i)}setLookAt(e,t,i,a,o,u,p=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=G.NONE,this._changedDolly=0;let d=D.set(a,o,u),g=O.set(e,t,i);this._targetEnd.copy(d),this._sphericalEnd.setFromVector3(g.sub(d).applyQuaternion(this._yAxisUpSpace)),this.normalizeRotations(),this._needsUpdate=!0,p||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let f=!p||L(this._target.x,this._targetEnd.x,this.restThreshold)&&L(this._target.y,this._targetEnd.y,this.restThreshold)&&L(this._target.z,this._targetEnd.z,this.restThreshold)&&L(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&L(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&L(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(f)}lerpLookAt(e,t,i,a,o,u,p,d,g,f,C,b,y,A=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=G.NONE,this._changedDolly=0;let E=O.set(a,o,u),S=D.set(e,t,i);F.setFromVector3(S.sub(E).applyQuaternion(this._yAxisUpSpace));let m=Q.set(f,C,b),r=D.set(p,d,g);ie.setFromVector3(r.sub(m).applyQuaternion(this._yAxisUpSpace)),this._targetEnd.copy(E.lerp(m,y));let n=ie.theta-F.theta,h=ie.phi-F.phi,c=ie.radius-F.radius;this._sphericalEnd.set(F.radius+c*y,F.phi+h*y,F.theta+n*y),this.normalizeRotations(),this._needsUpdate=!0,A||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let _=!A||L(this._target.x,this._targetEnd.x,this.restThreshold)&&L(this._target.y,this._targetEnd.y,this.restThreshold)&&L(this._target.z,this._targetEnd.z,this.restThreshold)&&L(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&L(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&L(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(_)}setPosition(e,t,i,a=!1){return this.setLookAt(e,t,i,this._targetEnd.x,this._targetEnd.y,this._targetEnd.z,a)}setTarget(e,t,i,a=!1){let o=this.getPosition(O),u=this.setLookAt(o.x,o.y,o.z,e,t,i,a);return this._sphericalEnd.phi=M(this._sphericalEnd.phi,this.minPolarAngle,this.maxPolarAngle),u}setFocalOffset(e,t,i,a=!1){this._isUserControllingOffset=!1,this._focalOffsetEnd.set(e,t,i),this._needsUpdate=!0,a||this._focalOffset.copy(this._focalOffsetEnd);let o=!a||L(this._focalOffset.x,this._focalOffsetEnd.x,this.restThreshold)&&L(this._focalOffset.y,this._focalOffsetEnd.y,this.restThreshold)&&L(this._focalOffset.z,this._focalOffsetEnd.z,this.restThreshold);return this._createOnRestPromise(o)}setOrbitPoint(e,t,i){this._camera.updateMatrixWorld(),N.setFromMatrixColumn(this._camera.matrixWorldInverse,0),k.setFromMatrixColumn(this._camera.matrixWorldInverse,1),$.setFromMatrixColumn(this._camera.matrixWorldInverse,2);let a=O.set(e,t,i),o=a.distanceTo(this._camera.position),u=a.sub(this._camera.position);N.multiplyScalar(u.x),k.multiplyScalar(u.y),$.multiplyScalar(u.z),O.copy(N).add(k).add($),O.z=O.z+o,this.dollyTo(o,!1),this.setFocalOffset(-O.x,O.y,-O.z,!1),this.moveTo(e,t,i,!1)}setBoundary(e){if(!e){this._boundary.min.set(-1/0,-1/0,-1/0),this._boundary.max.set(1/0,1/0,1/0),this._needsUpdate=!0;return}this._boundary.copy(e),this._boundary.clampPoint(this._targetEnd,this._targetEnd),this._needsUpdate=!0}setViewport(e,t,i,a){if(e===null){this._viewport=null;return}this._viewport=this._viewport||new x.Vector4,typeof e=="number"?this._viewport.set(e,t,i,a):this._viewport.copy(e)}getDistanceToFitBox(e,t,i,a=!1){if(pe(this._camera,"getDistanceToFitBox"))return this._spherical.radius;let o=e/t,u=this._camera.getEffectiveFOV()*W,p=this._camera.aspect;return((a?o>p:o<p)?t:e/p)*.5/Math.tan(u*.5)+i*.5}getDistanceToFitSphere(e){if(pe(this._camera,"getDistanceToFitSphere"))return this._spherical.radius;let t=this._camera.getEffectiveFOV()*W,i=Math.atan(Math.tan(t*.5)*this._camera.aspect)*2,a=1<this._camera.aspect?t:i;return e/Math.sin(a*.5)}getTarget(e,t=!0){return(e&&e.isVector3?e:new x.Vector3).copy(t?this._targetEnd:this._target)}getPosition(e,t=!0){return(e&&e.isVector3?e:new x.Vector3).setFromSpherical(t?this._sphericalEnd:this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(t?this._targetEnd:this._target)}getSpherical(e,t=!0){return(e||new x.Spherical).copy(t?this._sphericalEnd:this._spherical)}getFocalOffset(e,t=!0){return(e&&e.isVector3?e:new x.Vector3).copy(t?this._focalOffsetEnd:this._focalOffset)}normalizeRotations(){this._sphericalEnd.theta=this._sphericalEnd.theta%K,this._sphericalEnd.theta<0&&(this._sphericalEnd.theta+=K),this._spherical.theta+=K*Math.round((this._sphericalEnd.theta-this._spherical.theta)/K)}stop(){this._focalOffset.copy(this._focalOffsetEnd),this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd),this._zoom=this._zoomEnd}reset(e=!1){if(!L(this._camera.up.x,this._cameraUp0.x)||!L(this._camera.up.y,this._cameraUp0.y)||!L(this._camera.up.z,this._cameraUp0.z)){this._camera.up.copy(this._cameraUp0);let i=this.getPosition(O);this.updateCameraUp(),this.setPosition(i.x,i.y,i.z)}let t=[this.setLookAt(this._position0.x,this._position0.y,this._position0.z,this._target0.x,this._target0.y,this._target0.z,e),this.setFocalOffset(this._focalOffset0.x,this._focalOffset0.y,this._focalOffset0.z,e),this.zoomTo(this._zoom0,e)];return Promise.all(t)}saveState(){this._cameraUp0.copy(this._camera.up),this.getTarget(this._target0),this.getPosition(this._position0),this._zoom0=this._zoom,this._focalOffset0.copy(this._focalOffset)}updateCameraUp(){this._yAxisUpSpace.setFromUnitVectors(this._camera.up,oe),this._yAxisUpSpaceInverse.copy(this._yAxisUpSpace).invert()}applyCameraUp(){let e=O.subVectors(this._target,this._camera.position).normalize(),t=D.crossVectors(e,this._camera.up);this._camera.up.crossVectors(t,e).normalize(),this._camera.updateMatrixWorld();let i=this.getPosition(O);this.updateCameraUp(),this.setPosition(i.x,i.y,i.z)}update(e){let t=this._sphericalEnd.theta-this._spherical.theta,i=this._sphericalEnd.phi-this._spherical.phi,a=this._sphericalEnd.radius-this._spherical.radius,o=Ze.subVectors(this._targetEnd,this._target),u=Ge.subVectors(this._focalOffsetEnd,this._focalOffset),p=this._zoomEnd-this._zoom;if(w(t))this._thetaVelocity.value=0,this._spherical.theta=this._sphericalEnd.theta;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.theta=ae(this._spherical.theta,this._sphericalEnd.theta,this._thetaVelocity,f,1/0,e),this._needsUpdate=!0}if(w(i))this._phiVelocity.value=0,this._spherical.phi=this._sphericalEnd.phi;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.phi=ae(this._spherical.phi,this._sphericalEnd.phi,this._phiVelocity,f,1/0,e),this._needsUpdate=!0}if(w(a))this._radiusVelocity.value=0,this._spherical.radius=this._sphericalEnd.radius;else{let f=this._isUserControllingDolly?this.draggingSmoothTime:this.smoothTime;this._spherical.radius=ae(this._spherical.radius,this._sphericalEnd.radius,this._radiusVelocity,f,this.maxSpeed,e),this._needsUpdate=!0}if(w(o.x)&&w(o.y)&&w(o.z))this._targetVelocity.set(0,0,0),this._target.copy(this._targetEnd);else{let f=this._isUserControllingTruck?this.draggingSmoothTime:this.smoothTime;je(this._target,this._targetEnd,this._targetVelocity,f,this.maxSpeed,e,this._target),this._needsUpdate=!0}if(w(u.x)&&w(u.y)&&w(u.z))this._focalOffsetVelocity.set(0,0,0),this._focalOffset.copy(this._focalOffsetEnd);else{let f=this._isUserControllingOffset?this.draggingSmoothTime:this.smoothTime;je(this._focalOffset,this._focalOffsetEnd,this._focalOffsetVelocity,f,this.maxSpeed,e,this._focalOffset),this._needsUpdate=!0}if(w(p))this._zoomVelocity.value=0,this._zoom=this._zoomEnd;else{let f=this._isUserControllingZoom?this.draggingSmoothTime:this.smoothTime;this._zoom=ae(this._zoom,this._zoomEnd,this._zoomVelocity,f,1/0,e)}if(this.dollyToCursor){if(j(this._camera)&&this._changedDolly!==0){let f=this._spherical.radius-this._lastDistance,C=this._camera,b=this._getCameraDirection(te),y=O.copy(b).cross(C.up).normalize();y.lengthSq()===0&&(y.x=1);let A=D.crossVectors(y,b),E=this._sphericalEnd.radius*Math.tan(C.getEffectiveFOV()*W*.5),S=(this._sphericalEnd.radius-f-this._sphericalEnd.radius)/this._sphericalEnd.radius,m=Q.copy(this._targetEnd).add(y.multiplyScalar(this._dollyControlCoord.x*E*C.aspect)).add(A.multiplyScalar(this._dollyControlCoord.y*E)),r=O.copy(this._targetEnd).lerp(m,S),n=this._lastDollyDirection===G.IN&&this._spherical.radius<=this.minDistance,h=this._lastDollyDirection===G.OUT&&this.maxDistance<=this._spherical.radius;if(this.infinityDolly&&(n||h)){this._sphericalEnd.radius-=f,this._spherical.radius-=f;let _=D.copy(b).multiplyScalar(-f);r.add(_)}this._boundary.clampPoint(r,r);let c=D.subVectors(r,this._targetEnd);this._targetEnd.copy(r),this._target.add(c),this._changedDolly-=f,w(this._changedDolly)&&(this._changedDolly=0)}else if(Y(this._camera)&&this._changedZoom!==0){let f=this._zoom-this._lastZoom,C=this._camera,b=O.set(this._dollyControlCoord.x,this._dollyControlCoord.y,(C.near+C.far)/(C.near-C.far)).unproject(C),y=D.set(0,0,-1).applyQuaternion(C.quaternion),A=Q.copy(b).add(y.multiplyScalar(-b.dot(C.up))),E=-(this._zoom-f-this._zoom)/this._zoom,S=this._getCameraDirection(te),m=this._targetEnd.dot(S),r=O.copy(this._targetEnd).lerp(A,E),n=r.dot(S),h=S.multiplyScalar(n-m);r.sub(h),this._boundary.clampPoint(r,r);let c=D.subVectors(r,this._targetEnd);this._targetEnd.copy(r),this._target.add(c),this._changedZoom-=f,w(this._changedZoom)&&(this._changedZoom=0)}}this._camera.zoom!==this._zoom&&(this._camera.zoom=this._zoom,this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0),this._dragNeedsUpdate=!0;let d=this._collisionTest();this._spherical.radius=Math.min(this._spherical.radius,d),this._spherical.makeSafe(),this._camera.position.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(this._target),this._camera.lookAt(this._target),(!w(this._focalOffset.x)||!w(this._focalOffset.y)||!w(this._focalOffset.z))&&(this._camera.updateMatrixWorld(),N.setFromMatrixColumn(this._camera.matrix,0),k.setFromMatrixColumn(this._camera.matrix,1),$.setFromMatrixColumn(this._camera.matrix,2),N.multiplyScalar(this._focalOffset.x),k.multiplyScalar(-this._focalOffset.y),$.multiplyScalar(this._focalOffset.z),O.copy(N).add(k).add($),this._camera.position.add(O)),this._boundaryEnclosesCamera&&this._encloseToBoundary(this._camera.position.copy(this._target),O.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse),1);let g=this._needsUpdate;return g&&!this._updatedLastTime?(this._hasRested=!1,this.dispatchEvent({type:"wake"}),this.dispatchEvent({type:"update"})):g?(this.dispatchEvent({type:"update"}),w(t,this.restThreshold)&&w(i,this.restThreshold)&&w(a,this.restThreshold)&&w(o.x,this.restThreshold)&&w(o.y,this.restThreshold)&&w(o.z,this.restThreshold)&&w(u.x,this.restThreshold)&&w(u.y,this.restThreshold)&&w(u.z,this.restThreshold)&&w(p,this.restThreshold)&&!this._hasRested&&(this._hasRested=!0,this.dispatchEvent({type:"rest"}))):!g&&this._updatedLastTime&&this.dispatchEvent({type:"sleep"}),this._lastDistance=this._spherical.radius,this._lastZoom=this._zoom,this._updatedLastTime=g,this._needsUpdate=!1,g}toJSON(){return JSON.stringify({enabled:this._enabled,minDistance:this.minDistance,maxDistance:J(this.maxDistance),minZoom:this.minZoom,maxZoom:J(this.maxZoom),minPolarAngle:this.minPolarAngle,maxPolarAngle:J(this.maxPolarAngle),minAzimuthAngle:J(this.minAzimuthAngle),maxAzimuthAngle:J(this.maxAzimuthAngle),smoothTime:this.smoothTime,draggingSmoothTime:this.draggingSmoothTime,dollySpeed:this.dollySpeed,truckSpeed:this.truckSpeed,dollyToCursor:this.dollyToCursor,verticalDragToForward:this.verticalDragToForward,target:this._targetEnd.toArray(),position:O.setFromSpherical(this._sphericalEnd).add(this._targetEnd).toArray(),zoom:this._zoomEnd,focalOffset:this._focalOffsetEnd.toArray(),target0:this._target0.toArray(),position0:this._position0.toArray(),zoom0:this._zoom0,focalOffset0:this._focalOffset0.toArray()})}fromJSON(e,t=!1){let i=JSON.parse(e);this.enabled=i.enabled,this.minDistance=i.minDistance,this.maxDistance=ee(i.maxDistance),this.minZoom=i.minZoom,this.maxZoom=ee(i.maxZoom),this.minPolarAngle=i.minPolarAngle,this.maxPolarAngle=ee(i.maxPolarAngle),this.minAzimuthAngle=ee(i.minAzimuthAngle),this.maxAzimuthAngle=ee(i.maxAzimuthAngle),this.smoothTime=i.smoothTime,this.draggingSmoothTime=i.draggingSmoothTime,this.dollySpeed=i.dollySpeed,this.truckSpeed=i.truckSpeed,this.dollyToCursor=i.dollyToCursor,this.verticalDragToForward=i.verticalDragToForward,this._target0.fromArray(i.target0),this._position0.fromArray(i.position0),this._zoom0=i.zoom0,this._focalOffset0.fromArray(i.focalOffset0),this.moveTo(i.target[0],i.target[1],i.target[2],t),F.setFromVector3(O.fromArray(i.position).sub(this._targetEnd).applyQuaternion(this._yAxisUpSpace)),this.rotateTo(F.theta,F.phi,t),this.dollyTo(F.radius,t),this.zoomTo(i.zoom,t),this.setFocalOffset(i.focalOffset[0],i.focalOffset[1],i.focalOffset[2],t),this._needsUpdate=!0}connect(e){if(this._domElement){console.warn("camera-controls is already connected.");return}e.setAttribute("data-camera-controls-version",pi),this._addAllEventListeners(e),this._getClientRect(this._elementRect)}disconnect(){this.cancel(),this._removeAllEventListeners(),this._domElement&&(this._domElement.removeAttribute("data-camera-controls-version"),this._domElement=void 0)}dispose(){this.removeAllEventListeners(),this.disconnect()}_getTargetDirection(e){return e.setFromSpherical(this._spherical).divideScalar(this._spherical.radius).applyQuaternion(this._yAxisUpSpaceInverse)}_getCameraDirection(e){return this._getTargetDirection(e).negate()}_findPointerById(e){return this._activePointers.find(t=>t.pointerId===e)}_findPointerByMouseButton(e){return this._activePointers.find(t=>t.mouseButton===e)}_disposePointer(e){this._activePointers.splice(this._activePointers.indexOf(e),1)}_encloseToBoundary(e,t,i){let a=t.lengthSq();if(a===0)return e;let o=D.copy(t).add(e),u=this._boundary.clampPoint(o,Q).sub(o),p=u.lengthSq();if(p===0)return e.add(t);if(p===a)return e;if(i===0)return e.add(t).add(u);{let d=1+i*p/t.dot(u);return e.add(D.copy(t).multiplyScalar(d)).add(u.multiplyScalar(1-i))}}_updateNearPlaneCorners(){if(j(this._camera)){let e=this._camera,t=e.near,i=e.getEffectiveFOV()*W,a=Math.tan(i*.5)*t,o=a*e.aspect;this._nearPlaneCorners[0].set(-o,-a,0),this._nearPlaneCorners[1].set(o,-a,0),this._nearPlaneCorners[2].set(o,a,0),this._nearPlaneCorners[3].set(-o,a,0)}else if(Y(this._camera)){let e=this._camera,t=1/e.zoom,i=e.left*t,a=e.right*t,o=e.top*t,u=e.bottom*t;this._nearPlaneCorners[0].set(i,o,0),this._nearPlaneCorners[1].set(a,o,0),this._nearPlaneCorners[2].set(a,u,0),this._nearPlaneCorners[3].set(i,u,0)}}_collisionTest(){let e=1/0;if(!(this.colliderMeshes.length>=1)||pe(this._camera,"_collisionTest"))return e;let t=this._getTargetDirection(te);Ce.lookAt($e,t,this._camera.up);for(let i=0;i<4;i++){let a=D.copy(this._nearPlaneCorners[i]);a.applyMatrix4(Ce);let o=Q.addVectors(this._target,a);le.set(o,t),le.far=this._spherical.radius+1;let u=le.intersectObjects(this.colliderMeshes);u.length!==0&&u[0].distance<e&&(e=u[0].distance)}return e}_getClientRect(e){if(!this._domElement)return;let t=this._domElement.getBoundingClientRect();return e.x=t.left,e.y=t.top,this._viewport?(e.x+=this._viewport.x,e.y+=t.height-this._viewport.w-this._viewport.y,e.width=this._viewport.z,e.height=this._viewport.w):(e.width=t.width,e.height=t.height),e}_createOnRestPromise(e){return e?Promise.resolve():(this._hasRested=!1,this.dispatchEvent({type:"transitionstart"}),new Promise(t=>{let i=()=>{this.removeEventListener("rest",i),t()};this.addEventListener("rest",i)}))}_addAllEventListeners(e){}_removeAllEventListeners(){}get dampingFactor(){return console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead."),0}set dampingFactor(e){console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead.")}get draggingDampingFactor(){return console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead."),0}set draggingDampingFactor(e){console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead.")}static createBoundingSphere(e,t=new x.Sphere){let i=t,a=i.center;X.makeEmpty(),e.traverseVisible(u=>{u.isMesh&&X.expandByObject(u)}),X.getCenter(a);let o=0;return e.traverseVisible(u=>{if(!u.isMesh)return;let p=u,d=p.geometry.clone();d.applyMatrix4(p.matrixWorld);let g=d.attributes.position;for(let f=0,C=g.count;f<C;f++)O.fromBufferAttribute(g,f),o=Math.max(o,a.distanceToSquared(O))}),i.radius=Math.sqrt(o),i}};function gi(s){var e=s,{dampingFactor:t=.05}=e,i=Te(e,["dampingFactor"]);Xe.install({THREE:_t}),mt({CameraControls:Xe});let a=Ee(p=>p.camera),o=Ee(p=>p.gl),u=_i(i);return U.jsx("cameraControls",{ref:u,args:[a,o.domElement],enableDamping:!0,dampingFactor:t,zoomSpeed:10,dollySpeed:10,restThreshold:0})}/*! Bundled license information:

camera-controls/dist/camera-controls.module.js:
  (*!
   * camera-controls
   * https://github.com/yomotsu/camera-controls
   * (c) 2017 @yomotsu
   * Released under the MIT License.
   *)
*/function yi(s){return U.jsx(U.Fragment,{children:U.jsx(gi,I({},s))})}var vi={halo:{props:{type:"plane",uAmplitude:1,uDensity:1.3,uSpeed:.4,uStrength:4,uTime:0,uFrequency:5.5,range:"enabled",rangeStart:0,rangeEnd:40,frameRate:10,destination:"onCanvas",format:"gif",axesHelper:"off",brightness:1.2,cAzimuthAngle:180,cDistance:3.6,cPolarAngle:90,cameraZoom:1,color1:"#ff5005",color2:"#dbba95",color3:"#d0bce1",embedMode:"off",envPreset:"city",gizmoHelper:"hide",grain:"on",lightType:"3d",pixelDensity:1,fov:45,positionX:-1.4,positionY:0,positionZ:0,reflection:.1,rotationX:0,rotationY:10,rotationZ:50,shader:"defaults",animate:"on",wireframe:!1}}},Ci=se((s,e)=>{e.exports=t=>encodeURIComponent(t).replace(/[!'()*]/g,i=>`%${i.charCodeAt(0).toString(16).toUpperCase()}`)}),xi=se((s,e)=>{var t="%[a-f0-9]{2}",i=new RegExp("("+t+")|([^%]+?)","gi"),a=new RegExp("("+t+")+","gi");function o(d,g){try{return[decodeURIComponent(d.join(""))]}catch{}if(d.length===1)return d;g=g||1;var f=d.slice(0,g),C=d.slice(g);return Array.prototype.concat.call([],o(f),o(C))}function u(d){try{return decodeURIComponent(d)}catch{for(var g=d.match(i)||[],f=1;f<g.length;f++)d=o(g,f).join(""),g=d.match(i)||[];return d}}function p(d){for(var g={"%FE%FF":"��","%FF%FE":"��"},f=a.exec(d);f;){try{g[f[0]]=decodeURIComponent(f[0])}catch{var C=u(f[0]);C!==f[0]&&(g[f[0]]=C)}f=a.exec(d)}g["%C2"]="�";for(var b=Object.keys(g),y=0;y<b.length;y++){var A=b[y];d=d.replace(new RegExp(A,"g"),g[A])}return d}e.exports=function(d){if(typeof d!="string")throw new TypeError("Expected `encodedURI` to be of type `string`, got `"+typeof d+"`");try{return d=d.replace(/\+/g," "),decodeURIComponent(d)}catch{return p(d)}}}),Ei=se((s,e)=>{e.exports=(t,i)=>{if(!(typeof t=="string"&&typeof i=="string"))throw new TypeError("Expected the arguments to be of type `string`");if(i==="")return[t];let a=t.indexOf(i);return a===-1?[t]:[t.slice(0,a),t.slice(a+i.length)]}}),Ti=se((s,e)=>{e.exports=function(t,i){for(var a={},o=Object.keys(t),u=Array.isArray(i),p=0;p<o.length;p++){var d=o[p],g=t[d];(u?i.indexOf(d)!==-1:i(d,g,t))&&(a[d]=g)}return a}}),Oi=se(s=>{var e=Ci(),t=xi(),i=Ei(),a=Ti(),o=r=>r==null,u=Symbol("encodeFragmentIdentifier");function p(r){switch(r.arrayFormat){case"index":return n=>(h,c)=>{let _=h.length;return c===void 0||r.skipNull&&c===null||r.skipEmptyString&&c===""?h:c===null?[...h,[f(n,r),"[",_,"]"].join("")]:[...h,[f(n,r),"[",f(_,r),"]=",f(c,r)].join("")]};case"bracket":return n=>(h,c)=>c===void 0||r.skipNull&&c===null||r.skipEmptyString&&c===""?h:c===null?[...h,[f(n,r),"[]"].join("")]:[...h,[f(n,r),"[]=",f(c,r)].join("")];case"colon-list-separator":return n=>(h,c)=>c===void 0||r.skipNull&&c===null||r.skipEmptyString&&c===""?h:c===null?[...h,[f(n,r),":list="].join("")]:[...h,[f(n,r),":list=",f(c,r)].join("")];case"comma":case"separator":case"bracket-separator":{let n=r.arrayFormat==="bracket-separator"?"[]=":"=";return h=>(c,_)=>_===void 0||r.skipNull&&_===null||r.skipEmptyString&&_===""?c:(_=_===null?"":_,c.length===0?[[f(h,r),n,f(_,r)].join("")]:[[c,f(_,r)].join(r.arrayFormatSeparator)])}default:return n=>(h,c)=>c===void 0||r.skipNull&&c===null||r.skipEmptyString&&c===""?h:c===null?[...h,f(n,r)]:[...h,[f(n,r),"=",f(c,r)].join("")]}}function d(r){let n;switch(r.arrayFormat){case"index":return(h,c,_)=>{if(n=/\[(\d*)\]$/.exec(h),h=h.replace(/\[\d*\]$/,""),!n){_[h]=c;return}_[h]===void 0&&(_[h]={}),_[h][n[1]]=c};case"bracket":return(h,c,_)=>{if(n=/(\[\])$/.exec(h),h=h.replace(/\[\]$/,""),!n){_[h]=c;return}if(_[h]===void 0){_[h]=[c];return}_[h]=[].concat(_[h],c)};case"colon-list-separator":return(h,c,_)=>{if(n=/(:list)$/.exec(h),h=h.replace(/:list$/,""),!n){_[h]=c;return}if(_[h]===void 0){_[h]=[c];return}_[h]=[].concat(_[h],c)};case"comma":case"separator":return(h,c,_)=>{let T=typeof c=="string"&&c.includes(r.arrayFormatSeparator),v=typeof c=="string"&&!T&&C(c,r).includes(r.arrayFormatSeparator);c=v?C(c,r):c;let R=T||v?c.split(r.arrayFormatSeparator).map(ue=>C(ue,r)):c===null?c:C(c,r);_[h]=R};case"bracket-separator":return(h,c,_)=>{let T=/(\[\])$/.test(h);if(h=h.replace(/\[\]$/,""),!T){_[h]=c&&C(c,r);return}let v=c===null?[]:c.split(r.arrayFormatSeparator).map(R=>C(R,r));if(_[h]===void 0){_[h]=v;return}_[h]=[].concat(_[h],v)};default:return(h,c,_)=>{if(_[h]===void 0){_[h]=c;return}_[h]=[].concat(_[h],c)}}}function g(r){if(typeof r!="string"||r.length!==1)throw new TypeError("arrayFormatSeparator must be single character string")}function f(r,n){return n.encode?n.strict?e(r):encodeURIComponent(r):r}function C(r,n){return n.decode?t(r):r}function b(r){return Array.isArray(r)?r.sort():typeof r=="object"?b(Object.keys(r)).sort((n,h)=>Number(n)-Number(h)).map(n=>r[n]):r}function y(r){let n=r.indexOf("#");return n!==-1&&(r=r.slice(0,n)),r}function A(r){let n="",h=r.indexOf("#");return h!==-1&&(n=r.slice(h)),n}function E(r){r=y(r);let n=r.indexOf("?");return n===-1?"":r.slice(n+1)}function S(r,n){return n.parseNumbers&&!Number.isNaN(Number(r))&&typeof r=="string"&&r.trim()!==""?r=Number(r):n.parseBooleans&&r!==null&&(r.toLowerCase()==="true"||r.toLowerCase()==="false")&&(r=r.toLowerCase()==="true"),r}function m(r,n){n=Object.assign({decode:!0,sort:!0,arrayFormat:"none",arrayFormatSeparator:",",parseNumbers:!1,parseBooleans:!1},n),g(n.arrayFormatSeparator);let h=d(n),c=Object.create(null);if(typeof r!="string"||(r=r.trim().replace(/^[?#&]/,""),!r))return c;for(let _ of r.split("&")){if(_==="")continue;let[T,v]=i(n.decode?_.replace(/\+/g," "):_,"=");v=v===void 0?null:["comma","separator","bracket-separator"].includes(n.arrayFormat)?v:C(v,n),h(C(T,n),v,c)}for(let _ of Object.keys(c)){let T=c[_];if(typeof T=="object"&&T!==null)for(let v of Object.keys(T))T[v]=S(T[v],n);else c[_]=S(T,n)}return n.sort===!1?c:(n.sort===!0?Object.keys(c).sort():Object.keys(c).sort(n.sort)).reduce((_,T)=>{let v=c[T];return v&&typeof v=="object"&&!Array.isArray(v)?_[T]=b(v):_[T]=v,_},Object.create(null))}s.extract=E,s.parse=m,s.stringify=(r,n)=>{if(!r)return"";n=Object.assign({encode:!0,strict:!0,arrayFormat:"none",arrayFormatSeparator:","},n),g(n.arrayFormatSeparator);let h=v=>n.skipNull&&o(r[v])||n.skipEmptyString&&r[v]==="",c=p(n),_={};for(let v of Object.keys(r))h(v)||(_[v]=r[v]);let T=Object.keys(_);return n.sort!==!1&&T.sort(n.sort),T.map(v=>{let R=r[v];return R===void 0?"":R===null?f(v,n):Array.isArray(R)?R.length===0&&n.arrayFormat==="bracket-separator"?f(v,n)+"[]":R.reduce(c(v),[]).join("&"):f(v,n)+"="+f(R,n)}).filter(v=>v.length>0).join("&")},s.parseUrl=(r,n)=>{n=Object.assign({decode:!0},n);let[h,c]=i(r,"#");return Object.assign({url:h.split("?")[0]||"",query:m(E(r),n)},n&&n.parseFragmentIdentifier&&c?{fragmentIdentifier:C(c,n)}:{})},s.stringifyUrl=(r,n)=>{n=Object.assign({encode:!0,strict:!0,[u]:!0},n);let h=y(r.url).split("?")[0]||"",c=s.extract(r.url),_=s.parse(c,{sort:!1}),T=Object.assign(_,r.query),v=s.stringify(T,n);v&&(v=`?${v}`);let R=A(r.url);return r.fragmentIdentifier&&(R=`#${n[u]?f(r.fragmentIdentifier,n):r.fragmentIdentifier}`),`${h}${v}${R}`},s.pick=(r,n,h)=>{h=Object.assign({parseFragmentIdentifier:!0,[u]:!1},h);let{url:c,query:_,fragmentIdentifier:T}=s.parseUrl(r,h);return s.stringifyUrl({url:c,query:a(_,n),fragmentIdentifier:T},h)},s.exclude=(r,n,h)=>{let c=Array.isArray(n)?_=>!n.includes(_):(_,T)=>!n(_,T);return s.pick(r,c,h)}}),bi=Ut(Oi());function Di(s){let e=I(I({},vi.halo.props),s),{control:t,urlString:i}=e,a=Te(e,["control","urlString"]);t==="query"&&(a=bi.parse(hi(i),{parseNumbers:!0,parseBooleans:!0,arrayFormat:"index"}));let o=a,{lightType:u,envPreset:p,brightness:d,grain:g,toggleAxis:f}=o;return Te(o,["lightType","envPreset","brightness","grain","toggleAxis"]),U.jsxs(U.Fragment,{children:[U.jsx(Bt,I({},a)),U.jsx(ft,{}),g!=="off"&&U.jsx(li,{}),U.jsx(yi,I({},a))]})}function Ai({children:s,style:e={},pixelDensity:t=1,fov:i=45}){return Si(),U.jsx(pt,St(I({style:e,resize:{offsetSize:!0}},ci(t,i)),{children:s}))}function Si(){H.useEffect(()=>{re.uv2_pars_vertex="",re.uv2_vertex="",re.uv2_pars_fragment="",re.encodings_fragment=""},[])}function Li(){if(typeof window>"u")return!1;try{const s=document.createElement("canvas");return!!(s.getContext("webgl2")||s.getContext("webgl"))}catch{return!1}}function Yi({speed:s=.08}){const[e,t]=H.useState(!1);return H.useEffect(()=>{const i=window.matchMedia("(prefers-reduced-motion: reduce)");t(i.matches);const a=o=>t(o.matches);return i.addEventListener("change",a),()=>i.removeEventListener("change",a)},[]),Li()?U.jsx("div",{style:{width:"100%",height:"100%"},children:U.jsx(Ai,{style:{width:"100%",height:"100%"},pixelDensity:.5,fov:55,children:U.jsx(Di,{type:"waterPlane",animate:e?"off":"on",uSpeed:e?0:s,color1:"#052e16",color2:"#10b981",color3:"#22d3ee",lightType:"env",envPreset:"lobby",brightness:1,grain:"off",cDistance:4})})}):U.jsx("div",{"aria-hidden":"true",style:{width:"100%",height:"100%",background:"radial-gradient(120% 120% at 20% 10%, #10b98155 0%, transparent 55%), radial-gradient(90% 90% at 85% 85%, #22d3ee44 0%, transparent 50%), #04150f"}})}export{Yi as default};
