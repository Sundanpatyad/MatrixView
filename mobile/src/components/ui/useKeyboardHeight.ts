import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

function heightFromEvent(event: KeyboardEvent) {
  const windowHeight = Dimensions.get('window').height;
  return Math.max(0, windowHeight - event.endCoordinates.screenY);
}

/**
 * Keyboard overlap from the bottom of the window. Works inside Modals, where
 * Android `adjustResize` and KeyboardAvoidingView typically do nothing.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => setHeight(heightFromEvent(event));
    const onHide = () => setHeight(0);

    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    const frame =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardWillChangeFrame', onShow) : null;

    return () => {
      show.remove();
      hide.remove();
      frame?.remove();
    };
  }, []);

  return height;
}
