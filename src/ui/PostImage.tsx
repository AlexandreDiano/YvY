import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '@/ui/Text';
import { radius, space } from '@/ui/tokens';

/**
 * Foto de post: no feed aparece inteira (proporção real, sem cortar); tocar
 * abre em tela cheia com zoom de pinça e arrastar. Toque duplo volta ao normal.
 */
export function PostImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(4 / 3);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Abrir foto" onPress={() => setOpen(true)}>
        <Image
          source={{ uri }}
          resizeMode="contain"
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source;
            if (width && height) setRatio(Math.max(0.6, Math.min(2, width / height)));
          }}
          style={[s.thumb, { aspectRatio: ratio }]}
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <GestureHandlerRootView style={s.full}>
          <Zoomable uri={uri} />
          <Pressable style={s.close} onPress={() => setOpen(false)} accessibilityRole="button">
            <Txt variant="label" tone="onPrimary" upper>
              Fechar
            </Txt>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

function Zoomable({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(5, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = sx.value + e.translationX;
      y.value = sy.value + e.translationY;
    })
    .onEnd(() => {
      sx.value = x.value;
      sy.value = y.value;
    });
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      saved.value = 1;
      x.value = withTiming(0);
      y.value = withTiming(0);
      sx.value = 0;
      sy.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, reset)}>
      <Animated.View style={[s.full, style]}>
        <Image source={{ uri }} resizeMode="contain" style={s.full} />
      </Animated.View>
    </GestureDetector>
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

