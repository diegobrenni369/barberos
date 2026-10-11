import { useState } from "react";
import { View } from "react-native";

// Same visual recipe as web: 45° diagonal, 1px line every 8px, 5% neutral ink.
export function UnavailablePattern({ height }: { height: number }) {
  const [width, setWidth] = useState(0);
  const step = 8 * Math.SQRT2;
  const length = Math.hypot(width, height) * 2;
  return <View pointerEvents="none" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ position: "absolute", inset: 0, overflow: "hidden", backgroundColor: "#fafafa" }}>
    {width > 0 && Array.from({ length: Math.ceil((height + width) / step) + 2 }, (_, index) => <View key={index} style={{ position: "absolute", left: (width - length) / 2, top: index * step - width / 2, width: length, height: 1, backgroundColor: "rgba(115,115,115,0.05)", transform: [{ rotate: "-45deg" }] }} />)}
  </View>;
}
