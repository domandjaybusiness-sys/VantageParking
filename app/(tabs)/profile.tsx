import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  // fake user data for UI layout; in a real app this would come from state/props
  const user = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    rating: 4.9,
  };

  // make sure icons match the names defined in IconSymbol
  const menuItems: { title: string; icon: IconSymbolName }[] = [
    { title: 'Payments', icon: 'creditcard' },
    { title: 'Ride History', icon: 'clock' },
    { title: 'Settings', icon: 'gearshape' },
    { title: 'Help', icon: 'questionmark.circle' },
    { title: 'Log Out', icon: 'rectangle.portrait.and.arrow.right' },
  ];

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsOptions: { title: string; icon: IconSymbolName }[] = [
    { title: 'Account', icon: 'person' },
    { title: 'Privacy', icon: 'lock' },
    { title: 'Notifications', icon: 'bell' },
    { title: 'Payment', icon: 'creditcard' },
    { title: 'Help', icon: 'questionmark.circle' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.profileHeader}>
        <IconSymbol name="person.crop.circle" size={96} color="white" />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.rating}>{user.rating.toFixed(1)} ★</Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <Pressable
            key={item.title}
            style={styles.menuItem}
            onPress={() => {
              if (item.title === 'Settings') {
                setShowSettingsMenu(true);
              }
            }}
            android_ripple={{ color: '#ddd' }}>
            <IconSymbol name={item.icon as any} size={24} color="#333" />
            <Text style={styles.menuText}>{item.title}</Text>
            <IconSymbol name="chevron.right" size={24} color="#888" />
          </Pressable>
        ))}
      </View>
      {/* settings submenu overlay */}
      {showSettingsMenu && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={() => setShowSettingsMenu(false)} />
          <View style={styles.subMenu}>
            {settingsOptions.map((opt) => (
              <Pressable
                key={opt.title}
                style={styles.menuItem}
                onPress={() => {
                  // handle settings option
                  setShowSettingsMenu(false);
                }}
                android_ripple={{ color: '#eee' }}>
                <IconSymbol name={opt.icon as any} size={24} color="#333" />
                <Text style={styles.menuText}>{opt.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  profileHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    backgroundColor: '#1f2937',
  },
  name: { fontSize: 22, fontWeight: '700', color: 'white', marginTop: 8 },
  email: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  rating: { fontSize: 16, color: '#fbbf24', marginTop: 4 },
  menuContainer: { paddingVertical: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  menuText: { flex: 1, marginLeft: 12, fontSize: 16, color: '#111' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  subMenu: {
    backgroundColor: 'white',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
