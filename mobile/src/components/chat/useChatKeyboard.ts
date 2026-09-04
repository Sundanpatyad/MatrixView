import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type KeyboardEventEasing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ANDROID_DURATION_MS = 250;
const OPEN_THRESHOLD = 48;

function easingFor(kind?: KeyboardEventEasing) {
  if (kind === 'linear') return Easing.linear;
  if (kind === 'easeIn') return Easing.in(Easing.ease);
  if (kind === 'easeOut') return Easing.out(Easing.ease);
  if (kind === 'easeInEaseOut') return Easing.inOut(Easing.ease);
  // Matches the stock iOS keyboard curve closely enough to feel native.
  return Easing.bezier(0.17, 0.59, 0.4, 0.77);
}

function liftFromEvent(event: KeyboardEvent) {
  const windowHeight = Dimensions.get('window').height;
  return Math.max(0, windowHeight - event.endCoordinates.screenY);
}

/**
 * WhatsApp-style keyboard tracking: the returned `lift` follows the keyboard
 * frame, including iOS interactive swipe-to-dismiss (duration 0 frames).
 */
export function useChatKeyboard() {
  const insets = useSafeAreaInsets();
  const lift = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const restBottom = Math.max(insets.bottom, 10);

  useEffect(() => {
    const animateTo = (toValue: number, event?: KeyboardEvent) => {
      const duration =
        Platform.OS === 'ios' ? event?.duration ?? 0 : ANDROID_DURATION_MS;
      if (duration <= 0) {
        lift.stopAnimation();
        lift.setValue(toValue);
        return;
      }
      Animated.timing(lift, {
        toValue,
        duration,
        easing: easingFor(event?.easing),
        useNativeDriver: false,
      }).start();
    };

    const onFrame = (event: KeyboardEvent) => {
      const next = liftFromEvent(event);
      setOpen(next > OPEN_THRESHOLD);
      animateTo(next, event);
    };

    const onHide = (event: KeyboardEvent) => {
      setOpen(false);
      animateTo(0, event);
    };

    if (Platform.OS === 'ios') {
      const frame = Keyboard.addListener('keyboardWillChangeFrame', onFrame);
      return () => frame.remove();
    }

    const show = Keyboard.addListener('keyboardDidShow', onFrame);
    const hide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [lift]);

  const composerPadding = useMemo(
    () =>
      lift.interpolate({
        inputRange: [0, OPEN_THRESHOLD],
        outputRange: [restBottom, 8],
        extrapolate: 'clamp',
      }),
    [lift, restBottom],
  );

  return { lift, composerPadding, open, restBottom };
}
