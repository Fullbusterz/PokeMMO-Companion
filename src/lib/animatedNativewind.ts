import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

// Nativewind auto-wires `className` -> `style` only for the base React
// Native primitives it registers internally (View, Text, Pressable, ...) —
// Reanimated's own Animated.View/Text/Image aren't in that list, so without
// this, any `<Animated.View className="...">` in the app silently renders
// with zero Tailwind styles applied (verified: every Card and screen wrapper
// rendered as an unstyled, borderless box in the web preview until this was
// added). Side-effect only — import once, before anything renders.
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.Image, { className: 'style' });
