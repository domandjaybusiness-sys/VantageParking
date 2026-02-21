import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import LoadingOverlay from '@/components/ui/loading-overlay';
import { useTheme } from '@/contexts/ThemeContext';
import { clearAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { colorScheme, themePreference, setThemePreference, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showSupportModal, setShowSupportModal] = useState(false);
  
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified] = useState(false);
  const userRating = 4.9;
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      setLoadingProfile(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setUserName('Signed out');
          setUserEmail('');
          setEmailVerified(false);
          return;
        }

        const name =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email ||
          'Vantage member';

        setUserName(String(name));
        setUserEmail(user.email ?? '');
        setEmailVerified(Boolean(user.email_confirmed_at));
      } finally {
        setLoadingProfile(false);
      }
    };

    loadUser();
  }, []);

  const handleMenuPress = (title: string) => {
    switch (title) {
      case 'Wallet':
        router.push('/wallet');
        break;
      case 'Parking History':
        router.push('/host');
        break;
      case 'Reservations':
        router.push('/reservations');
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
          onPress: async () => {
            await clearAuth();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleEmailVerification = () => {
    if (emailVerified) {
      Alert.alert('Email Verified', 'Your email is already verified');
    } else {
      // In production: call sendEmailVerification()
      Alert.alert('Verification Email Sent', 'Please check your email for the verification link');
    }
  };

  const handlePhoneVerification = () => {
    if (phoneVerified) {
      Alert.alert('Phone Verified', 'Your phone is already verified');
    } else {
      // Navigate to settings where phone can be managed
      router.push('/settings');
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
    { title: 'Reservations', icon: 'clock' },
    { title: 'Wallet', icon: 'creditcard' },
    { title: 'Parking History', icon: 'clock' },
    { title: 'Settings', icon: 'gearshape' },
    { title: 'Help', icon: 'questionmark.circle' },
    { title: 'Log Out', icon: 'rectangle.portrait.and.arrow.right' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8 }}
    >
      <LoadingOverlay visible={loadingProfile} text="Loading profile…" />
      <AnimatedListItem index={0} direction="down">
        <View style={[styles.profileHeader, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <IconSymbol name="person.crop.circle" size={96} color={colors.text} />
          <Text style={[styles.name, { color: colors.text }]}>{userName}</Text>
          {userEmail ? (
            <Text style={[styles.email, { color: colors.textSecondary }]}>{userEmail}</Text>
          ) : null}
          <TouchableOpacity style={[styles.editProfileBtn, { borderColor: colors.border }]} onPress={() => router.push('/settings')} activeOpacity={0.8}>
            <Text style={[styles.editProfileText, { color: colors.primary }]}>Edit profile</Text>
          </TouchableOpacity>
          <Text style={[styles.rating, { color: colors.primary }]}>{userRating.toFixed(1)} ★</Text>
        </View>
      </AnimatedListItem>

      {/* Theme Toggle Section */}
      <View style={styles.themeSection}>
        <AnimatedListItem index={1} direction="up">
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={[styles.themeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === 'light' && styles.themeOptionActive,
                { borderColor: themePreference === 'light' ? colors.primary : 'transparent' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setThemePreference('light');
              }}
              activeOpacity={0.7}
            >
              <IconSymbol name="sun.max" size={28} color={themePreference === 'light' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: themePreference === 'light' ? colors.primary : colors.textSecondary }
              ]}>Light</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === 'dark' && styles.themeOptionActive,
                { borderColor: themePreference === 'dark' ? colors.primary : 'transparent' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setThemePreference('dark');
              }}
              activeOpacity={0.7}
            >
              <IconSymbol name="moon" size={28} color={themePreference === 'dark' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: themePreference === 'dark' ? colors.primary : colors.textSecondary }
              ]}>Dark</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === 'auto' && styles.themeOptionActive,
                { borderColor: themePreference === 'auto' ? colors.primary : 'transparent' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setThemePreference('auto');
              }}
              activeOpacity={0.7}
            >
              <IconSymbol name="sparkles" size={28} color={themePreference === 'auto' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: themePreference === 'auto' ? colors.primary : colors.textSecondary }
              ]}>Auto</Text>
            </TouchableOpacity>
          </View>
          {themePreference === 'auto' && (
            <Text style={[styles.themeHint, { color: colors.textSecondary }]}>
              Currently using {colorScheme} mode based on system settings
            </Text>
          )}
        </AnimatedListItem>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <AnimatedListItem key={item.title} index={index + 2} direction="up">
            <AnimatedPressableButton
              style={[styles.menuItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
              onPress={() => handleMenuPress(item.title)}
            >
              <IconSymbol name={item.icon} size={20} color={colors.textSecondary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
            </AnimatedPressableButton>
          </AnimatedListItem>
        ))}
      </View>
      
      {/* Verification Section */}
      <View style={{ padding: 16 }}>
        <Text style={[{ fontWeight: '700', marginBottom: 8 }, { color: colors.text }]}>Verification</Text>
        <View style={[{ padding: 12, borderRadius: 8, gap: 12 }, { backgroundColor: colors.backgroundCard }]}>
          <Pressable
            onPress={handleEmailVerification}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <IconSymbol 
              name={emailVerified ? 'checkmark.circle.fill' : 'xmark.circle'} 
              size={20} 
              color={emailVerified ? '#10b981' : '#94a3b8'} 
            />
            <Text style={{ color: colors.textSecondary, flex: 1 }}>Email</Text>
            {!emailVerified && <Text style={{ color: colors.primary, fontSize: 14 }}>Verify</Text>}
          </Pressable>
          
          <Pressable
            onPress={handlePhoneVerification}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <IconSymbol 
              name={phoneVerified ? 'checkmark.circle.fill' : 'xmark.circle'} 
              size={20} 
              color={phoneVerified ? colors.primary : colors.textSecondary} 
            />
            <Text style={{ color: colors.textSecondary, flex: 1 }}>Phone</Text>
            {!phoneVerified && <Text style={{ color: colors.primary, fontSize: 14 }}>Verify</Text>}
          </Pressable>
        </View>

        {/* Support Section */}
        <Text style={[{ fontWeight: '700', marginTop: 16, marginBottom: 8 }, { color: colors.text }]}>Support</Text>
        <Pressable
          onPress={() => setShowSupportModal(true)}
          style={({ pressed }) => [
            { padding: 12, borderRadius: 8, opacity: pressed ? 0.7 : 1 },
            { backgroundColor: colors.backgroundCard }
          ]}
        >
          <Text style={{ color: colors.textSecondary }}>Contact support for payments, bookings, or hosts.</Text>
          <Text style={{ color: colors.primary, marginTop: 4, fontSize: 14 }}>Get Help →</Text>
        </Pressable>

        {/* Legal Section */}
        <Text style={[{ fontWeight: '700', marginTop: 16, marginBottom: 8 }, { color: colors.text }]}>Legal</Text>
        <View style={[{ padding: 12, borderRadius: 8, flexDirection: 'row', gap: 16 }, { backgroundColor: colors.backgroundCard }]}>
          <Pressable onPress={() => handleLegalLink('terms')}>
            <Text style={{ color: colors.primary, fontSize: 14 }}>Terms of Service</Text>
          </Pressable>
          <Text style={{ color: colors.textSecondary }}>·</Text>
          <Pressable onPress={() => handleLegalLink('privacy')}>
            <Text style={{ color: colors.primary, fontSize: 14 }}>Privacy Policy</Text>
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
          <View style={[styles.supportModal, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.supportModalTitle, { color: colors.text }]}>Contact Support</Text>
            <Text style={[styles.supportModalSubtitle, { color: colors.textSecondary }]}>How would you like to reach us?</Text>
            
            <TouchableOpacity
              style={[styles.supportOption, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleSupportOption('email')}
            >
              <IconSymbol name="envelope" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.supportOptionTitle, { color: colors.text }]}>Email</Text>
                <Text style={[styles.supportOptionSubtitle, { color: colors.textSecondary }]}>support@vantageparking.com</Text>
              </View>
              <Text style={[styles.supportOptionArrow, { color: colors.textSecondary }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportOption, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleSupportOption('phone')}
            >
              <IconSymbol name="phone" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.supportOptionTitle, { color: colors.text }]}>Phone</Text>
                <Text style={[styles.supportOptionSubtitle, { color: colors.textSecondary }]}>1-800-555-1234</Text>
              </View>
              <Text style={[styles.supportOptionArrow, { color: colors.textSecondary }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={[styles.supportCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    margin: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  email: { fontSize: 14, marginTop: 2 },
  rating: { fontSize: 16, color: '#fbbf24', marginTop: 4 },
  
  themeSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  themeCard: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 2,
    gap: 8,
  },
  themeOptionActive: {
    // borderColor will be set dynamically
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  menuContainer: { paddingVertical: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuItemText: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 16, 
  },
  menuItemArrow: {
    fontSize: 24,
    fontWeight: '300',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  supportModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  supportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  supportModalSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  supportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportOptionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  supportOptionArrow: {
    fontSize: 24,
    fontWeight: '300',
  },
  supportCancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  supportCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editProfileBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
