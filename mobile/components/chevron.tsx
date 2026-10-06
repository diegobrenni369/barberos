import { View } from "react-native";
import { colors } from "./ui";

export function Check({ size = 18 }: { size?: number }) {
  return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: size * 0.3, height: size * 0.6, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.text, transform: [{ rotate: "45deg" }, { translateY: -2 }] }} />
  </View>;
}

// Small native vector-like icon; no font glyph or additional dependency.
export function Chevron({ direction, size = 22 }: { direction: "left" | "right" | "down"; size?: number }) {
  const rotation = direction === "left" ? "135deg" : direction === "right" ? "-45deg" : "45deg";
  return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: size * 0.38, height: size * 0.38, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.text, transform: [{ rotate: rotation }] }} />
  </View>;
}
