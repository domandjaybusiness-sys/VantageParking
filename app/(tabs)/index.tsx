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
    Modal,
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
  const [topSpots, setTopSpots] = useState<{ id: string; title: string; address: string; price: number; latitude?: number | null; longitude?: number | null }[]>([]);
  const [homeTab, setHomeTab] = useState<'overview' | 'active'>('overview');
  const [activeSpotsList, setActiveSpotsList] = useState<any[]>([]);
  const [addTimeModalVisible, setAddTimeModalVisible] = useState(false);
  const [addTimeBooking, setAddTimeBooking] = useState<any | null>(null);
  const [addTimeMinutes, setAddTimeMinutes] = useState<number>(15);
  const [activeBookingBanner, setActiveBookingBanner] = useState<{
    id: string;
    title: string;
    address: string;
    endTime: Date;
  } | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(Date.now());

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
          latitude: s.latitude ?? s.longitude ?? null,
          longitude: s.longitude ?? s.latitude ?? null,
        }));
      setTopSpots(sorted);

      if (!user) {
        setIsHost(false);
        setActiveBookings(0);
        setTodayEarnings(0);
        setActiveBookingBanner(null);
        return;
      }

      const { data: activeRows } = await supabase
        .from('bookings')
        .select('id, end_time, endTime, address, spot_name, spot_title, spot:spots(title, address)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('end_time', { ascending: true })
        .limit(1);

      const activeBookingRow = activeRows?.[0];
      if (activeBookingRow) {
        const joinedSpot = Array.isArray(activeBookingRow?.spot)
          ? activeBookingRow.spot[0]
          : activeBookingRow?.spot;
        const endRaw = activeBookingRow?.end_time ?? activeBookingRow?.endTime;
        const endTime = endRaw ? new Date(endRaw) : null;
        if (endTime && !Number.isNaN(endTime.getTime()) && endTime.getTime() > Date.now()) {
          const title = joinedSpot?.title ?? activeBookingRow?.spot_name ?? activeBookingRow?.spot_title ?? 'Parking Spot';
          const address = joinedSpot?.address ?? activeBookingRow?.address ?? 'Address unavailable';
          setActiveBookingBanner({
            id: String(activeBookingRow?.id ?? ''),
            title,
            address,
            endTime,
          });
        } else {
          setActiveBookingBanner(null);
        }
      } else {
        setActiveBookingBanner(null);
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

    // also fetch active spots list for user
    const fetchActiveSpots = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setActiveSpotsList([]); return; }
      const { data } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, status, spot:spots(id,title,address)')
        .eq('user_id', user.id)
        .in('status', ['active','pending'])
        .order('end_time', { ascending: true });

      const mapped = (data ?? []).map((r: any) => ({
        id: String(r.id),
        start: r.start_time ? new Date(r.start_time) : null,
        end: r.end_time ? new Date(r.end_time) : null,
        status: r.status,
        spot: Array.isArray(r.spot) ? r.spot[0] : r.spot,
      }));
      setActiveSpotsList(mapped);
    };

    void fetchActiveSpots();

    const bookingsChannel = supabase
      .channel('home-active-booking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
    };
  }, []);

  // refresh active spots when tab is opened
  useEffect(() => {
    if (homeTab !== 'active') return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setActiveSpotsList([]); return; }
      const { data } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, status, spot:spots(id,title,address)')
        .eq('user_id', user.id)
        .in('status', ['active','pending'])
        .order('end_time', { ascending: true });

      const mapped = (data ?? []).map((r: any) => ({
        id: String(r.id),
        start: r.start_time ? new Date(r.start_time) : null,
        end: r.end_time ? new Date(r.end_time) : null,
        status: r.status,
        spot: Array.isArray(r.spot) ? r.spot[0] : r.spot,
      }));
      setActiveSpotsList(mapped);
    })();
  }, [homeTab]);

  const openAddTimeModal = (booking: any) => {
    setAddTimeBooking(booking);
    setAddTimeMinutes(15);
    setAddTimeModalVisible(true);
  };

  const confirmAddTime = async (minutes: number) => {
    if (!addTimeBooking) return;
    setAddTimeModalVisible(false);

    const booking = addTimeBooking;
    const newEndMs = (booking.end?.getTime() || Date.now()) + minutes * 60000;
    const newEndISO = new Date(newEndMs).toISOString();

    // check overlap
    const { data: conflict, error: conflictErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('spot_id', booking.spot?.id)
      .neq('id', booking.id)
      .lt('start_time', newEndISO)
      .gt('end_time', booking.end ? booking.end.toISOString() : new Date().toISOString())
      .in('status', ['pending','active'])
      .limit(1);

    if (conflictErr) {
      Alert.alert('Could not check availability', conflictErr.message || '');
      return;
    }

    if ((conflict ?? []).length > 0) {
      
      Alert.alert('Cannot add time', 'Someone has reserved this spot after your current booking window.');
      return;
    }

    const { error: updateErr } = await supabase.from('bookings').update({ end_time: newEndISO }).eq('id', booking.id);
    if (updateErr) {
      Alert.alert('Failed to add time', updateErr.message || 'Unable to extend booking.');
      return;
    }

    // refresh list and banner
    Alert.alert('Time added', `Added ${minutes} minutes to your booking.`);
    // Refresh by reloading page's data
    void (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data } = await supabase.from('bookings').select('id, start_time, end_time, status, spot:spots(id,title,address)').eq('user_id', user.id).in('status', ['active','pending']).order('end_time', { ascending: true }); setActiveSpotsList((data ?? []).map((r:any)=>({ id:String(r.id), start: r.start_time?new Date(r.start_time):null, end: r.end_time?new Date(r.end_time):null, status: r.status, spot: Array.isArray(r.spot)?r.spot[0]:r.spot }))); })();
  };

  useEffect(() => {
    if (!activeBookingBanner) return;
    const timer = setInterval(() => setCountdownNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeBookingBanner]);

  const formatRemainingTime = (endTime: Date) => {
    const remainingMs = Math.max(0, endTime.getTime() - countdownNowMs);
    const totalMinutes = Math.ceil(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const hourLabel = `${hours}hr`;
    const minuteLabel = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    return `${hourLabel} ${minuteLabel}`;
  };

  const formatMinutesLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}hr ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  };

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
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      let locationLabel = 'Current location';
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const first = geo?.[0];
        if (first) {
          const label = [first.name, first.street, first.city, first.region].filter(Boolean).join(', ');
          if (label.trim().length > 0) locationLabel = label;
        }
      } catch {
        // keep fallback label
      }

      router.push({
        pathname: '/map',
        params: {
          lat: String(latitude),
          lng: String(longitude),
          radius: '5',
          showList: 'true',
          nearMe: 'true',
          location: locationLabel,
        },
      });
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
      {activeBookingBanner && (
        <AnimatedListItem index={0} direction="down">
          <TouchableOpacity
            style={[styles.activeBookingBanner, { backgroundColor: colors.backgroundCard, borderColor: colors.primary }]}
            onPress={() => router.push('/reservations')}
            activeOpacity={0.85}
          >
            <Text style={[styles.activeBookingBannerText, { color: colors.text }]}>Active booking • {formatRemainingTime(activeBookingBanner.endTime)} left</Text>
            <Text style={[styles.activeBookingBannerView, { color: colors.primary }]}>View</Text>
          </TouchableOpacity>
        </AnimatedListItem>
      )}

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
          <Text style={[styles.summary, { color: colors.textSecondary }]}>{spotCount} spots currently available to browse. Park Now defaults to 30 min.</Text>
        </View>
      </AnimatedListItem>

      <AnimatedListItem index={1} direction="down">
        <TouchableOpacity
          style={[styles.primaryHomeAction, { backgroundColor: colors.primary }]}
          onPress={openCurrentLocation}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryHomeActionText}>Find parking near me</Text>
        </TouchableOpacity>
      </AnimatedListItem>

      <View style={styles.homeTabsRow}>
        <TouchableOpacity
          style={[styles.homeTabButton, homeTab === 'overview' && { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => setHomeTab('overview')}
          activeOpacity={0.85}
        >
          <Text style={{ color: colors.text }}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.homeTabButton, homeTab === 'active' && { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => setHomeTab('active')}
          activeOpacity={0.85}
        >
          <Text style={{ color: colors.text }}>Active Spots ({activeSpotsList.length})</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={addTimeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add time to parking</Text>
            <Text style={[styles.modalAddress, { color: colors.text }]} numberOfLines={2}>{addTimeBooking?.spot?.address ?? addTimeBooking?.spot?.title ?? 'Selected spot'}</Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Add duration</Text>
            <View style={styles.durationGrid}>
              {[15,30,60,120,180,240,720].map((m) => (
                <TouchableOpacity key={String(m)} style={[styles.durationButton, addTimeMinutes === m && { backgroundColor: colors.primary }]} onPress={() => setAddTimeMinutes(m)} activeOpacity={0.85}>
                  <Text style={[styles.durationButtonText, addTimeMinutes === m ? { color: '#fff' } : { color: colors.text }]}>{m === 720 ? 'All day' : (m >= 60 ? `${m/60}h` : `${m}m`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={() => confirmAddTime(addTimeMinutes)} activeOpacity={0.85}>
                <Text style={styles.confirmButtonText}>Add {formatMinutesLabel(addTimeMinutes)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => setAddTimeModalVisible(false)} activeOpacity={0.85}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AnimatedListItem index={2} direction="down">
        <View style={styles.dualActionRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/browse');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionTitle, { color: colors.text }]}>Browse Spots</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/host');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionTitle, { color: colors.text }]}>Host Hub</Text>
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

      {homeTab === 'active' ? (
        <View style={styles.activeSpotsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Spots</Text>
          {activeSpotsList.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No active spots</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Start parking to see active spots here.</Text>
            </View>
          ) : (
            activeSpotsList.map((b) => (
              <AnimatedListItem key={b.id} index={3} direction="up">
                <TouchableOpacity activeOpacity={0.9} onPress={() => {
                  // Navigate to map and center on this spot
                  const lat = b.spot?.latitude ?? b.spot?.lat ?? null;
                  const lng = b.spot?.longitude ?? b.spot?.lng ?? null;
                  if (lat != null && lng != null) {
                    router.push(`/map?lat=${lat}&lng=${lng}&spotId=${b.id}`);
                  } else {
                    router.push('/map');
                  }
                }}>
                  <View style={[styles.activeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{b.spot?.title ?? 'Spot'}</Text>
                    <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>{b.spot?.address}</Text>
                    <Text style={[styles.smallMeta, { color: colors.textSecondary }]}>Time remaining: {b.end ? formatRemainingTime(b.end) : '--'}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => router.push('/reservations')} activeOpacity={0.85}>
                        <Text style={[styles.secondaryBtnText, { color: colors.text }]}>View Reservation</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => openAddTimeModal(b)} activeOpacity={0.85}>
                        <Text style={styles.primaryBtnText}>Add Time</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))
          )}
        </View>
      ) : (
        <View style={styles.topSpotsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Best Value Right Now</Text>
        <View style={styles.topSpotsList}>
          {topSpots.map((spot, index) => (
            <AnimatedListItem key={spot.id} index={index + 4} direction="up">
              <TouchableOpacity
                style={[styles.spotCardList, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: '/browse', params: { spotId: spot.id, lat: spot.latitude ?? undefined, lng: spot.longitude ?? undefined } });
                }}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.spotTitle, { color: colors.text }]} numberOfLines={1}>{spot.title}</Text>
                  <Text style={[styles.spotAddress, { color: colors.textSecondary }]} numberOfLines={2}>{spot.address}</Text>
                </View>
                <Text style={[styles.spotPrice, { color: colors.primary }]}>{`$${spot.price.toFixed(2)}/hr`}</Text>
              </TouchableOpacity>
            </AnimatedListItem>
          ))}
        </View>
      </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  activeBookingBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBookingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 10,
  },
  activeBookingBannerView: {
    fontSize: 13,
    fontWeight: '700',
  },
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
  homeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  homeTabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  activeSpotsSection: {
    marginBottom: 12,
  },
  activeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  smallMeta: {
    fontSize: 13,
    marginTop: 6,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
    zIndex: 40,
  },
  modalContent: {
    width: '100%',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalAddress: {
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  durationButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
  primaryHomeAction: {
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryHomeActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  topSpotsRow: {
    gap: 10,
    paddingBottom: 4,
  },
  topSpotsList: {
    paddingBottom: 4,
  },
  spotCardHorizontal: {
    width: 240,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  spotCardList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  address: { fontSize: 13, marginTop: 4 },
  secondaryBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryBtnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtnText: { fontSize: 13, fontWeight: '700' },
});
