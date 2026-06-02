/**
 * Framer Code Component: Globe Morph with Property Panel
 *
 * HOW TO USE IN FRAMER:
 * 1. Host van-der-grinten-map.html (e.g. GitHub Pages)
 * 2. In Framer: Insert → Code → Create new component
 * 3. Paste this code, set GLOBE_URL to your hosted URL
 * 4. Drag the component onto the canvas
 * 5. Select it — Framer's Property Panel (right side) shows all controls
 *
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 450
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */import{jsx as _jsx}from"react/jsx-runtime";import{addPropertyControls,ControlType}from"framer";// Host your globe and put the full URL here. MUST be HTTPS (Framer blocks HTTP).
const GLOBE_URL="https://tkartik.com/globe-to-flat-map/van-der-grinten-map.html";const DEFAULTS={hex:"#ffffff",ocean:"#000000",bg:"#000000",landOpacity:1,globeOpacity:.5,density:500};function toHex(color){if(!color)return"";if(color.startsWith("#"))return color.slice(1);const m=color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)return"";const r=parseInt(m[1],10).toString(16).padStart(2,"0");const g=parseInt(m[2],10).toString(16).padStart(2,"0");const b=parseInt(m[3],10).toString(16).padStart(2,"0");return r+g+b;}/** Build URL with ALL params (use defaults when prop undefined) — URL is source of truth */function buildGlobeUrl(p){const hex=p.hex!=null?p.hex.startsWith("#")?p.hex.slice(1):toHex(p.hex):DEFAULTS.hex.slice(1);const ocean=p.ocean!=null?p.ocean.startsWith("#")?p.ocean.slice(1):toHex(p.ocean):DEFAULTS.ocean.slice(1);const bg=p.bg!=null?p.bg.startsWith("#")?p.bg.slice(1):toHex(p.bg):DEFAULTS.bg.slice(1);const params=new URLSearchParams({hex,ocean,bg,landOpacity:String(p.landOpacity??DEFAULTS.landOpacity),globeOpacity:String(p.globeOpacity??DEFAULTS.globeOpacity),density:String(Math.round(Number(p.density)||DEFAULTS.density))});return`${GLOBE_URL}?${params.toString()}`;}export default function GlobeMorph(props){const p={...DEFAULTS,...props};const src=buildGlobeUrl(p);return /*#__PURE__*/_jsx("div",{style:{width:"100%",height:"100%",minWidth:320,minHeight:180,position:"relative",backgroundColor:"#0a0a0a",...props.style},children:/*#__PURE__*/_jsx("iframe",{src:src,title:"Globe Morph",style:{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}},src)});}GlobeMorph.defaultProps={hex:"#ffffff",ocean:"#000000",bg:"#000000",landOpacity:1,globeOpacity:.5,density:500};addPropertyControls(GlobeMorph,{hex:{type:ControlType.Color,title:"Land Color",defaultValue:"#ffffff"},ocean:{type:ControlType.Color,title:"Ocean Color",defaultValue:"#000000"},bg:{type:ControlType.Color,title:"Background",defaultValue:"#000000"},landOpacity:{type:ControlType.Number,title:"Land Opacity",min:0,max:1,step:.05,defaultValue:1},globeOpacity:{type:ControlType.Number,title:"Globe Opacity",min:0,max:1,step:.05,defaultValue:.5},density:{type:ControlType.Number,title:"Hex Density",min:150,max:650,step:50,defaultValue:500}});
export const __FramerMetadata__ = {"exports":{"default":{"type":"reactComponent","name":"GlobeMorph","slots":[],"annotations":{"framerContractVersion":"1"}},"__FramerMetadata__":{"type":"variable"}}}
//# sourceMappingURL=./GlobeMorph.map
