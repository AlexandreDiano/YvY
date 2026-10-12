import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Text';
import { color, radius, space } from '@/ui/tokens';

export type Point = { lat: number; lng: number };

/**
 * Ponto de encontro da ação num mapa leve: Leaflet + OpenStreetMap dentro de
 * uma WebView (já vem no Expo, sem build nativo nem token). Toque marca o
 * ponto. Começa centrado no bairro da pessoa (Nominatim/OSM). É lugar
 * público de encontro, não endereço de ninguém.
 */
export function MeetingPointPicker({
  value,
  onChange,
  area,
}: {
  value: Point | null;
  onChange: (p: Point | null) => void;
  /** Onde a pessoa mora, do cadastro: centraliza o mapa ali. */
  area: { cep?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null };
}) {
  const [center, setCenter] = useState<Point | null>(value);

  useEffect(() => {
    if (value) return;
    const ctrl = new AbortController();
    void locate(area, ctrl.signal).then((p) => setCenter(p ?? { lat: -15.78, lng: -47.93 }));
    return () => ctrl.abort();
  }, [area.cep, area.neighborhood, area.city, area.state, value]);

  if (Platform.OS === 'web') {
    return (
      <Txt variant="small" muted>
        Marcar ponto no mapa funciona no app instalado.
      </Txt>
    );
  }
  if (!center) {
    return (
      <Txt variant="small" muted>
        Carregando mapa...
      </Txt>
    );
  }

  return (
    <View style={{ gap: space.xs }}>
      <View style={s.map}>
        <WebView
          originWhitelist={['*']}
          source={{ html: html(center, value) }}
          onMessage={(e) => {
            const [lat, lng] = e.nativeEvent.data.split(',').map(Number);
            if (Number.isFinite(lat) && Number.isFinite(lng)) onChange({ lat: lat!, lng: lng! });
          }}
          nestedScrollEnabled
        />
      </View>
      <Txt variant="small" muted>
        {value
          ? `Ponto marcado (${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}). Toque em outro lugar para mudar.`
          : 'Toque no mapa para marcar o ponto de encontro.'}
      </Txt>
      {value ? <Button title="Tirar ponto" kind="ghost" small block={false} onPress={() => onChange(null)} /> : null}
    </View>
  );
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br';

/**
 * Centro do mapa a partir do cadastro, do mais preciso ao mais amplo: CEP,
 * bairro+cidade, cidade, estado. Para no primeiro que o OpenStreetMap achar.
 */
export async function locate(
  a: { cep?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null },
  signal: AbortSignal,
): Promise<Point | null> {
  const cep = (a.cep ?? '').replace(/\D/g, '');
  const tries = [
    cep.length === 8 ? `&postalcode=${cep.slice(0, 5)}-${cep.slice(5)}` : null,
    a.neighborhood && a.city ? `&q=${encodeURIComponent(`${a.neighborhood}, ${a.city}, ${a.state ?? ''}`)}` : null,
    a.city ? `&city=${encodeURIComponent(a.city)}&state=${encodeURIComponent(a.state ?? '')}` : null,
    a.state ? `&q=${encodeURIComponent(`${a.state}, Brasil`)}` : null,
  ].filter(Boolean) as string[];
  for (const t of tries) {
    try {
      const r = await fetch(NOMINATIM + t, {
        headers: { 'User-Agent': 'Yvy/1.0 (app de organizacao de base)' },
        signal,
      });
      const j = (await r.json()) as { lat: string; lon: string }[];
      if (j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
    } catch {
      if (signal.aborted) return null;
    }
  }
  return null;
}

/** Abre o ponto no app de mapas do celular. */
export function openPoint(p: Point, label: string) {
  const q = encodeURIComponent(label);
  const url =
    Platform.OS === 'android'
      ? `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${q})`
      : Platform.OS === 'ios'
        ? `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}`
        : `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
  void Linking.openURL(url);
}

function html(center: Point, marker: Point | null): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}</style></head><body><div id="m"></div><script>
var map=L.map('m').setView([${center.lat},${center.lng}],16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var mk=${marker ? `L.marker([${marker.lat},${marker.lng}]).addTo(map)` : 'null'};
map.on('click',function(e){
  if(mk){mk.setLatLng(e.latlng)}else{mk=L.marker(e.latlng).addTo(map)}
  window.ReactNativeWebView.postMessage(e.latlng.lat+','+e.latlng.lng);
});
</script></body></html>`;
}

const s = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
  },
});
