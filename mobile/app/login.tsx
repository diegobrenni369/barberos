import { useRef, useState } from "react";
import { Redirect } from "expo-router";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { Button, Input, styles } from "../components/ui";

export default function Login() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (session) return <Redirect href="/agenda" />;
  async function submit() {
    if (lock.current) return;
    if (!email.trim() || !password) { setError("Ingresa tu correo y contraseña."); return; }
    lock.current = true; setBusy(true); setError("");
    try { await login(email.trim(), password); setPassword(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo iniciar sesión."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "center" }]}>
    <View style={{ gap: 8 }}><Text style={styles.muted}>BarberOS</Text><Text style={styles.title}>Inicia sesión</Text><Text style={styles.muted}>Accede con tu cuenta de propietario.</Text></View>
    <Input label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" editable={!busy} />
    <Input label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Button title="Ingresar" loading={busy} onPress={() => { Keyboard.dismiss(); void submit(); }} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
