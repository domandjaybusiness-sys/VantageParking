import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function HomeScreen() {
  const [driveways, setDriveways] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("driveways").select("*");

      if (error) setErrorMsg(error.message);
      else setDriveways(data ?? []);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Vantage Parking</Text>

        {errorMsg ? (
          <Text style={[styles.subtitle, styles.error]}>Error: {errorMsg}</Text>
        ) : (
          <Text style={styles.subtitle}>Driveways found: {driveways?.length ?? "..."}</Text>
        )}
      </View>

      {/* Home screen: list of driveways (map moved to the Map tab) */}

      {driveways && (
        <FlatList
          data={driveways}
          keyExtractor={(item, index) => (item.id?.toString?.() ?? String(index))}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.itemId}>ID: {item.id ?? "-"}</Text>
              <Text style={styles.itemTitle}>{item.title ?? item.address ?? (item.price ? `$${item.price}` : "(no title)")}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
  },
  headerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: 'center',
  },
  error: {
    color: "#fca5a5",
  },
  item: {
    backgroundColor: "#071033",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  itemId: {
    color: "#94a3b8",
    fontSize: 12,
  },
  itemTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
