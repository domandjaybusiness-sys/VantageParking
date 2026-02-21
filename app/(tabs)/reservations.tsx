import { AnimatedListItem } from '@/components/ui/animated-list-item';
import LoadingOverlay from '@/components/ui/loading-overlay';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ReservationItem = {
  id: string;
  spotId: string;
  spotName: string;
  address: string;
  dateLabel: string;
  timeLabel: string;
  totalPrice: number;
  status: string;
  startTime: Date;
  endTime: Date;
  latitude?: number | null;
  longitude?: number | null;
  isPast: boolean;
};

export default function ReservationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationItem | null>(null);
  const [extendDuration, setExtendDuration] = useState<number>(30);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, { latitude: number; longitude: number }>>({});

  const fetchReservations = async () => {
    setLoadingReservations(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setReservations([]);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*, spot:spots ( id, title, address, lat, lng, latitude, longitude, price )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let rows: any[] = [];
      if (!error && data && data.length > 0) {
        rows = data;
      } else {
        const { data: fbData, error: fbErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fbErr) {
          setReservations([]);
          return;
        }
        rows = fbData ?? [];
      }

      const now = Date.now();
      const mapped = (rows ?? []).map((row: any) => {
        const startRaw = row?.start_time ?? row?.startTime ?? row?.date ?? row?.created_at;
        const endRaw = row?.end_time ?? row?.endTime;
        const start = startRaw ? new Date(startRaw) : new Date();
        const end = endRaw ? new Date(endRaw) : new Date(start.getTime() + 60 * 60 * 1000);
        const status = String(row?.status ?? 'Pending');
        const statusLower = status.toLowerCase();
        const isPast = ['paid', 'completed', 'cancelled'].includes(statusLower) || end.getTime() < now;
        const spot = row?.spot ?? null;
        const latRaw = row?.lat ?? row?.latitude ?? row?.spot_lat ?? row?.spotLat ?? spot?.lat ?? spot?.latitude ?? null;
        const lngRaw = row?.lng ?? row?.longitude ?? row?.spot_lng ?? row?.spotLng ?? spot?.lng ?? spot?.longitude ?? null;
        const lat = typeof latRaw === 'number' ? latRaw : (typeof latRaw === 'string' ? parseFloat(latRaw) : null);
        const lng = typeof lngRaw === 'number' ? lngRaw : (typeof lngRaw === 'string' ? parseFloat(lngRaw) : null);
        const pricePerHourRaw = row?.price_per_hour ?? row?.pricePerHour ?? row?.price ?? spot?.price ?? 0;
        const pricePerHour = Number(pricePerHourRaw ?? 0);
        const hoursRaw = row?.hours ?? row?.duration ?? 1;
        const hoursValue = Number(hoursRaw ?? 1) || 1;
        const derivedTotal = pricePerHour * hoursValue;
        const totalRaw = row?.amount ?? row?.total ?? row?.total_price ?? null;
        const totalPrice = totalRaw == null ? derivedTotal : Number(totalRaw ?? 0);

        return {
          id: String(row?.id ?? ''),
          spotId: String(row?.spot_id ?? spot?.id ?? ''),
          spotName: row?.spot_name ?? row?.spot_title ?? row?.spotName ?? spot?.title ?? row?.address ?? 'Parking Spot',
          address: row?.address ?? spot?.address ?? 'Address unavailable',
          dateLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          timeLabel: `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          totalPrice,
          status,
          startTime: start,
          endTime: end,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          isPast,
        };
      });

      // Client-side geocode for missing spots
      const missing = mapped.filter((r) => r.latitude == null || r.longitude == null);
      missing.forEach(async (reservation) => {
        try {
          const q = reservation.address || reservation.spotName || '';
          if (!q || q === 'Address unavailable' || q === 'Parking Spot') return;
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) return;
          const json = await res.json();
          const feat = json?.features?.[0];
          const coords = feat?.geometry?.coordinates || [];
          const lng = coords[0];
          const lat = coords[1];
          if (typeof lat === 'number' && typeof lng === 'number') {
            setGeocodedCoords((prev) => ({ ...prev, [reservation.id]: { latitude: lat, longitude: lng } }));
          }
        } catch {
          // ignore
        }
      });

      setReservations(mapped);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel('reservations-guest')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayedReservations = useMemo(() => {
    return reservations
      .filter((r) => (activeTab === 'upcoming' ? !r.isPast : r.isPast))
      .sort((a, b) => (activeTab === 'upcoming' ? a.startTime.getTime() - b.startTime.getTime() : b.startTime.getTime() - a.startTime.getTime()));
  }, [reservations, activeTab]);

  const upcomingCount = useMemo(() => reservations.filter(r => !r.isPast).length, [reservations]);

  const [loadingCancelId, setLoadingCancelId] = useState<string | null>(null);

  const confirmExtendReservation = async () => {
    if (!selectedReservation) return;
    const minutes = extendDuration;
    const nextEnd = new Date(selectedReservation.endTime.getTime() + minutes * 60000);
    
    setExtendModalVisible(false);
    
    const { error } = await supabase
      .from('bookings')
      .update({ end_time: nextEnd.toISOString() })
      .eq('id', selectedReservation.id);

    if (error) {
      Alert.alert('Extend failed', error.message || 'Could not extend booking.');
      return;
    }

    setReservations((prev) => prev.map((item) => (
      item.id === selectedReservation.id
        ? {
          ...item,
          endTime: nextEnd,
          timeLabel: `${item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${nextEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        }
        : item
    )));
    
    Alert.alert('Success', `Reservation extended by ${minutes >= 60 ? minutes/60 + ' hour(s)' : minutes + ' minutes'}.`);
  };

  const handleCancelReservation = async (id: string) => {
    Alert.alert('Cancel reservation', 'Are you sure you want to cancel this reservation?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoadingCancelId(id);
            const { error } = await supabase.from('bookings').delete().eq('id', id);

            if (error) {
              console.warn('Failed to cancel reservation', error);
              Alert.alert('Error', 'Could not cancel reservation.');
              setLoadingCancelId(null);
              return;
            }

            // Optimistically update UI
            setReservations((prev) => prev.filter((r) => r.id !== id));
            setLoadingCancelId(null);
          } catch (err) {
            console.warn('Cancel error', err);
            Alert.alert('Error', 'Could not cancel reservation.');
            setLoadingCancelId(null);
          }
        },
      },
    ]);
  };

  const openDirections = async (reservation: ReservationItem, lat?: number | null, lng?: number | null) => {
    const addr = reservation.address || '';
    const finalLat = lat ?? reservation.latitude;
    const finalLng = lng ?? reservation.longitude;

    try {
      if (Platform.OS === 'ios') {
        if (finalLat != null && finalLng != null) {
          const gUrl = `comgooglemaps://?daddr=${finalLat},${finalLng}&directionsmode=driving`;
          if (await Linking.canOpenURL(gUrl)) {
            await Linking.openURL(gUrl);
            return;
          }
          const appleUrl = `http://maps.apple.com/?daddr=${finalLat},${finalLng}&dirflg=d`;
          await Linking.openURL(appleUrl);
          return;
        }

        const gAddrUrl = `comgooglemaps://?daddr=${encodeURIComponent(addr)}&directionsmode=driving`;
        if (await Linking.canOpenURL(gAddrUrl)) {
          await Linking.openURL(gAddrUrl);
          return;
        }
        const appleAddr = `http://maps.apple.com/?daddr=${encodeURIComponent(addr)}&dirflg=d`;
        await Linking.openURL(appleAddr);
        return;
      }

      if (finalLat != null && finalLng != null) {
        const navIntent = `google.navigation:q=${finalLat},${finalLng}`;
        if (await Linking.canOpenURL(navIntent)) {
          await Linking.openURL(navIntent);
          return;
        }
        const geo = `geo:${finalLat},${finalLng}?q=${finalLat},${finalLng}(${encodeURIComponent(reservation.spotName || 'Destination')})`;
        await Linking.openURL(geo);
        return;
      }

      const geoAddr = `geo:0,0?q=${encodeURIComponent(addr)}`;
      if (await Linking.canOpenURL(geoAddr)) {
        await Linking.openURL(geoAddr);
        return;
      }

      const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
      await Linking.openURL(web);
    } catch {
      const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(finalLat != null && finalLng != null ? `${finalLat},${finalLng}` : addr)}`;
      try { await Linking.openURL(web); } catch { Alert.alert('Unable to open maps', 'Please check your device settings.'); }
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active' || s === 'paid') return colors.primary;
    if (s === 'completed') return colors.textSecondary;
    if (s === 'cancelled') return '#d9534f';
    return '#f0ad4e'; // pending
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Reservations</Text>
        <View style={[styles.tabContainer, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && [styles.activeTab, { backgroundColor: colors.backgroundCard, shadowColor: colors.text }]]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: activeTab === 'upcoming' ? colors.text : colors.textSecondary }]}>
              Upcoming ({upcomingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && [styles.activeTab, { backgroundColor: colors.backgroundCard, shadowColor: colors.text }]]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: activeTab === 'past' ? colors.text : colors.textSecondary }]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LoadingOverlay visible={loadingReservations} text="Loading reservations…" />

        {displayedReservations.map((reservation, index) => {
          const lat = reservation.latitude ?? geocodedCoords[reservation.id]?.latitude;
          const lng = reservation.longitude ?? geocodedCoords[reservation.id]?.longitude;

          return (
          <AnimatedListItem key={reservation.id} index={index} direction="up">
            <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              
              {/* Mini Map Header */}
              {lat != null && lng != null ? (
                <TouchableOpacity 
                  style={[styles.miniMapContainer, { borderColor: colors.border }]}
                  onPress={() => {
                    router.push({ pathname: '/map', params: { lat: String(lat), lng: String(lng) } });
                  }}
                  activeOpacity={0.9}
                >
                  <MapView
                    pointerEvents="none"
                    style={styles.miniMap}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude: lat,
                      longitude: lng,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                    region={{
                      latitude: lat,
                      longitude: lng,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                  >
                    <Marker coordinate={{ latitude: lat, longitude: lng }} />
                  </MapView>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(reservation.status) }]}>
                    <Text style={styles.statusText}>{reservation.status.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.miniMapPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="location-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.miniMapPlaceholderText, { color: colors.textSecondary }]}>Location unavailable</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(reservation.status) }]}>
                    <Text style={styles.statusText}>{reservation.status.toUpperCase()}</Text>
                  </View>
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {reservation.spotName}
                  </Text>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    ${reservation.totalPrice.toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={16} color={colors.textSecondary} />
                  <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={2}>
                    {reservation.address}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={16} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.text }]}>{reservation.dateLabel}</Text>
                  <Text style={[styles.metaDivider, { color: colors.textSecondary }]}>•</Text>
                  <Ionicons name="time" size={16} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.text }]}>{reservation.timeLabel}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={() => openDirections(reservation, lat, lng)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={styles.primaryButtonText}>Directions</Text>
                  </TouchableOpacity>

                  {!reservation.isPast && (
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => {
                        setSelectedReservation(reservation);
                        setExtendDuration(30);
                        setExtendModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="time-outline" size={16} color={colors.text} />
                      <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Extend</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => {
                      if (lat && lng) {
                        router.push({ pathname: '/map', params: { lat: String(lat), lng: String(lng) } });
                      } else if (reservation.spotId) {
                        router.push({ pathname: '/map', params: { spotId: reservation.spotId, viewSpot: 'true' } });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={18} color={colors.text} />
                  </TouchableOpacity>

                  {!reservation.isPast && (
                    <TouchableOpacity
                      style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}
                      onPress={() => handleCancelReservation(reservation.id)}
                      activeOpacity={0.8}
                      disabled={loadingCancelId != null}
                    >
                      <Ionicons name="close" size={18} color="#d9534f" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </AnimatedListItem>
          );
        })}

        {displayedReservations.length === 0 && !loadingReservations && (
          <View style={[styles.empty, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="calendar-clear-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No {activeTab} reservations</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {activeTab === 'upcoming' ? 'Book a spot and it will show here.' : 'Your past parking history will appear here.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Extend Modal */}
      <Modal visible={extendModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Extend Reservation</Text>
            <Text style={[styles.modalAddress, { color: colors.textSecondary }]} numberOfLines={1}>
              {selectedReservation?.spotName}
            </Text>

            <Text style={[styles.modalLabel, { color: colors.text }]}>Add more time</Text>
            <View style={styles.durationGrid}>
              {[
                { m: 15, label: '15m' },
                { m: 30, label: '30m' },
                { m: 60, label: '1h' },
                { m: 120, label: '2h' },
                { m: 180, label: '3h' },
                { m: 240, label: '4h' },
              ].map((opt) => (
                <TouchableOpacity
                  key={String(opt.m)}
                  style={[styles.durationButton, extendDuration === opt.m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setExtendDuration(opt.m)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.durationButtonText, extendDuration === opt.m ? { color: '#fff' } : { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={confirmExtendReservation} activeOpacity={0.85}>
                <Text style={[styles.confirmButtonText]}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelModalButton, { borderColor: colors.border }]} onPress={() => { setExtendModalVisible(false); setSelectedReservation(null); }} activeOpacity={0.85}>
                <Text style={[styles.cancelModalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  miniMapContainer: {
    height: 140,
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  miniMap: {
    ...StyleSheet.absoluteFillObject,
  },
  miniMapPlaceholder: {
    height: 140,
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  miniMapPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  metaDivider: {
    marginHorizontal: 8,
    fontSize: 14,
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 32,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalAddress: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  durationButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelModalButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
