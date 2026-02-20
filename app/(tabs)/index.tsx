import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { useTheme } from '@/contexts/ThemeContext';
import { mapSpotRow } from '@/lib/listings';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState('there');
  const [isHost, setIsHost] = useState(false);
  const [activeBookings, setActiveBookings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [spotCount, setSpotCount] = useState(0);
  const [topSpots, setTopSpots] = useState<{ id: string; title: string; address: string; price: number }[]>([]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.user_metadata?.name) {
        setUserName(String(user.user_metadata.name).split(' ')[0]);
      }

      const { data: allSpots } = await supabase.from('spots').select('*').order('created_at', { ascending: false });
      const mapped = (allSpots ?? []).map(mapSpotRow);
      setSpotCount(mapped.length);

      const sorted = [...mapped]
        .sort((a, b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0))
        .slice(0, 3)
        .map((s) => ({
          id: s.id,
          title: s.title,
          address: s.address,
          price: s.pricePerHour ?? 0,
        }));
      setTopSpots(sorted);

      if (!user) {
        setIsHost(false);
        setActiveBookings(0);
        setTodayEarnings(0);
        return;
      }

      const { data: hostSpots } = await supabase
        .from('spots')
        .select('id')
        .eq('host_id', user.id);

      const hostMode = (hostSpots ?? []).length > 0;
      setIsHost(hostMode);

      if (!hostMode) {
        setActiveBookings(0);
        setTodayEarnings(0);
        return;
      }

      const { data: hostBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('host_id', user.id);

      const rows = hostBookings ?? [];
      const active = rows.filter((b) => String(b?.status ?? '').toLowerCase() === 'active').length;
      setActiveBookings(active);

      const today = new Date().toDateString();
      const earnings = rows.reduce((sum, b) => {
        if (String(b?.status ?? '').toLowerCase() !== 'paid') return sum;
        const raw = b?.paid_at ?? b?.created_at ?? b?.start_time ?? b?.startTime;
        const date = raw ? new Date(raw).toDateString() : '';
        return date === today ? sum + Number(b?.amount ?? 0) : sum;
      }, 0);
      setTodayEarnings(earnings);
    };

    load();
  }, []);

  const openCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Location permission required',
          'Enable location access to find parking near you.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      router.push(`/map?lat=${position.coords.latitude}&lng=${position.coords.longitude}`);
    } catch {
      Alert.alert('Location error', 'Could not retrieve your location. Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedListItem index={0} direction="down">
        <View style={[styles.headerCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <View style={styles.brandRow}>
            <View style={[styles.brandBadge, { backgroundColor: colors.text }]}>
              <Text style={[styles.brandIcon, { color: colors.background }]}>🚗</Text>
              <Text style={[styles.brandText, { color: colors.background }]}>Vantage</Text>
            </View>
          </View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting},</Text>
          <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
          <Text style={[styles.summary, { color: colors.textSecondary }]}>{spotCount} spots currently available to browse.</Text>
        </View>
      </AnimatedListItem>

      <AnimatedListItem index={1} direction="down">
        <View style={styles.dualActionRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/browse');
            }}
            activeOpacity={0.85}
          >
            <View style={styles.buttonLabelRow}>
              <Text style={styles.smallIcon}>🔎</Text>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Browse Spots</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/host');
            }}
            activeOpacity={0.85}
          >
            <View style={styles.buttonLabelRow}>
              <Text style={styles.smallIcon}>🏠</Text>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Host Hub</Text>
            </View>
          </TouchableOpacity>
        </View>
      </AnimatedListItem>

      {isHost && (
        <AnimatedListItem index={2} direction="down">
          <View style={[styles.hostCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Text style={[styles.hostTitle, { color: colors.text }]}>Today on your host account</Text>
            <View style={styles.hostStatsRow}>
              <View>
                <Text style={[styles.hostStatValue, { color: colors.primary }]}>{activeBookings}</Text>
                <Text style={[styles.hostStatLabel, { color: colors.textSecondary }]}>Active bookings</Text>
              </View>
              <View>
                <Text style={[styles.hostStatValue, { color: colors.primary }]}>${todayEarnings.toFixed(2)}</Text>
                <Text style={[styles.hostStatLabel, { color: colors.textSecondary }]}>Today earnings</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.inlineButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/host')}
              activeOpacity={0.85}
            >
              <View style={styles.buttonLabelRow}>
                <Text style={styles.smallIcon}>📊</Text>
                <Text style={styles.inlineButtonText}>Open Host</Text>
              </View>
            </TouchableOpacity>
          </View>
        </AnimatedListItem>
      )}

      <AnimatedListItem index={3} direction="down">
        <View style={[styles.quickActions, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <View style={styles.quickButtonsRow}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: colors.border }]}
              onPress={openCurrentLocation}
              activeOpacity={0.8}
            >
              <View style={styles.buttonLabelRow}>
                <Text style={styles.smallIcon}>📍</Text>
                <Text style={[styles.quickBtnText, { color: colors.text }]}>Current Location</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: colors.border }]}
              onPress={() => router.push('/map?openSearch=true')}
              activeOpacity={0.8}
            >
              <View style={styles.buttonLabelRow}>
                <Text style={styles.smallIcon}>🗺️</Text>
                <Text style={[styles.quickBtnText, { color: colors.text }]}>Search Map</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedListItem>

      <View style={styles.topSpotsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Best Value Right Now</Text>
        {topSpots.map((spot, index) => (
          <AnimatedListItem key={spot.id} index={index + 4} direction="up">
            <TouchableOpacity
              style={[styles.spotCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
              onPress={() => router.push('/browse')}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.buttonLabelRow}>
                  <Text style={styles.smallIcon}>🅿️</Text>
                  <Text style={[styles.spotTitle, { color: colors.text }]} numberOfLines={1}>{spot.title}</Text>
                </View>
                <Text style={[styles.spotAddress, { color: colors.textSecondary }]} numberOfLines={1}>{spot.address}</Text>
              </View>
              <Text style={[styles.spotPrice, { color: colors.primary }]}>${spot.price.toFixed(2)}/hr</Text>
            </TouchableOpacity>
          </AnimatedListItem>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  headerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  brandRow: {
    marginTop: -16,
    marginHorizontal: -16,
    marginBottom: 12,
  },
  brandBadge: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  brandIcon: {
    fontSize: 22,
  },
  brandText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  summary: {
    marginTop: 8,
    fontSize: 14,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
  },
  buttonLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallIcon: {
    fontSize: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hostCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  hostTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hostStatsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hostStatValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  hostStatLabel: {
    fontSize: 12,
  },
  inlineButton: {
    marginTop: 12,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  inlineButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  quickButtonsRow: {
    gap: 8,
  },
  quickBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topSpotsSection: {
    marginBottom: 8,
  },
  spotCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spotTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  spotAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  spotPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
});
