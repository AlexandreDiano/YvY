import type { ColorValue } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { isDark } from '@/ui/theme';

/**
 * Marca do YvY, gerada de assets/yvy-logo.svg.
 *
 * Vetor em vez do PNG porque fica nítido em qualquer tamanho, não precisa de
 * @2x/@3x e pesa uns 3 KB no bundle. O PNG continua existindo para o que exige
 * raster: ícone de loja, splash e favicon (ver scripts/gen-icons.py).
 *
 * Não recolorir a marca, as cores são do logo e não dos tokens da interface.
 * O modo escuro tem versão própria (assets/yvy-logo-dark.svg): letras creme,
 * broto verde, terra cor de barro e fundo verde-noite.
 */

export const BRAND = {
  green: '#1E7440',
  soil: '#612D00',
  cream: '#FBF3DF',
} as const;

/** Marca no escuro (assets/yvy-logo-dark.svg). */
export const BRAND_DARK = {
  letters: '#FBF3DF',
  sprout: '#5FB878',
  soil: '#C9773A',
  night: '#13251A',
} as const;

const INK = isDark
  ? { letters: BRAND_DARK.letters, sprout: BRAND_DARK.sprout, soil: BRAND_DARK.soil }
  : { letters: BRAND.green, sprout: BRAND.green, soil: BRAND.soil };

const LETTERS =
  'M702 582.378V696.633C702 699.395 704.239 701.66 707 701.66H737L760.453 701.881C763.233 701.907 765.5 699.661 765.5 696.881V582.423C765.5 581.594 765.706 580.779 766.099 580.049L853.023 418.873C854.82 415.542 852.407 411.5 848.623 411.5H793.073C791.188 411.5 789.463 412.56 788.612 414.242L738.936 512.395C737.09 516.042 731.886 516.054 730.024 512.415L679.766 414.222C678.911 412.551 677.192 411.5 675.315 411.5H612.5H583.477C581.387 411.5 579.517 412.8 578.79 414.759L522.997 565L514.808 587.053C513.18 591.437 506.961 591.386 505.405 586.976L444.677 414.837C443.972 412.837 442.082 411.5 439.962 411.5H394H348.553C346.678 411.5 344.962 412.548 344.105 414.216L293.477 512.783C291.612 516.415 286.416 516.401 284.57 512.759L234.889 414.74C234.037 413.059 232.313 412 230.429 412H174.383C170.597 412 168.184 416.045 169.983 419.376L256.399 579.388C256.794 580.118 257 580.934 257 581.764V698C257 700.761 259.239 703 262 703H316C318.761 703 321 700.761 321 698V581.761C321 580.933 321.206 580.118 321.598 579.39L388.613 454.999C390.676 451.17 396.306 451.619 397.736 455.726L482.331 698.573C483.031 700.582 484.926 701.928 487.053 701.928H537.923C540.062 701.928 541.964 700.568 542.655 698.543L625.828 454.836C627.244 450.686 632.936 450.24 634.982 454.118L701.422 580.065C701.802 580.785 702 581.565 702 582.378Z';
const SPROUT =
  'M510 411.5V590.5C512.8 590.5 514.167 589.167 514.5 588.5L522.997 565L524 407C588.4 398.6 598.833 346.167 596 321C540.8 321.4 516.667 367.5 511.5 390.5C487.5 353.7 456.167 352.833 443.5 357C445.1 397.4 488.5 410.167 510 411.5Z';
const SOIL_1 =
  'M765.5 607.221V697.003C765.5 699.765 763.261 702.003 760.5 702.003H707C704.239 702.003 702 699.765 702 697.003V616.028C702 613.46 703.965 611.352 706.446 610.686C707.587 610.38 708.693 609.988 709.5 609.503C712 608.003 715.5 604.503 724 609.503C732.5 614.503 733.5 618.503 749.5 615.503C762.3 613.103 765.5 608.981 765.5 607.221Z';
const SOIL_2 =
  'M441.856 582.811C440.868 579.984 442.569 576.969 445.531 576.534C462.213 574.083 499.801 571.343 502 577.5C505.04 586.011 506.889 594.537 515.397 588C518 586 526.144 577 533.821 574C541.498 571 547.128 567 556.34 569.5C565.552 572 571.182 572.5 575.788 572.5C577.223 572.5 578.704 572.652 580.069 572.866C582.822 573.299 584.267 576.157 583.371 578.795L542.652 698.612C541.963 700.639 540.06 702.003 537.918 702.003H487.049C484.924 702.003 483.03 700.659 482.329 698.652L441.856 582.811Z';
const SOIL_3 =
  'M257 605.003C257 602.242 258.41 598.316 260.058 596.1C263.617 591.313 269.986 584.836 279 593.503C292 606.003 296.5 593.503 303.5 611.003C310.5 628.503 314 595.503 317.5 593.503C320.3 591.903 321 587.17 321 585.003V698.003C321 700.765 318.761 703.003 316 703.003H262C259.239 703.003 257 700.765 257 698.003V605.003Z';

type Props = {
  size?: number;
  /** 'full' traz o fundo creme do logo; 'glyph' sai transparente. */
  variant?: 'full' | 'glyph';
  /** Só para o fundo do variant 'full'. */
  background?: ColorValue;
};

export function YvyLogo({ size = 120, variant = 'glyph', background = isDark ? BRAND_DARK.night : BRAND.cream }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="YvY"
    >
      {variant === 'full' ? (
        <Rect width={1024} height={1024} fill={background} />
      ) : null}
      <Path d={LETTERS} fill={INK.letters} />
      <Path d={SPROUT} fill={INK.sprout} />
      <Path d={SOIL_1} fill={INK.soil} />
      <Path d={SOIL_2} fill={INK.soil} />
      <Path d={SOIL_3} fill={INK.soil} />
    </Svg>
  );
}

/**
 * Versão recortada para lugar apertado (cabeçalho). Corta a margem sobrando do
 * viewBox e deixa a marca ocupar a altura toda.
 */
export function YvyMark({ size = 32 }: { size?: number }) {
  return (
    <Svg
      width={size * 2.1}
      height={size}
      viewBox="160 300 700 410"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="YvY"
    >
      <Path d={LETTERS} fill={INK.letters} />
      <Path d={SPROUT} fill={INK.sprout} />
      <Path d={SOIL_1} fill={INK.soil} />
      <Path d={SOIL_2} fill={INK.soil} />
      <Path d={SOIL_3} fill={INK.soil} />
    </Svg>
  );
}
