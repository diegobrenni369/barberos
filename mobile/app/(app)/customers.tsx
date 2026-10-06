import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { Button, Input, Separator, colors, styles } from "../../components/ui";
import { SearchIcon } from "../../components/creation-controls";
import { Chevron } from "../../components/chevron";
import { CustomerDetail } from "../../components/customer-detail";

type Customer = { id: string; name: string; phone: string | null; nextAt: string | null };

export default function Customers() {
  const { get, session } = useAuth();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const timezone = session?.barbershop.timezone ?? "America/Santiago";
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      void get<{ customers: Customer[] }>(`/api/mobile/customers?overview=1&query=${encodeURIComponent(query.trim())}`)
        .then(result => { if (active) setCustomers(result.customers); })
        .catch(() => { if (active) setError("No se pudieron cargar los clientes."); })
        .finally(() => { if (active) setLoading(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [get, query, retry]));
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <View style={[styles.content, { padding: 16, gap: 14 }]}>
      <Text style={styles.title}>Clientes</Text>
      <View><Input label="Buscar cliente" placeholder="Nombre o teléfono" value={query} onChangeText={setQuery} maxLength={100} returnKeyType="search" onSubmitEditing={() => setRetry(value => value + 1)} style={{ paddingRight: 48 }} /><Pressable accessibilityRole="button" accessibilityLabel="Buscar cliente" onPress={() => setRetry(value => value + 1)} style={{ position: "absolute", bottom: 2, right: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SearchIcon /></Pressable></View>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Cargando clientes" style={{ padding: 24 }} /> : error ? <View style={styles.content}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></View> : <FlatList
      data={customers} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, width: "100%", maxWidth: 520, alignSelf: "center" }}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={<Text style={[styles.muted, { paddingVertical: 20 }]}>No se encontraron clientes.</Text>}
      ListFooterComponent={customers.length === 20 ? <Text style={[styles.muted, { paddingTop: 16 }]}>Mostrando hasta 20 clientes. Usa la búsqueda para encontrar otro.</Text> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver cliente ${item.name}`} onPress={() => setSelected(item.id)} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: pressed ? colors.soft : colors.background })}>
        <View style={{ flex: 1, gap: 2 }}><Text style={[styles.label, { fontSize: 15, fontWeight: "600" }]}>{item.name}</Text><Text style={[styles.muted, { fontSize: 13, lineHeight: 18 }]}>{item.phone ?? "Sin teléfono"}</Text><Text style={[styles.muted, { fontSize: 11, lineHeight: 16 }]}>{item.nextAt ? `Próxima: ${new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.nextAt))}` : "Sin próxima cita"}</Text></View><View style={{ opacity: 0.5, alignItems: "center", justifyContent: "center", width: 24 }}><Chevron direction="right" size={16} /></View>
      </Pressable>}
    />}
    {selected && <CustomerDetail key={selected} id={selected} onClose={() => setSelected(null)} />}
  </SafeAreaView>;
}
