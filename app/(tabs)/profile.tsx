import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const [showSupportModal, setShowSupportModal] = useState(false);
  
  // fake user data for UI layout; in a real app this would come from state/props
  const user = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    rating: 4.9,
    emailVerified: true,
    phoneVerified: false,
  };

  const handleMenuPress = (title: string) => {
    switch (title) {
      case 'Wallet':
        router.push('/wallet');
        break;
      case 'Parking History':
        router.push('/bookings');
        break;
      case 'Settings':
        router.push('/settings');
        break;
      case 'Help':
        setShowSupportModal(true);
        break;
      case 'Log Out':
        handleLogOut();
        break;
    }
  };

  const handleLogOut = () => {
    Alert.alert(
      'Log out?',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            // In production: auth.signOut() or similar
            Alert.alert('Logged out', 'You have been logged out successfully');
          },
        },
      ]
    );
  };

  const handleEmailVerification = () => {
    if (user.emailVerified) {
      Alert.alert('Email Verified', 'Your email is already verified');
    } else {
      // In production: call sendEmailVerification()
      Alert.alert('Verification Email Sent', 'Please check your email for the verification link');
    }
  };

  const handlePhoneVerification = () => {
    if (user.phoneVerified) {
      Alert.alert('Phone Verified', 'Your phone is already verified');
    } else {
      // Navigate to phone verification screen
      Alert.alert('Phone Verification', 'Phone verification screen coming soon');
    }
  };

  const handleSupportOption = (option: string) => {
    setShowSupportModal(false);
    switch (option) {
      case 'email':
        Linking.openURL('mailto:support@vantageparking.com?subject=Support%20Request');
        break;
      case 'phone':
        Linking.openURL('tel:+18005551234');
        break;
    }
  };

  const handleLegalLink = (type: 'terms' | 'privacy') => {
    const url = type === 'terms' 
      ? 'https://vantageparking.com/terms'
      : 'https://vantageparking.com/privacy';
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  };

  // make sure icons match the names defined in IconSymbol
  const menuItems: { title: string; icon: IconSymbolName }[] = [
    { title: 'Wallet', icon: 'creditcard' },
    { title: 'Parking History', icon: 'clock' },
    { title: 'Settings', icon: 'gearshape' },
    { title: 'Help', icon: 'questionmark.circle' },
    { title: 'Log Out', icon: 'rectangle.portrait.and.arrow.right' },
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
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => handleMenuPress(item.title)}
          >
            <IconSymbol name={item.icon} size={20} color="#94a3b8" />
            <Text style={styles.menuItemText}>{item.title}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>
        ))}
      </View>
      
      {/* Verification Section */}
      <View style={{ padding: 16 }}>
        <Text style={{ color: 'white', fontWeight: '700', marginBottom: 8 }}>Verification</Text>
        <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, gap: 12 }}>
          <Pressable
            onPress={handleEmailVerification}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <IconSymbol 
              name={user.emailVerified ? 'checkmark.circle.fill' : 'xmark.circle'} 
              size={20} 
              color={user.emailVerified ? '#10b981' : '#94a3b8'} 
            />
            <Text style={{ color: '#94a3b8', flex: 1 }}>Email</Text>
            {!user.emailVerified && <Text style={{ color: '#10b981', fontSize: 14 }}>Verify</Text>}
          </Pressable>
          
          <Pressable
            onPress={handlePhoneVerification}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <IconSymbol 
              name={user.phoneVerified ? 'checkmark.circle.fill' : 'xmark.circle'} 
              size={20} 
              color={user.phoneVerified ? '#10b981' : '#94a3b8'} 
            />
            <Text style={{ color: '#94a3b8', flex: 1 }}>Phone</Text>
            {!user.phoneVerified && <Text style={{ color: '#10b981', fontSize: 14 }}>Verify</Text>}
          </Pressable>
        </View>

        {/* Support Section */}
        <Text style={{ color: 'white', fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Support</Text>
        <Pressable
          onPress={() => setShowSupportModal(true)}
          style={({ pressed }) => [
            { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <Text style={{ color: '#94a3b8' }}>Contact support for payments, bookings, or hosts.</Text>
          <Text style={{ color: '#10b981', marginTop: 4, fontSize: 14 }}>Get Help →</Text>
        </Pressable>

        {/* Legal Section */}
        <Text style={{ color: 'white', fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Legal</Text>
        <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={() => handleLegalLink('terms')}>
            <Text style={{ color: '#10b981', fontSize: 14 }}>Terms of Service</Text>
          </Pressable>
          <Text style={{ color: '#94a3b8' }}>·</Text>
          <Pressable onPress={() => handleLegalLink('privacy')}>
            <Text style={{ color: '#10b981', fontSize: 14 }}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>

      {/* Support Modal */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setShowSupportModal(false)}
        >
          <View style={styles.supportModal}>
            <Text style={styles.supportModalTitle}>Contact Support</Text>
            <Text style={styles.supportModalSubtitle}>How would you like to reach us?</Text>
            
            <TouchableOpacity
              style={styles.supportOption}
              onPress={() => handleSupportOption('email')}
            >
              <IconSymbol name="envelope" size={24} color="#10b981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Email</Text>
                <Text style={styles.supportOptionSubtitle}>support@vantageparking.com</Text>
              </View>
              <Text style={styles.supportOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportOption}
              onPress={() => handleSupportOption('phone')}
            >
              <IconSymbol name="phone" size={24} color="#10b981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Phone</Text>
                <Text style={styles.supportOptionSubtitle}>1-800-555-1234</Text>
              </View>
              <Text style={styles.supportOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportCancelButton}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.supportCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
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
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuItemText: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 16, 
    color: 'white' 
  },
  menuItemArrow: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  supportModal: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  supportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  supportModalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  supportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  supportOptionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  supportOptionArrow: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  supportCancelButton: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  supportCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
