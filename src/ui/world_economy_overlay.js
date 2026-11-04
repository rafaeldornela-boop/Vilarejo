/**
 * VILAREJO | WORLD ECONOMY OVERLAY
 * Visualização de redes e indicadores econômicos fornecidos pelo jogo.
 * Este módulo apenas desenha dados recebidos. Não calcula nem altera a economia.
 * Phaser 3 | UMD global: VilarejoWorldEconomyOverlay
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldEconomyOverlay = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const MODES = Object.freeze(["off", "electricity", "water", "goods", "transit", "land_value", "pollution", "employment", "services", "all"]);
  const NETWORK_COLORS = Object.freeze({ electricity: 0xe8c66f, water: 0x72c6d4, goods: 0xe6a16e, transit: 0x9d9acb });
  const ZONE_COLORS = Object.freeze({
    land_value: Object.freeze({ low: 0x6c9b83, medium: 0xd0b36b, high: 0xd47764 }),
    pollution: Object.freeze({ low: 0x6fae85, medium: 0xd6b46b, high: 0xc96d5f }),
    employment: Object.freeze({ low: 0x8295a0, medium: 0x7ea9a0, high: 0xdbc074 }),
    services: Object.freeze({ low: 0x8397ae, medium: 0x7ba8b3, high: 0xd5ba7a })
  });

  function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value, min))); }
  function normalizedPoint(value) {
    if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
    return { x: Number(value.x), y: Number(value.y) };
  }
  function poly(g, points, color, alpha) {
    if (!points || points.length < 3) return;
    g.fillStyle(color, alpha); g.beginPath(); g.moveTo(points[0].x, points[0].y);
    for (let i=1;i<points.length;i+=1) g.lineTo(points[i].x, points[i].y);
    g.closePath(); g.fillPath();
  }
  function segment(g, a, b, color, width, alpha) {
    g.lineStyle(width, color, alpha); g.lineBetween(a.x,a.y,b.x,b.y);
  }
  function statusColor(status, base) {
    if (status === "offline") return 0x8a7776;
    if (status === "strained") return 0xe0a45e;
    if (status === "planned") return 0xa5a7a2;
    return base;
  }
  function levelColor(metric, level) {
    const palette = ZONE_COLORS[metric] || ZONE_COLORS.land_value;
    return palette[level] || palette.medium;
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function" || typeof scene.add.graphics !== "function") {
      throw new TypeError("Informe uma cena Phaser válida.");
    }
    const o = Object.assign({ parent: null, mode: "off", data: null, showLabels: true, depth: 70 }, options || {});
    const parent = o.parent || scene.add.container(0,0);
    const ownedParent = !o.parent;
    if (!parent || typeof parent.add !== "function") throw new TypeError("O parent precisa ser um Container Phaser.");
    const layer = scene.add.container(0,0);
    parent.add(layer);
    const graphics = scene.add.graphics();
    layer.add(graphics);
    let mode = MODES.includes(String(o.mode)) ? String(o.mode) : "off";
    let data = { networks: [], zones: [], markers: [] };
    let destroyed = false;
    const labels = [];
    layer.setDepth(finite(o.depth,70));
    layer.setVisible(mode !== "off");

    function clearLabels() { labels.forEach(label => label.destroy(true)); labels.length = 0; }
    function addLabel(x,y,value,color) {
      if (!o.showLabels || !value) return;
      const text = scene.add.text(x,y,String(value),{
        fontFamily:"Arial, sans-serif",fontSize:"10px",color:color || "#f1f0df",
        stroke:"#24343c",strokeThickness:3,shadow:{color:"#16252d",blur:3,fill:true,offsetY:1}
      }).setOrigin(0.5,1);
      layer.add(text); labels.push(text);
    }
    function drawNetwork(network) {
      const points = (Array.isArray(network.points) ? network.points : []).map(normalizedPoint).filter(Boolean);
      if (points.length < 2) return;
      const type = String(network.type || "goods");
      const color = statusColor(String(network.status || "active"), NETWORK_COLORS[type] || NETWORK_COLORS.goods);
      const planned = network.status === "planned";
      const width = clamp(network.width === undefined ? 3 : network.width, 1, 10);
      for(let i=0;i<points.length-1;i+=1){
        const a=points[i],b=points[i+1];
        if(planned){
          const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/17));
          for(let s=0;s<steps;s+=2){const t0=s/steps,t1=Math.min(1,(s+1)/steps);segment(graphics,{x:a.x+dx*t0,y:a.y+dy*t0},{x:a.x+dx*t1,y:a.y+dy*t1},color,width,0.9);}
        } else {
          segment(graphics,a,b,0x172a34,width+4,0.22);
          segment(graphics,a,b,color,width,0.94);
          if(type==="electricity"){
            const dx=b.x-a.x,dy=b.y-a.y;
            for(let t=0.25;t<1;t+=0.25){const x=a.x+dx*t,y=a.y+dy*t;graphics.fillStyle(0xffedb1,0.95);graphics.fillCircle(x,y,1.8);}
          }
        }
      }
      points.forEach((p,index)=>{
        graphics.fillStyle(color,0.98);graphics.fillCircle(p.x,p.y,index===0||index===points.length-1?4:2.5);
        graphics.lineStyle(1,0x20333c,0.9);graphics.strokeCircle(p.x,p.y,index===0||index===points.length-1?5.6:3.6);
      });
      const mid = points[Math.floor(points.length/2)];
      addLabel(mid.x,mid.y-7,network.label || "", "#f5edcf");
    }
    function drawZone(zone) {
      const metric = String(zone.metric || (mode === "all" ? "land_value" : mode));
      const color = levelColor(metric,String(zone.level || "medium"));
      const alpha = clamp(zone.intensity === undefined ? 0.2 : zone.intensity,0.05,0.62);
      const points = (Array.isArray(zone.points)?zone.points:[]).map(normalizedPoint).filter(Boolean);
      if(points.length>=3){
        poly(graphics,points,color,alpha);
        graphics.lineStyle(1.2,color,Math.min(0.7,alpha+0.2));
        graphics.beginPath();graphics.moveTo(points[0].x,points[0].y);
        for(let i=1;i<points.length;i+=1) graphics.lineTo(points[i].x,points[i].y);
        graphics.closePath();graphics.strokePath();
        const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;
        addLabel(cx,cy,String(zone.label || ""),"#f6f0da");
      } else if (Number.isFinite(Number(zone.x)) && Number.isFinite(Number(zone.y))) {
        const radius=clamp(zone.radius === undefined ? 62 : zone.radius,20,180);
        graphics.fillStyle(color,alpha);graphics.fillEllipse(Number(zone.x),Number(zone.y),radius*2,radius);
        graphics.lineStyle(1,color,Math.min(0.72,alpha+0.22));graphics.strokeEllipse(Number(zone.x),Number(zone.y),radius*2,radius);
        addLabel(Number(zone.x),Number(zone.y),String(zone.label || ""),"#f6f0da");
      }
    }
    function drawMarker(marker) {
      const p=normalizedPoint(marker); if(!p) return;
      const kind=String(marker.kind || "node");
      const color=kind==="production"?0x87b99b:kind==="storage"?0xd0b270:kind==="demand"?0xd17e69:kind==="port"?0x78afc0:0xd8d9cb;
      graphics.fillStyle(0x1a2b34,0.75);graphics.fillCircle(p.x,p.y,9);
      graphics.fillStyle(color,1);graphics.fillCircle(p.x,p.y,6);
      graphics.lineStyle(1.2,0xf1e8cb,0.9);graphics.strokeCircle(p.x,p.y,6);
      addLabel(p.x,p.y-10,String(marker.label || ""),"#f7f0dc");
    }
    function modeMatchesNetwork(network) { return mode === "all" || mode === String(network.type || ""); }
    function modeMatchesZone(zone) { return mode === "all" || mode === String(zone.metric || ""); }
    function render() {
      graphics.clear(); clearLabels();
      if(mode==="off") { layer.setVisible(false); return; }
      layer.setVisible(true);
      if(mode==="electricity"||mode==="water"||mode==="goods"||mode==="transit"||mode==="all") data.networks.filter(modeMatchesNetwork).forEach(drawNetwork);
      if(mode==="land_value"||mode==="pollution"||mode==="employment"||mode==="services"||mode==="all") data.zones.filter(modeMatchesZone).forEach(drawZone);
      if(mode!=="off") data.markers.forEach(drawMarker);
    }
    function normalizeData(input) {
      if(!input||typeof input!=="object"||Array.isArray(input)) throw new TypeError("Os dados do mapa econômico precisam ser um objeto.");
      return {
        networks:Array.isArray(input.networks)?input.networks.filter(item=>item&&typeof item==="object").map(item=>Object.assign({},item)):[],
        zones:Array.isArray(input.zones)?input.zones.filter(item=>item&&typeof item==="object").map(item=>Object.assign({},item)):[],
        markers:Array.isArray(input.markers)?input.markers.filter(item=>item&&typeof item==="object").map(item=>Object.assign({},item)):[]
      };
    }
    function setData(input) { if(destroyed) throw new Error("A camada econômica foi destruída."); data=normalizeData(input); render(); return getState(); }
    function setMode(nextMode) {
      if(destroyed) throw new Error("A camada econômica foi destruída.");
      const next=String(nextMode||"off"); if(!MODES.includes(next)) throw new RangeError("Modo econômico inválido: "+next);
      mode=next; render(); return mode;
    }
    function getState() { return Object.freeze({mode,networks:data.networks.length,zones:data.zones.length,markers:data.markers.length,visible:mode!=="off"}); }
    function clear() { data={networks:[],zones:[],markers:[]};render();return getState(); }
    function destroy() {
      if(destroyed)return;destroyed=true;
      scene.events&&scene.events.off&&scene.events.off("shutdown",destroy);
      clearLabels();layer.destroy(true);if(ownedParent)parent.destroy(true);
    }
    scene.events&&scene.events.once&&scene.events.once("shutdown",destroy);
    if(o.data) data=normalizeData(o.data);
    render();
    return Object.freeze({version:VERSION,container:layer,setData,setMode,getState,clear,destroy});
  }

  return Object.freeze({version:VERSION,modes:MODES,networkColors:NETWORK_COLORS,zoneColors:ZONE_COLORS,mount});
});
