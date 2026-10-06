import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth";
export default function AppLayout() { return useAuth().session ? <Stack screenOptions={{ headerShown: false }} /> : <Redirect href="/login" />; }
