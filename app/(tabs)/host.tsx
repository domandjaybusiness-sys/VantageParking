import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HostScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Host</Text>
      <Text style={styles.subtitle}>List your driveway and manage availability here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: 'white', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8' },
});
