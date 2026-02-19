import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);

  const settingsSections: {
    title: string;
    items: { icon: IconSymbolName; label: string; action: () => void; showArrow?: boolean; toggle?: boolean; value?: boolean; onToggle?: (val: boolean) => void }[];
  }[] = [
    {
      title: 'Account',
      items: [
        { 
          icon: 'person', 
          label: 'Edit Profile', 
          action: () => Alert.alert('Edit Profile', 'Profile editing coming soon'),
          showArrow: true,
        },
        { 
          icon: 'key', 
          label: 'Change Password', 
          action: () => Alert.alert('Change Password', 'Password change coming soon'),
          showArrow: true,
        },
        { 
          icon: 'envelope', 
          label: 'Email Preferences', 
          action: () => Alert.alert('Email Preferences', 'Email settings coming soon'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { 
          icon: 'bell', 
          label: 'Push Notifications', 
          action: () => {},
          toggle: true,
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        { 
          icon: 'envelope', 
          label: 'Email Notifications', 
          action: () => {},
          toggle: true,
          value: emailNotifications,
          onToggle: setEmailNotifications,
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { 
          icon: 'location', 
          label: 'Location Services', 
          action: () => {},
          toggle: true,
          value: locationServices,
          onToggle: setLocationServices,
        },
        { 
          icon: 'lock', 
          label: 'Privacy Settings', 
          action: () => Alert.alert('Privacy Settings', 'Privacy settings coming soon'),
          showArrow: true,
        },
        { 
          icon: 'shield', 
          label: 'Two-Factor Authentication', 
          action: () => Alert.alert('2FA', 'Two-factor authentication setup coming soon'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'App',
      items: [
        { 
          icon: 'info.circle', 
          label: 'About', 
          action: () => Alert.alert('Vantage Parking', 'Version 1.0.0\n© 2026 Vantage Parking'),
          showArrow: true,
        },
        { 
          icon: 'doc.text', 
          label: 'Terms of Service', 
          action: () => Alert.alert('Terms', 'Opening terms of service...'),
          showArrow: true,
        },
        { 
          icon: 'hand.raised', 
          label: 'Privacy Policy', 
          action: () => Alert.alert('Privacy', 'Opening privacy policy...'),
          showArrow: true,
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#10b981" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {settingsSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            {section.items.map((item, itemIdx) => (
              <TouchableOpacity
                key={itemIdx}
                style={styles.settingItem}
                onPress={item.action}
                disabled={item.toggle}
              >
                <IconSymbol name={item.icon} size={24} color="#10b981" />
                <Text style={styles.settingLabel}>{item.label}</Text>
                
                {item.toggle && item.onToggle && (
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: '#334155', true: '#10b981' }}
                    thumbColor={item.value ? '#ffffff' : '#94a3b8'}
                  />
                )}
                
                {item.showArrow && (
                  <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: 'white',
  },
});
