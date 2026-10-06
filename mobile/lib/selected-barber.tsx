import { createContext, useContext, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { useAuth } from "./auth";

const Context = createContext<{ barberId: string | null; setBarberId: Dispatch<SetStateAction<string | null>> } | null>(null);
export function SelectedBarberProvider({ children }: { children: ReactNode }) {
  const [barberId, setBarberId] = useState<string | null>(null);
  const { session } = useAuth();
  return <Context.Provider value={{ barberId: session?.role === "BARBER" ? session.barberId : barberId, setBarberId }}>{children}</Context.Provider>;
}
export function useSelectedBarber() {
  const value = useContext(Context);
  if (!value) throw new Error("SelectedBarberProvider required");
  return value;
}
