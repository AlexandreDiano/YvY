import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ActionListed } from '@/lib/db.types';
import { shortDateTime } from '@/lib/format';
import { Txt, color, radius, space } from '@/ui';
import { locate, type Point } from '@/ui/MeetingPointPicker';
import { IconPin } from '@/ui/icons';
import { actionTypeLabel } from '@/api/actions';
import { areaShape, membersByArea, type AreaCount, type AreaShape } from '@/features/actions/areas';

type Area = { cep?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null };

/**
 * Mapa das ações: Leaflet + OpenStreetMap numa WebView (sem build nativo nem
 * token), o mesmo esquema do MeetingPointPicker. Cada ação com ponto de
 * encontro vira um alfinete; tocar abre o resumo e "Abrir" leva à ação.
 * Ação sem ponto continua na lista e é contada embaixo do mapa.
 *
 * Por baixo dos alfinetes, cada bairro com membros fica pintado (contorno do
 * OpenStreetMap) com quantos membros tem. Seu bairro em terracota, os outros
 * em verde, mais forte quanto mais gente.
 */
export function ActionsMap({ actions, area }: { actions: ActionListed[]; area: Area }) {
  const router = useRouter();
  const pins = useMemo(
    () =>
      actions
        .filter((a) => a.lat != null && a.lng != null)
        .map((a) => ({
          id: a.id,
          lat: a.lat!,
          lng: a.lng!,
          t: a.title,
          s: `${actionTypeLabel(a.type)} · ${shortDateTime(a.scheduled_at)}${a.location_name ? ` · ${a.location_name}` : ''}`,
        })),
    [actions],
  );
  const without = actions.length - pins.length;
  const [center, setCenter] = useState<Point | null>(null);
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [areas, setAreas] = useState<(AreaCount & AreaShape)[]>([]);
  const [areaTotal, setAreaTotal] = useState(0);

  // Bairros com membros: contagem do banco, contorno do OSM (um por segundo,
  // com cache), e cada um entra no mapa assim que chega.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ctrl = new AbortController();
    void (async () => {
      const list = await membersByArea();
      setAreaTotal(list.length);
      // O próprio bairro primeiro: é o que a pessoa procura.
      for (const a of [...list].sort((x, y) => Number(y.mine) - Number(x.mine))) {
        if (ctrl.signal.aborted) return;
        const shape = await areaShape(a, ctrl.signal);
        if (shape) setAreas((cur) => [...cur, { ...a, ...shape }]);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // A página do mapa recarrega quando as ações mudam; reenvia os bairros.
  useEffect(() => {
    if (!ready || !areas.length) return;
    const payload = JSON.stringify(
      areas.map((a) => ({ n: a.neighborhood, c: a.members, m: a.mine, lat: a.lat, lng: a.lng, g: a.geo })),
    ).replace(/</g, '\\u003c');
    web.current?.injectJavaScript(`window.setAreas && window.setAreas(${payload}); true;`);
  }, [ready, areas]);

  // Sem alfinete, o mapa abre no bairro do cadastro.
  useEffect(() => {
    if (pins.length || center) return;
    const ctrl = new AbortController();
    void locate(area, ctrl.signal).then((p) => setCenter(p ?? { lat: -15.78, lng: -47.93 }));
    return () => ctrl.abort();
  }, [pins.length, center, area.cep, area.neighborhood, area.city, area.state]);

  if (Platform.OS === 'web') {
    return (
      <Txt variant="small" muted>
        O mapa funciona no app instalado. Aqui, use a lista abaixo.
      </Txt>
    );
  }
  if (!pins.length && !center) {
    return (
      <View style={[s.map, s.center]}>
        <Txt variant="small" muted>
          Carregando mapa...
        </Txt>
      </View>
    );
  }

  return (
    <View style={{ gap: space.xs }}>
      <View style={s.map}>
        <WebView
          ref={web}
          onLoadStart={() => setReady(false)}
          onLoadEnd={() => setReady(true)}
          originWhitelist={['*']}
          source={{ html: html(pins, center) }}
          onMessage={(e) => {
            const id = e.nativeEvent.data;
            if (pins.some((p) => p.id === id)) router.push(`/acoes/${id}`);
          }}
          nestedScrollEnabled
        />
      </View>
      <View style={s.legend}>
        <IconPin size={14} color={color.textMuted} />
        <Txt variant="small" muted>
          {pins.length
            ? `${pins.length} ${pins.length === 1 ? 'ação' : 'ações'} no mapa. Toque no alfinete.`
            : 'Nenhuma ação com ponto marcado ainda.'}
          {without > 0 ? ` ${without} sem ponto: veja na lista.` : ''}
        </Txt>
      </View>
      {areaTotal > 0 ? (
        <View style={s.legend}>
          <View style={[s.swatch, { backgroundColor: color.accent }]} />
          <Txt variant="small" muted>
            seu bairro
          </Txt>
          <View style={[s.swatch, { backgroundColor: color.primary }]} />
          <Txt variant="small" muted style={{ flex: 1 }}>
            {areaTotal === 1 ? 'bairro com membros' : `${areaTotal} bairros com membros`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

type Pin = { id: string; lat: number; lng: number; t: string; s: string };

function html(pins: Pin[], center: Point | null): string {
  // Título vem de membro: vai como dado JSON (com "<" escapado) e entra na
  // página por textContent, nunca como HTML.
  const data = JSON.stringify({ pins, center }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;font-family:sans-serif}
.p b{display:block;font-size:14px;margin-bottom:2px}.p span{display:block;color:#666;font-size:12px}
.lb{background:rgba(255,255,255,.88);border:0;border-radius:6px;box-shadow:none;padding:2px 6px;text-align:center;font-size:11px;line-height:1.25}
.lb b{display:block;font-size:12px}
.p button{margin-top:6px;border:0;border-radius:6px;padding:6px 12px;background:${color.primary};color:#fff;font-size:13px}</style>
</head><body><div id="m"></div><script>
var D=${data};
var map=L.map('m');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var pts=[];
D.pins.forEach(function(p){
  var box=document.createElement('div');box.className='p';
  var b=document.createElement('b');b.textContent=p.t;box.appendChild(b);
  var sp=document.createElement('span');sp.textContent=p.s;box.appendChild(sp);
  var bt=document.createElement('button');bt.textContent='Abrir';
  bt.onclick=function(){window.ReactNativeWebView.postMessage(p.id)};box.appendChild(bt);
  L.marker([p.lat,p.lng]).addTo(map).bindPopup(box);
  pts.push([p.lat,p.lng]);
});
if(pts.length>1){map.fitBounds(pts,{padding:[32,32],maxZoom:16})}
else if(pts.length===1){map.setView(pts[0],15)}
else{map.setView([D.center.lat,D.center.lng],14)}
var areaLayer=L.layerGroup().addTo(map);var fitted=pts.length>0;
window.setAreas=function(list){
  areaLayer.clearLayers();
  list.forEach(function(a){
    var col=a.m?'${color.accent}':'${color.primary}';
    var op=0.15+Math.min(a.c,20)/20*0.35;
    var st={color:col,weight:2,fillColor:col,fillOpacity:op};
    var lyr=a.g?L.geoJSON(a.g,{style:function(){return st}}):L.circle([a.lat,a.lng],Object.assign({radius:600},st));
    lyr.addTo(areaLayer);
    var t=document.createElement('div');
    var b=document.createElement('b');b.textContent=a.n;t.appendChild(b);
    t.appendChild(document.createTextNode(a.c+(a.c===1?' membro':' membros')));
    L.tooltip({permanent:true,direction:'center',className:'lb',interactive:false}).setLatLng([a.lat,a.lng]).setContent(t).addTo(areaLayer);
    if(a.m&&!fitted){fitted=true;try{map.fitBounds(lyr.getBounds(),{padding:[24,24],maxZoom:15})}catch(e){}}
  });
};
</script></body></html>`;
}

const s = StyleSheet.create({
  map: {
    height: 280,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, opacity: 0.6 },
});
