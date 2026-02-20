import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ReservationItem = {
  id: string;
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
};

export default function ReservationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const fetchReservations = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setReservations([]);
      return;
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*, spot:spots ( title, address, lat, lng, latitude, longitude, price )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // If joined select fails or returns nothing, fall back to bookings-only query
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
      const totalRaw = row?.amount ?? row?.total ?? null;
      const totalPrice = totalRaw == null ? derivedTotal : Number(totalRaw ?? 0);

      return {
        id: String(row?.id ?? ''),
        spotName: row?.spot_name ?? row?.spot_title ?? row?.spotName ?? spot?.title ?? row?.address ?? 'Parking Spot',
        address: row?.address ?? spot?.address ?? 'Address unavailable',
        dateLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
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

    const upcoming = mapped
      .filter((r) => !r.isPast)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    setReservations(upcoming);
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

  const upcomingCount = useMemo(() => reservations.length, [reservations]);

  const [loadingCancelId, setLoadingCancelId] = useState<string | null>(null);

  const handleExtendReservation = async (reservation: ReservationItem, minutes: number) => {
    const nextEnd = new Date(reservation.endTime.getTime() + minutes * 60000);
    const { error } = await supabase
      .from('bookings')
      .update({ end_time: nextEnd.toISOString() })
      .eq('id', reservation.id);

    if (error) {
      Alert.alert('Extend failed', error.message || 'Could not extend booking.');
      return;
    }

    setReservations((prev) => prev.map((item) => (
      item.id === reservation.id
        ? {
          ...item,
          endTime: nextEnd,
          timeLabel: `${item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${nextEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        }
        : item
    )));
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Reservations</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{upcomingCount} upcoming</Text>
      </View>

      {reservations.map((reservation, index) => (
        <AnimatedListItem key={reservation.id} index={index} direction="up">
          <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {reservation.spotName}
              </Text>
              <Text style={[styles.price, { color: colors.primary }]}>
                ${reservation.totalPrice.toFixed(2)}
              </Text>
            </View>
            <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
              {reservation.address}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: colors.text }]}>{reservation.dateLabel}</Text>
              <Text style={[styles.metaDivider, { color: colors.textSecondary }]}>•</Text>
              <Text style={[styles.metaText, { color: colors.text }]}>{reservation.timeLabel}</Text>
            </View>
            <Text style={[styles.status, { color: colors.textSecondary }]}>Status: {reservation.status}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.mapButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => handleExtendReservation(reservation, 30)}
                activeOpacity={0.8}
              >
                <Text style={[styles.mapButtonText, { color: colors.text }]}>Extend +30</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => {
                  if (reservation.latitude != null && reservation.longitude != null) {
                    router.push(`/map?lat=${reservation.latitude}&lng=${reservation.longitude}`);
                  } else {
                    router.push('/map');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.mapButtonText, { color: colors.text }]}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}
                onPress={() => handleCancelReservation(reservation.id)}
                activeOpacity={0.8}
                disabled={loadingCancelId != null}
              >
                <Text style={[styles.cancelButtonText, { color: colors.badgeCancelled ?? '#d9534f' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedListItem>
      ))}

      {reservations.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
        >
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No upcoming reservations</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Book a spot and it will show here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaDivider: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  status: {
    marginTop: 8,
    fontSize: 12,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mapButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
  },
});
