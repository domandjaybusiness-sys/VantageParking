import { AnimatedListItem } from '@/components/ui/animated-list-item';
import LoadingOverlay from '@/components/ui/loading-overlay';
import { useTheme } from '@/contexts/ThemeContext';
import { computeBookingPriceBreakdown } from '@/lib/booking';
import { Listing, mapSpotRow } from '@/lib/listings';
import { computeHourlyRate, DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
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
  const [loadingSpots, setLoadingSpots] = useState(false);
  const listOpacity = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [searchText, setSearchText] = useState(params.location ? String(params.location) : '');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [searchSuggestions, setSearchSuggestions] = useState<{ id: string; title: string; lat: number; lng: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [processingSpotId, setProcessingSpotId] = useState<string | null>(null);
  const [bookNowModalVisible, setBookNowModalVisible] = useState(false);
  const [bookNowSpot, setBookNowSpot] = useState<Listing | null>(null);
  const [bookNowDuration, setBookNowDuration] = useState<number>(30);
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [reserveSpot, setReserveSpot] = useState<Listing | null>(null);
  const [reserveDate, setReserveDate] = useState<Date>(new Date());
  const [reserveHour, setReserveHour] = useState<number>((new Date()).getHours() + 1);
  const [reserveDurationHours, setReserveDurationHours] = useState<number>(1);

  

  useEffect(() => {
    const fetchSpots = async () => {
      try {
        setLoadingSpots(true);
        const { data, error } = await supabase
          .from('spots')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          setSpots([]);
          return;
        }

        const mapped = (data ?? []).map(mapSpotRow);

      // Deduplicate spots by normalized address (prefer first seen)
      const dedupedByAddress = Object.values(
        mapped.reduce((acc: Record<string, Listing>, s) => {
          const raw = (s.address || s.title || s.id || '').toString();
          const key = raw.trim().toLowerCase();
          if (!acc[key]) acc[key] = s;
          return acc;
        }, {})
      );

      // Client-side geocode for a few missing spots so thumbnails can show immediately
      const missing = mapped.filter((s) => s.latitude == null || s.longitude == null);
      const toGeocode = missing.slice(0, 8);
      toGeocode.forEach(async (spot) => {
        try {
          const q = spot.address || spot.title || '';
          if (!q) return;
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) return;
          const json = await res.json();
          const feat = json?.features?.[0];
          const coords = feat?.geometry?.coordinates || [];
          const lng = coords[0];
          const lat = coords[1];
          if (typeof lat === 'number' && typeof lng === 'number') {
            setGeocodedCoords((prev) => ({ ...prev, [spot.id]: { latitude: lat, longitude: lng } }));
          }
        } catch {
          // ignore
        }
      });

      setSpots(dedupedByAddress);
      Animated.timing(listOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } finally {
      setLoadingSpots(false);
    }
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
  }, [listOpacity]);

  // If navigated here with a spotId param, focus and scroll to that spot after spots load
  useEffect(() => {
    if (!params.spotId) return;
    const id = String(params.spotId);

    // wait a tick for layout
    const t = setTimeout(() => {
      setFocusedSpotId(id);

      // attempt to find index and scroll
      const query = searchText.trim().toLowerCase();
      const filtered = spots
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

      const idx = filtered.findIndex((s) => String(s.id) === id);
      if (idx >= 0 && scrollRef.current) {
        const approxHeight = 140; // approximate per-card height
        const y = Math.max(0, idx * approxHeight - 80);
        try { (scrollRef.current as any).scrollTo({ y, animated: true }); } catch {}
      }

      // clear focus after a short while
      setTimeout(() => setFocusedSpotId(null), 4000);
    }, 400);

    return () => clearTimeout(t);
  }, [params.spotId, spots, searchText, activeFilter]);

  

  useEffect(() => {
    const trimmed = searchText.trim();

    if (trimmed.length < 3) {
      setSearchSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=8&lang=en`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const nextResults = (json.features || [])
          .map((feature: any) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [];
            const lon = coords[0];
            const lat = coords[1];
            if (typeof lat !== 'number' || typeof lon !== 'number') return null;

            const country = String(props.countrycode || '').toLowerCase();
            if (country && country !== 'us') return null;

            const title = [
              props.housenumber,
              props.name || props.street,
              props.city || props.town || props.village,
              props.state,
              props.postcode,
            ].filter(Boolean).join(', ');

            const scoreRaw = props.importance ?? props.osm_rank ?? 0;

            return {
              id: String(props.osm_id || `${lat},${lon}`),
              title: title || props.name || props.city || 'Unknown location',
              lat,
              lng: lon,
              score: Number(scoreRaw) || 0,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
          .map(({ id, title, lat, lng }: any) => ({ id, title, lat, lng }));

        setSearchSuggestions(nextResults as { id: string; title: string; lat: number; lng: number }[]);
      } catch {
        setSearchSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText]);

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
    const firstWithCoords = source.find((spot) => (spot.latitude != null && spot.longitude != null) || (geocodedCoords[spot.id] != null));

    if (firstWithCoords) {
      const lat = firstWithCoords.latitude ?? geocodedCoords[firstWithCoords.id]?.latitude;
      const lng = firstWithCoords.longitude ?? geocodedCoords[firstWithCoords.id]?.longitude;
      if (lat != null && lng != null) {
        return { latitude: lat, longitude: lng };
      }
    }

    return {
      latitude: 37.7749,
      longitude: -122.4194,
    };
  }, [visibleSpots, spots, geocodedCoords, params.lat, params.lng]);

  // NOTE: Reserve and Book flows navigate to /map directly via modal handlers.
  // onConfirmSpot was removed because it's unused.

  // When user taps Book Now, show duration selection modal first
  const onBookNowSpot = (spot: Listing) => {
    setBookNowSpot(spot);
    setBookNowDuration(30);
    setBookNowModalVisible(true);
  };

  const confirmBookNow = async (minutes: number) => {
    const spot = bookNowSpot;
    if (!spot) return;
    if (processingSpotId) return;
    setProcessingSpotId(String(spot.id));
    setBookNowModalVisible(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProcessingSpotId(null);
      Alert.alert('Sign in required', 'Please log in to book a spot.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60000);
    const price = computeBookingPriceBreakdown({ mode: 'parkNow', start, end, hostRate: spot.pricePerHour });

    // check overlap quickly
    const { data: overlapData, error: overlapError } = await supabase
      .from('bookings')
      .select('id')
      .eq('spot_id', spot.id)
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString())
      .in('status', ['pending', 'active'])
      .limit(1);

    if (overlapError) {
      setProcessingSpotId(null);
      Alert.alert('Availability check failed', overlapError.message || 'Unable to check availability.');
      return;
    }

    if ((overlapData ?? []).length > 0) {
      setProcessingSpotId(null);
      Alert.alert('Spot unavailable', 'This spot is already booked for that time window.');
      return;
    }

    const payload: any = {
      spot_id: spot.id,
      user_id: user.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'active',
      total_price: price.total,
      platform_fee: price.platformFee,
      host_payout: price.hostPayout,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('bookings').insert(payload);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const optionalCols = msg.includes('platform_fee') || msg.includes('host_payout') || msg.includes('total_price') || msg.includes('column') || msg.includes('schema cache');

      if (optionalCols) {
        const { error: fallbackError } = await supabase.from('bookings').insert({
          spot_id: spot.id,
          user_id: user.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'active',
          created_at: new Date().toISOString(),
        });

        if (fallbackError) {
          setProcessingSpotId(null);
          Alert.alert('Booking failed', fallbackError.message || 'Unable to create booking.');
          return;
        }
      } else {
        setProcessingSpotId(null);
        Alert.alert('Booking failed', error.message || 'Unable to create booking.');
        return;
      }
    }

    setProcessingSpotId(null);
    setBookNowSpot(null);
    Alert.alert('Parking started', 'Your Park Now booking is now active.');
    router.push('/reservations');
  };

  const resolveSpotCoordinates = async (spot: Listing) => {
    const existingLat = spot.latitude ?? geocodedCoords[spot.id]?.latitude;
    const existingLng = spot.longitude ?? geocodedCoords[spot.id]?.longitude;

    if (existingLat != null && existingLng != null) {
      return { lat: existingLat, lng: existingLng };
    }

    try {
      const query = (spot.address || spot.title || '').trim();
      if (!query) return null;

      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;

      const json = await res.json();
      const feature = json?.features?.[0];
      const coords = feature?.geometry?.coordinates || [];
      const lng = coords[0];
      const lat = coords[1];

      if (typeof lat === 'number' && typeof lng === 'number') {
        setGeocodedCoords((prev) => ({ ...prev, [spot.id]: { latitude: lat, longitude: lng } }));
        return { lat, lng };
      }

      return null;
    } catch {
      return null;
    }
  };

  return (
    <ScrollView
      ref={(r) => { scrollRef.current = r; }}
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
            <Text style={[styles.mapOverlayText, { color: colors.text }]}>Tap to open map</Text>
          </View>
        </TouchableOpacity>
      </AnimatedListItem>

      <AnimatedListItem index={1} direction="down">
        <View style={[styles.searchBox, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search by neighborhood or address"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        {searchSuggestions.length > 0 && (
          <View style={[styles.suggestionsList, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          >
            {searchSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.id}
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSearchText(suggestion.title);
                  setSearchSuggestions([]);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
                  {suggestion.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {searchLoading && (
          <Text style={[styles.suggestionLoading, { color: colors.textSecondary }]}>Searching locations...</Text>
        )}
      </AnimatedListItem>

      <AnimatedListItem index={2} direction="down">
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

      <LoadingOverlay visible={loadingSpots} text="Loading spots…" />

      <Animated.View style={{ opacity: listOpacity }}>
        {visibleSpots.map((spot, index) => {
        const rate = computeHourlyRate({
          baseRate: spot.pricePerHour ?? DEFAULT_BASE_RATE,
          address: spot.address,
          startTime: new Date(),
        });

        return (
          <AnimatedListItem key={spot.id} index={index + 3} direction="up">
            <View style={[
              styles.card,
              { backgroundColor: colors.backgroundCard, borderColor: colors.border },
              focusedSpotId && String(focusedSpotId) === String(spot.id) ? { borderColor: colors.primary, borderWidth: 2, shadowColor: colors.primary, shadowOpacity: 0.12 } : undefined,
            ]}>
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{spot.title}</Text>
                <Text style={[styles.price, { color: colors.primary }]}>${rate.toFixed(2)}/hr</Text>
              </View>
              <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={2}>{spot.address}</Text>
              {
                (() => {
                  const effectiveLat = spot.latitude ?? geocodedCoords[spot.id]?.latitude;
                  const effectiveLng = spot.longitude ?? geocodedCoords[spot.id]?.longitude;
                  if (effectiveLat != null && effectiveLng != null) {
                    return (
                      <View style={[styles.miniMapContainer, { borderColor: colors.border }]}>
                        <MapView
                          pointerEvents="none"
                          style={styles.miniMap}
                          provider={PROVIDER_GOOGLE}
                          initialRegion={{
                            latitude: effectiveLat,
                            longitude: effectiveLng,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          }}
                          region={{
                            latitude: effectiveLat,
                            longitude: effectiveLng,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          }}
                        >
                          <Marker coordinate={{ latitude: effectiveLat, longitude: effectiveLng }} />
                        </MapView>
                      </View>
                    );
                  }

                  return (
                    <View style={[styles.miniMapPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.miniMapText, { color: colors.textSecondary }]}>Location unavailable</Text>
                    </View>
                  );
                })()
              }
              <View style={styles.cardActionsTriple}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.border, flex: 1 }]}
                  onPress={async () => {
                    const resolved = await resolveSpotCoordinates(spot);
                    const effectiveLat = resolved?.lat ?? spot.latitude ?? geocodedCoords[spot.id]?.latitude;
                    const effectiveLng = resolved?.lng ?? spot.longitude ?? geocodedCoords[spot.id]?.longitude;

                    if (effectiveLat != null && effectiveLng != null) {
                      router.push({ pathname: '/map', params: { lat: String(effectiveLat), lng: String(effectiveLng) } });
                    } else {
                      Alert.alert('Location unavailable', 'We could not find map coordinates for this spot yet.');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>View on Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tertiaryBtn, { borderColor: colors.border, marginHorizontal: 8, opacity: processingSpotId === String(spot.id) ? 0.6 : 1 }]}
                  onPress={() => onBookNowSpot(spot)}
                  activeOpacity={0.8}
                  disabled={processingSpotId === String(spot.id)}
                >
                  <Text style={[styles.tertiaryBtnText, { color: colors.text }]}>{processingSpotId === String(spot.id) ? 'Processing…' : 'Park Now'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={() => {
                    // open reserve modal to pick date/time/duration
                    setReserveSpot(spot);
                    const now = new Date();
                    const nextHour = new Date(now.getTime());
                    nextHour.setMinutes(0, 0, 0);
                    nextHour.setHours(nextHour.getHours() + 1);
                    setReserveDate(nextHour);
                    setReserveHour(nextHour.getHours());
                    setReserveDurationHours(1);
                    setReserveModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Reserve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedListItem>
        );
        })}
      </Animated.View>

      {visibleSpots.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No spots match this filter</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Try a different search term or switch filters.</Text>
        </View>
      )}
      <Modal visible={bookNowModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Start parking now</Text>
            <Text style={[styles.modalAddress, { color: colors.text }]} numberOfLines={2}>{bookNowSpot?.address ?? bookNowSpot?.title ?? 'Selected spot'}</Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Duration (defaults to 30m)</Text>
            <View style={styles.durationGrid}>
              {[
                { m: 15, label: '15m' },
                { m: 30, label: '30m' },
                { m: 60, label: '1h' },
                { m: 120, label: '2h' },
                { m: 180, label: '3h' },
                { m: 240, label: '4h' },
                { m: 720, label: 'All day' },
              ].map((opt) => (
                <TouchableOpacity
                  key={String(opt.m)}
                  style={[styles.durationButton, bookNowDuration === opt.m && { backgroundColor: colors.primary }]}
                  onPress={() => setBookNowDuration(opt.m)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.durationButtonText, bookNowDuration === opt.m ? { color: '#fff' } : { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={() => confirmBookNow(bookNowDuration)} activeOpacity={0.85}>
                <Text style={[styles.confirmButtonText]}>Start parking</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => { setBookNowModalVisible(false); setBookNowSpot(null); }} activeOpacity={0.85}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={reserveModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reserve spot</Text>
            <Text style={[styles.modalAddress, { color: colors.text }]} numberOfLines={2}>{reserveSpot?.address ?? reserveSpot?.title ?? 'Selected spot'}</Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Select date</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setReserveDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })} style={{ padding: 8 }}>
                <Text style={{ color: colors.textSecondary }}>◀</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{reserveDate.toDateString()}</Text>
              <TouchableOpacity onPress={() => setReserveDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })} style={{ padding: 8 }}>
                <Text style={{ color: colors.textSecondary }}>▶</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Select start time (hourly)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 8 }}>
              {Array.from({ length: 24 }).map((_, h) => {
                const label = (() => {
                  const hour = h % 24;
                  const am = hour < 12;
                  const display = hour % 12 === 0 ? 12 : hour % 12;
                  return `${display} ${am ? 'AM' : 'PM'}`;
                })();
                return (
                  <TouchableOpacity
                    key={String(h)}
                    onPress={() => setReserveHour(h)}
                    style={[styles.durationButton, reserveHour === h && { backgroundColor: colors.primary }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.durationButtonText, reserveHour === h ? { color: '#fff' } : { color: colors.text }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Duration (hours)</Text>
            <View style={styles.durationGrid}>
              {[1,2,3,4,6,8,12].map((h) => (
                <TouchableOpacity key={String(h)} style={[styles.durationButton, reserveDurationHours === h && { backgroundColor: colors.primary }]} onPress={() => setReserveDurationHours(h)} activeOpacity={0.85}>
                  <Text style={[styles.durationButtonText, reserveDurationHours === h ? { color: '#fff' } : { color: colors.text }]}>{`${h}h`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={() => {
                if (!reserveSpot) return;
                // build start and end ISO strings
                const start = new Date(reserveDate.getFullYear(), reserveDate.getMonth(), reserveDate.getDate(), reserveHour, 0, 0);
                const end = new Date(start.getTime() + reserveDurationHours * 60 * 60 * 1000);
                setReserveModalVisible(false);
                setReserveSpot(null);
                // navigate to map and open booking sheet with params
                router.push({ pathname: '/map', params: { spotId: reserveSpot.id, openBooking: 'true', date: start.toISOString(), startTime: start.toISOString(), endTime: end.toISOString() } });
              }} activeOpacity={0.85}>
                <Text style={[styles.confirmButtonText]}>Reserve for {reserveDurationHours}h</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => { setReserveModalVisible(false); setReserveSpot(null); }} activeOpacity={0.85}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    height: 235,
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
  suggestionsList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 13,
  },
  suggestionLoading: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
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
  cardActionsTriple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  tertiaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
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
