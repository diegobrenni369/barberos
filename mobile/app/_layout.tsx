import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { LoadingIndicator, Button, styles } from "../components/ui";

function Routes() {
  const { loading, error, restore } = useAuth();
  if (loading) return <View style={[styles.screen, { justifyContent: "center" }]}><LoadingIndicator accessibilityLabel="Comprobando sesión" /></View>;
  if (error) return <SafeAreaView style={styles.screen}><View style={styles.content}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" onPress={() => void restore()} /></View></SafeAreaView>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
export default function RootLayout() { return <SafeAreaProvider><AuthProvider><StatusBar style="dark" /><Routes /></AuthProvider></SafeAreaProvider>; }
