import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { useTheme } from '@/contexts/ThemeContext';
import { Listing, mapSpotRow } from '@/lib/listings';
import { computeHourlyRate, DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterId = 'all' | 'under10' | 'driveway' | 'garage';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All Spots' },
  { id: 'under10', label: 'Under $10' },
  { id: 'driveway', label: 'Driveway' },
  { id: 'garage', label: 'Garage' },
];

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [spots, setSpots] = useState<Listing[]>([]);
  const [searchText, setSearchText] = useState(params.location ? String(params.location) : '');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  useEffect(() => {
    const fetchSpots = async () => {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setSpots([]);
        return;
      }

      setSpots((data ?? []).map(mapSpotRow));
    };

    fetchSpots();

    const channel = supabase
      .channel('spots-browse')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, () => {
        fetchSpots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visibleSpots = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return spots
      .filter((spot) => {
        if (!query) return true;
        return (
          spot.title.toLowerCase().includes(query) ||
          spot.address.toLowerCase().includes(query)
        );
      })
      .filter((spot) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'under10') return (spot.pricePerHour ?? 0) < 10;
        if (activeFilter === 'driveway') return spot.title.toLowerCase().includes('driveway');
        if (activeFilter === 'garage') return spot.title.toLowerCase().includes('garage');
        return true;
      });
  }, [spots, searchText, activeFilter]);

  const mapPreviewCenter = useMemo(() => {
    if (params.lat && params.lng) {
      return {
        latitude: parseFloat(String(params.lat)),
        longitude: parseFloat(String(params.lng)),
      };
    }

    const source = visibleSpots.length > 0 ? visibleSpots : spots;
    const firstWithCoords = source.find((spot) => spot.latitude != null && spot.longitude != null);

    if (firstWithCoords?.latitude != null && firstWithCoords?.longitude != null) {
      return {
        latitude: firstWithCoords.latitude,
        longitude: firstWithCoords.longitude,
      };
    }

    return {
      latitude: 37.7749,
      longitude: -122.4194,
    };
  }, [visibleSpots, spots, params.lat, params.lng]);

  const onConfirmSpot = async (spot: Listing) => {
    let start = new Date();
    let end = new Date(start.getTime() + 60 * 60 * 1000);

    if (params.date && params.startTime && params.endTime) {
      const selectedDate = new Date(String(params.date));
      const selectedStart = new Date(String(params.startTime));
      const selectedEnd = new Date(String(params.endTime));

      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), selectedStart.getHours(), selectedStart.getMinutes());
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), selectedEnd.getHours(), selectedEnd.getMinutes());
      
      if (end <= start) {
        end.setDate(end.getDate() + 1); // Handle overnight booking
      }
    }

    const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)));

    const rate = computeHourlyRate({
      baseRate: spot.pricePerHour ?? DEFAULT_BASE_RATE,
      address: spot.address,
      startTime: start,
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Sign in required', 'Please log in to book a spot.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    const totalAmount = rate * hours * 1.12;
    const { error } = await supabase.from('bookings').insert({
      spot_id: spot.id,
      spot_name: spot.title,
      address: spot.address,
      lat: spot.latitude ?? null,
      lng: spot.longitude ?? null,
      host_id: spot.hostId ?? null,
      guest_id: user.id,
      user_id: user.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      hours: hours,
      price_per_hour: spot.pricePerHour ?? DEFAULT_BASE_RATE,
      amount: totalAmount,
      status: 'confirmed',
      created_at: new Date().toISOString(),
    });

    if (error) {
      Alert.alert('Booking failed', error.message || 'Unable to confirm this spot.');
      return;
    }

    const dateLabel = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    Alert.alert('Spot confirmed', `${spot.title}\n${spot.address}\n${dateLabel} • ${timeLabel}`, [
      {
        text: 'View Reservation',
        onPress: () => router.push('/reservations'),
      },
      { text: 'Done', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedListItem index={0} direction="down">
        <TouchableOpacity
          style={[styles.mapPreviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => router.push({
            pathname: '/map',
            params: {
              lat: mapPreviewCenter.latitude,
              lng: mapPreviewCenter.longitude,
              date: params.date,
              startTime: params.startTime,
              endTime: params.endTime,
            }
          })}
          activeOpacity={0.9}
        >
          <MapView
            pointerEvents="none"
            style={styles.mapPreview}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: mapPreviewCenter.latitude,
              longitude: mapPreviewCenter.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            region={{
              latitude: mapPreviewCenter.latitude,
              longitude: mapPreviewCenter.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
          >
            {(visibleSpots.length > 0 ? visibleSpots : spots)
              .filter((spot) => spot.latitude != null && spot.longitude != null)
              .slice(0, 6)
              .map((spot) => (
                <Marker
                  key={spot.id}
                  coordinate={{ latitude: spot.latitude!, longitude: spot.longitude! }}
                  title={spot.title}
                />
              ))}
          </MapView>
          <View style={[styles.mapOverlayTag, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.mapOverlayText, { color: colors.text }]}>🗺️ Tap to open map</Text>
          </View>
        </TouchableOpacity>
      </AnimatedListItem>

      <AnimatedListItem index={1} direction="down">
        <View style={[styles.hero, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Browse Spots</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Search by area, compare prices, and confirm quickly.</Text>
        </View>
      </AnimatedListItem>

      <AnimatedListItem index={2} direction="down">
        <View style={[styles.searchBox, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search by neighborhood or address"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </AnimatedListItem>

      <AnimatedListItem index={3} direction="down">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.backgroundCard,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveFilter(filter.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, { color: active ? '#fff' : colors.text }]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </AnimatedListItem>

      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsTitle, { color: colors.text }]}>Available Spots</Text>
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>{visibleSpots.length} found</Text>
      </View>

      {visibleSpots.map((spot, index) => {
        const rate = computeHourlyRate({
          baseRate: spot.pricePerHour ?? DEFAULT_BASE_RATE,
          address: spot.address,
          startTime: new Date(),
        });

        return (
          <AnimatedListItem key={spot.id} index={index + 4} direction="up">
            <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{spot.title}</Text>
                <Text style={[styles.price, { color: colors.primary }]}>${rate.toFixed(2)}/hr</Text>
              </View>
              <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={2}>{spot.address}</Text>
              {spot.latitude != null && spot.longitude != null ? (
                <View style={[styles.miniMapContainer, { borderColor: colors.border }]}>
                  <MapView
                    pointerEvents="none"
                    style={styles.miniMap}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude: spot.latitude,
                      longitude: spot.longitude,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                    region={{
                      latitude: spot.latitude,
                      longitude: spot.longitude,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                  >
                    <Marker coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} />
                  </MapView>
                </View>
              ) : (
                <View style={[styles.miniMapPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.miniMapText, { color: colors.textSecondary }]}>Location unavailable</Text>
                </View>
              )}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    if (spot.latitude != null && spot.longitude != null) {
                      router.push(`/map?lat=${spot.latitude}&lng=${spot.longitude}`);
                    } else {
                      router.push('/map');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>View on Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => onConfirmSpot(spot)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Confirm Spot</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedListItem>
        );
      })}

      {visibleSpots.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No spots match this filter</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Try a different search term or switch filters.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  mapPreviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  mapPreview: {
    height: 170,
    width: '100%',
  },
  mapOverlayTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  searchBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    height: 46,
    fontSize: 15,
  },
  filterRow: {
    paddingVertical: 2,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500',
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
    marginBottom: 12,
    lineHeight: 18,
  },
  miniMapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  miniMap: {
    height: 120,
    width: '100%',
  },
  miniMapPlaceholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMapText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
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
