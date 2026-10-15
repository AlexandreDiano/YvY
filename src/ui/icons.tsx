import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '@/ui/tokens';

/**
 * Ícones em SVG próprio em vez de @expo/vector-icons, que baixaria ~1 MB de
 * fonte de ícone num app que precisa abrir no 3G. Traço de 1.6 sem
 * preenchimento, para ficarem todos da mesma família.
 */

type P = { size?: number; color?: ColorValue };

const S = (p: P) => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.color ?? color.text,
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconHome(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1z" />
    </Svg>
  );
}

export function IconPin(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function IconChat(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M4 6h16v10H9l-5 4z" />
    </Svg>
  );
}

export function IconBallot(p: P) {
  return (
    <Svg {...S(p)}>
      <Rect x="3" y="10" width="18" height="10" rx="1.5" />
      <Path d="M8 10V5h8v5" />
      <Path d="M9.5 14.5l1.8 1.8 3.2-3.6" />
    </Svg>
  );
}

export function IconUser(p: P) {
  return (
    <Svg {...S(p)}>
      <Circle cx="12" cy="8" r="3.5" />
      <Path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.8 1.6 7 5.2" />
    </Svg>
  );
}

export function IconSearch(p: P) {
  return (
    <Svg {...S(p)}>
      <Circle cx="11" cy="11" r="6" />
      <Path d="M15.5 15.5L20 20" />
    </Svg>
  );
}

export function IconShare(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M12 3v11" />
      <Path d="M8.5 6.5L12 3l3.5 3.5" />
      <Path d="M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" />
    </Svg>
  );
}

export function IconFlag(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M6 21V4" />
      <Path d="M6 4h11l-1.8 4L17 12H6z" />
    </Svg>
  );
}

export function IconCheck(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}

export function IconCamera(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <Circle cx="12" cy="13" r="3.2" />
    </Svg>
  );
}

export function IconBack(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M14 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconEye(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(p: P) {
  return (
    <Svg {...S(p)}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
      <Path d="M4 4l16 16" />
    </Svg>
  );
}
