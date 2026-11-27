import type { VenueMapPin } from './venue-map-data.ts';

export type MapCopy = { title: string; empty: string; sample: string; unavailable: string; open: string };
type MapColors = { background: string; overlaySurface: string; text: string; textSecondary: string; purpleButton: string; purpleLight: string; onAccent: string };
const scriptData = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export function venueMapHtml(pins: readonly VenueMapPin[], copy: MapCopy, colors: MapColors): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0}body{background:${colors.background};color:${colors.text};font:14px system-ui}
#status{position:absolute;z-index:1000;left:16px;right:16px;top:16px;padding:12px;border-radius:12px;background:${colors.overlaySurface};text-align:center}
#status[hidden]{display:none}.leaflet-container{background:${colors.background};font:13px system-ui}
.pin{background:transparent;border:0}.pin span{display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colors.purpleLight};border:3px solid ${colors.onAccent};box-shadow:0 3px 14px #0008}
.pin span:after{content:'';display:block;width:8px;height:8px;border-radius:50%;background:${colors.onAccent};margin:8px}
.leaflet-tooltip{background:${colors.background};color:${colors.text};border:1px solid ${colors.purpleLight};border-radius:8px;box-shadow:0 2px 8px #0005;font-weight:600}
.leaflet-tooltip-top:before{border-top-color:${colors.purpleLight}}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:${colors.overlaySurface};color:${colors.text}}
.leaflet-popup-content{line-height:1.5}.leaflet-popup-content small{display:block;color:${colors.textSecondary};margin:4px 0}
button{display:block;min-height:44px;padding:8px 16px;margin-top:8px;border:0;border-radius:10px;background:${colors.purpleButton};color:${colors.onAccent};font:600 14px system-ui;cursor:pointer}
.leaflet-control-attribution{font-size:10px!important}
</style></head><body><div id="map"></div><div id="status"></div>
<script>
const pins=${scriptData(pins)},copy=${scriptData(copy)};
const status=document.getElementById('status');status.textContent=copy.unavailable;
function send(id){const message=JSON.stringify({type:'venue',id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(message)}else{window.parent.postMessage(message,'*')}}
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
if(window.L){
 const map=L.map('map',{scrollWheelZoom:false,zoomControl:false}).setView([45.4642,9.19],12);
 document.getElementById('map').setAttribute('aria-label',copy.title);
 L.control.zoom({position:'bottomright'}).addTo(map);
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(map);
 let tileFailed=false;
 status.hidden=pins.length>0;status.textContent=copy.empty;
 tiles.on('tileerror',function(){tileFailed=true;status.textContent=copy.unavailable;status.hidden=false});
 tiles.on('loading',function(){tileFailed=false});
 tiles.on('load',function(){if(!tileFailed){status.textContent=copy.empty;status.hidden=pins.length>0}});
 const points=[];
 pins.forEach(function(pin){
   const point=[pin.latitude,pin.longitude];points.push(point);
   const label=pin.name+(pin.sample?' · '+copy.sample:'');
   const marker=L.marker(point,{title:label,alt:label,icon:L.divIcon({className:'pin',html:'<span></span>',iconSize:[30,36],iconAnchor:[15,34]})}).addTo(map);
   const tooltip=document.createElement('span');tooltip.textContent=pin.name;
   marker.bindTooltip(tooltip,{permanent:true,direction:'top',offset:[0,-34]});
   const popup=document.createElement('div'),name=document.createElement('strong');name.textContent=pin.name;popup.appendChild(name);
   if(pin.sample){const note=document.createElement('small');note.textContent=copy.sample;popup.appendChild(note)}
   const button=document.createElement('button');button.textContent=copy.open;button.onclick=function(){send(pin.id)};popup.appendChild(button);marker.bindPopup(popup);
 });
 if(points.length){map.fitBounds(L.latLngBounds(points),{padding:[55,65],maxZoom:15})}
 new ResizeObserver(function(){map.invalidateSize()}).observe(document.getElementById('map'));
}
</script></body></html>`;
}
