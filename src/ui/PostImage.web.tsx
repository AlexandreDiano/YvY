import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Txt } from '@/ui/Text';
import { radius, space } from '@/ui/tokens';

/**
 * Foto de post no site. Mesmo comportamento do PostImage.tsx, sem
 * reanimated/gesture-handler: os dois somavam ~950 KB ao JS inicial do site
 * só por causa do zoom de pinça. Aqui o toque alterna o zoom e o arrastar é
 * a rolagem do navegador.
 */
export function PostImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(4 / 3);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const { width, height } = useWindowDimensions();
  const k = zoom ? 2.5 : 1;

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Abrir foto" onPress={() => setOpen(true)}>
        <Image
          source={{ uri }}
          resizeMode="contain"
          onLoad={(e) => {
            const src = e.nativeEvent.source;
            if (src?.width && src?.height) setRatio(Math.max(0.6, Math.min(2, src.width / src.height)));
          }}
          style={[s.thumb, { aspectRatio: ratio }]}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpen(false);
          setZoom(false);
        }}
      >
        <ScrollView style={s.full} contentContainerStyle={{ width: width * k, height: height * k }} horizontal={false}>
          <ScrollView horizontal contentContainerStyle={{ width: width * k, height: height * k }}>
            <Pressable onPress={() => setZoom((z) => !z)} accessibilityLabel={zoom ? 'Diminuir' : 'Aumentar'}>
              <Image source={{ uri }} resizeMode="contain" style={{ width: width * k, height: height * k }} />
            </Pressable>
          </ScrollView>
        </ScrollView>
        <Pressable
          style={s.close}
          onPress={() => {
            setOpen(false);
            setZoom(false);
          }}
          accessibilityRole="button"
        >
          <Txt variant="label" tone="onPrimary" upper>
            Fechar
          </Txt>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  thumb: { width: '100%', borderRadius: radius.sm, backgroundColor: '#00000010' },
  full: { flex: 1, backgroundColor: '#000' },
  close: {
    position: 'absolute',
    top: space.xxl,
    right: space.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: '#00000099',
    borderRadius: radius.pill,
  },
});
