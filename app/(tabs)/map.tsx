import { useTheme } from '@/contexts/ThemeContext';
import {
  BookingMode,
  computeBookingPriceBreakdown,
  DEFAULT_PARK_NOW_DURATION_MINUTES,
  getHourlyRateForMode,
  PARK_NOW_MIN_AVAILABILITY_MINUTES,
} from '@/lib/booking';
import { Listing, mapSpotRow } from '@/lib/listings';
import { DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { DatePickerModal } from 'react-native-paper-dates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Design tokens for consistent UI
const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Simple function to calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const FILTER_OPTIONS = [
  { id: 'available', label: 'Available Now' },
  { id: 'under10', label: 'Under $10' },
  { id: 'driveway', label: 'Driveway' },
  { id: 'garage', label: 'Garage' },
];

const RADIUS_OPTIONS = [0.5, 1, 3, 5, 10, 25];
const BOOKING_SNAP_POINTS = [25, 55, 90] as const;

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filteredSpots, setFilteredSpots] = useState<Listing[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Listing | null>(null);
  const [slideAnim] = useState(new Animated.Value(300));
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; lat: number; lng: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [radiusConfirmed, setRadiusConfirmed] = useState(false);
  const [radiusPickerVisible, setRadiusPickerVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [bookingSheetSnap, setBookingSheetSnap] = useState<(typeof BOOKING_SNAP_POINTS)[number]>(55);
  const [bookingMode, setBookingMode] = useState<BookingMode>('parkNow');
  const [parkNowDurationMinutes, setParkNowDurationMinutes] = useState(DEFAULT_PARK_NOW_DURATION_MINUTES);
  const [selectedDurationPreset, setSelectedDurationPreset] = useState(30);
  const [reservationStart, setReservationStart] = useState<Date | null>(null);
  const [reservationEnd, setReservationEnd] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const [processingBooking, setProcessingBooking] = useState(false);
  const [unavailableNowSpotIds, setUnavailableNowSpotIds] = useState<Set<string>>(new Set());
  const [filterMenuExpanded, setFilterMenuExpanded] = useState(false);
  const handledOpenBookingRef = useRef(false);
  const handledViewSpotRef = useRef(false);

  const params = useLocalSearchParams();

  const readSingleParam = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const isViewSpot = useMemo(
    () => readSingleParam(params.viewSpot as string | string[] | undefined) === 'true',
    [params.viewSpot]
  );

  const focusCoordinate = useMemo(() => {
    const latParam = readSingleParam(params.lat as string | string[] | undefined);
    const lngParam = readSingleParam(params.lng as string | string[] | undefined);
    if (!latParam || !lngParam) return null;

    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [params.lat, params.lng]);

  const focusedSpotMeta = useMemo(() => {
    const title = params.spotTitle ? decodeURIComponent(String(params.spotTitle)) : 'Selected spot';
    const address = params.spotAddress ? decodeURIComponent(String(params.spotAddress)) : '';
    const rawPrice = Number(params.viewPrice);
    const price = Number.isFinite(rawPrice) ? rawPrice : null;
    return { title, address, price };
  }, [params.spotTitle, params.spotAddress, params.viewPrice]);

  // Handle opening search from external navigation
  useEffect(() => {
    if (params.openSearch === 'true') {
      setSearchActive(true);
    }
  }, [params.openSearch]);

  // Handle centering map on provided coordinates
  useEffect(() => {
    if (focusCoordinate && mapRef) {
      if (isViewSpot) {
        setSearchLocation(null);
        setRadiusConfirmed(false);
      } else {
        setSearchLocation({ lat: focusCoordinate.lat, lng: focusCoordinate.lng });
        setRadiusConfirmed(true);
      }

      mapRef.animateToRegion({
        latitude: focusCoordinate.lat,
        longitude: focusCoordinate.lng,
        latitudeDelta: isViewSpot ? 0.012 : 0.05,
        longitudeDelta: isViewSpot ? 0.012 : 0.05,
      }, 1000);
    }
  }, [focusCoordinate, isViewSpot, mapRef]);

  const fetchSpots = useCallback(async () => {
    const { data, error } = await supabase.from('spots').select('*');
    if (error) {
      setFilteredSpots([]);
      return;
    }

    const mapped = (data ?? []).map(mapSpotRow);

    // If some spots are missing lat/lng, try a free client-side geocode (Photon)
    // This does NOT persist results to the DB; it only enables markers to display immediately.
    const missing = mapped.filter((s) => s.latitude == null || s.longitude == null);
    if (missing.length > 0) {
      const toGeocode = missing.slice(0, 10); // limit per-load to be polite
      await Promise.all(toGeocode.map(async (spot) => {
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
            spot.latitude = lat;
            spot.longitude = lng;
          }
          // polite pause per request handled by Promise.all limit above
        } catch {
          // ignore geocode failures; spot stays without coords
        }
      }));
    }

    const withCoords = mapped.filter((spot) => spot.latitude != null && spot.longitude != null);

    if (searchLocation && radiusConfirmed) {
      const nearby = withCoords
        .filter((spot) => {
          const distance = calculateDistance(searchLocation.lat, searchLocation.lng, spot.latitude!, spot.longitude!);
          return distance < radiusMiles;
        })
        .sort((a, b) => {
          const distA = calculateDistance(searchLocation.lat, searchLocation.lng, a.latitude!, a.longitude!);
          const distB = calculateDistance(searchLocation.lat, searchLocation.lng, b.latitude!, b.longitude!);
          return distA - distB;
        });
      setFilteredSpots(nearby);
    } else {
      // Default to showing all spots until a radius search is confirmed.
      setFilteredSpots(withCoords);
    }
  }, [searchLocation, radiusMiles, radiusConfirmed]);

  useEffect(() => {
    fetchSpots();
    const channel = supabase
      .channel('spots-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, () => {
        fetchSpots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSpots]);

  const handleMarkerPress = useCallback((spot: Listing) => {
    setSelectedSpot(spot);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const getFocusedSpotForReserve = useCallback((): Listing | null => {
    if (!isViewSpot || !focusCoordinate) return null;

    const spotId = readSingleParam(params.spotId as string | string[] | undefined);
    if (!spotId) return null;

    const existing = filteredSpots.find((s) => String(s.id) === String(spotId));
    if (existing) return existing;

    return {
      id: String(spotId),
      title: focusedSpotMeta.title || 'Parking Spot',
      address: focusedSpotMeta.address || 'Address unavailable',
      latitude: focusCoordinate.lat,
      longitude: focusCoordinate.lng,
      pricePerHour: focusedSpotMeta.price ?? DEFAULT_BASE_RATE,
      status: 'Active',
      spots: 1,
    };
  }, [filteredSpots, focusCoordinate, focusedSpotMeta, isViewSpot, params.spotId]);

  const handleCardClose = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSelectedSpot(null));
  };

  const cardPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return gestureState.dy > 14 && isVerticalSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        slideAnim.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.9;

        if (shouldClose) {
          handleCardClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const openBookingSheet = useCallback((spot: Listing, mode: BookingMode = 'parkNow') => {
    const now = new Date();
    setBookingMode(mode);
    setProcessingBooking(false);

    if (mode === 'parkNow') {
      const start = now;
      const end = new Date(start.getTime() + parkNowDurationMinutes * 60000);
      setReservationStart(start);
      setReservationEnd(end);
    } else if (params.date && params.startTime && params.endTime) {
      const selectedDate = new Date(String(params.date));
      const selectedStart = new Date(String(params.startTime));
      const selectedEnd = new Date(String(params.endTime));

      const start = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedStart.getHours(),
        selectedStart.getMinutes()
      );
      const end = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedEnd.getHours(),
        selectedEnd.getMinutes()
      );

      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      setReservationStart(start);
      setReservationEnd(end);
    } else {
      const start = new Date(now.getTime() + 60 * 60000);
      const end = new Date(start.getTime() + 60 * 60000);
      setReservationStart(start);
      setReservationEnd(end);
    }

    setSelectedSpot(spot);
    setBookingSheetSnap(55);
    setBookingSheetVisible(true);
  }, [params.date, params.endTime, params.startTime, parkNowDurationMinutes]);

  const adjustParkNowDuration = useCallback((deltaMinutes: number) => {
    const nextMinutes = Math.max(15, parkNowDurationMinutes + deltaMinutes);
    const start = new Date();
    setSelectedDurationPreset(deltaMinutes);
    setParkNowDurationMinutes(nextMinutes);
    setReservationStart(start);
    setReservationEnd(new Date(start.getTime() + nextMinutes * 60000));
  }, [parkNowDurationMinutes]);

  const checkOverlap = useCallback(async (spotId: string, start: Date, end: Date) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('spot_id', spotId)
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString())
      .in('status', ['pending', 'active'])
      .limit(1);

    if (error) {
      return { blocked: false, error: error.message };
    }

    return { blocked: (data ?? []).length > 0, error: null as string | null };
  }, []);

  const refreshUnavailableNow = useCallback(async () => {
    const now = new Date();
    const end = new Date(now.getTime() + PARK_NOW_MIN_AVAILABILITY_MINUTES * 60000);

    const { data } = await supabase
      .from('bookings')
      .select('spot_id')
      .lt('start_time', end.toISOString())
      .gt('end_time', now.toISOString())
      .in('status', ['pending', 'active']);

    const blocked = new Set<string>((data ?? []).map((row: any) => String(row?.spot_id)).filter(Boolean));
    setUnavailableNowSpotIds(blocked);
  }, []);

  // If arriving from Browse with openBooking and a spotId, pre-select that spot and open the booking editor
  useEffect(() => {
    if (params.openBooking !== 'true') {
      handledOpenBookingRef.current = false;
      return;
    }

    if (handledOpenBookingRef.current) return;

    if (params.openBooking === 'true' && params.spotId && filteredSpots.length > 0) {
      const target = filteredSpots.find((s) => String(s.id) === String(params.spotId));
      if (target) {
        handledOpenBookingRef.current = true;
        setSelectedSpot(target);
        // open reserve flow so user can edit date range and confirm
        openBookingSheet(target, 'reserve');
      }
    }
  }, [params.openBooking, params.spotId, filteredSpots, openBookingSheet]);

  useEffect(() => {
    if (params.viewSpot !== 'true') {
      handledViewSpotRef.current = false;
      return;
    }

    if (handledViewSpotRef.current) return;
    if (!params.spotId) return;

    const target = getFocusedSpotForReserve();
    if (!target) return;

    handledViewSpotRef.current = true;
    handleMarkerPress(target);
  }, [getFocusedSpotForReserve, handleMarkerPress, params.spotId, params.viewSpot]);

  useEffect(() => {
    refreshUnavailableNow();
    const channel = supabase
      .channel('bookings-map-overlap')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        refreshUnavailableNow();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshUnavailableNow]);

  const formatDateLabel = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const openDatePickerForField = (field: 'start' | 'end') => {
    if (field === 'end' && !reservationStart) return;
    setActiveField(field);
    setPickerOpen(true);
  };

  const onSelectDate = (day: Date) => {
    if (!activeField) return;

    if (activeField === 'start') {
      const sourceStart = reservationStart ?? new Date();
      const nextStart = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        sourceStart.getHours(),
        sourceStart.getMinutes(),
        0,
        0
      );

      setReservationStart(nextStart);

      if (reservationEnd && reservationEnd.getTime() < nextStart.getTime()) {
        setReservationEnd(null);
      }

      setPickerOpen(false);
      setActiveField(null);
      return;
    }

    if (!reservationStart) return;

    const sourceEnd = reservationEnd ?? new Date(reservationStart.getTime() + 60 * 60 * 1000);
    const nextEnd = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      sourceEnd.getHours(),
      sourceEnd.getMinutes(),
      0,
      0
    );

    if (nextEnd.getTime() < reservationStart.getTime()) {
      Alert.alert('Invalid end date', 'End date cannot be before start date.');
      return;
    }

    setReservationEnd(nextEnd);
    setPickerOpen(false);
    setActiveField(null);
  };

  const bookingPrice = useMemo(() => {
    if (!selectedSpot || !reservationStart || !reservationEnd) return null;
    return computeBookingPriceBreakdown({
      mode: bookingMode,
      start: reservationStart,
      end: reservationEnd,
      hostRate: selectedSpot.pricePerHour,
    });
  }, [bookingMode, reservationEnd, reservationStart, selectedSpot]);

  const handleConfirmAndPay = async () => {
    if (!selectedSpot || !reservationStart || !reservationEnd || !bookingPrice) {
      return;
    }

    if (bookingMode === 'reserve' && reservationEnd.getTime() < reservationStart.getTime()) {
      Alert.alert('Invalid dates', 'End date cannot be before start date.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Sign in required', 'Please log in to book a spot.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => {
          setBookingSheetVisible(false);
          router.push('/(auth)/login');
        }},
      ]);
      return;
    }

    setProcessingBooking(true);

    const overlapResult = await checkOverlap(selectedSpot.id, reservationStart, reservationEnd);
    if (overlapResult.error) {
      setProcessingBooking(false);
      Alert.alert('Availability check failed', overlapResult.error);
      return;
    }

    if (overlapResult.blocked) {
      setProcessingBooking(false);
      Alert.alert('Spot unavailable', 'This spot is already booked for that time window.');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 950));

    const status = bookingMode === 'parkNow' ? 'active' : 'pending';
    const payload = {
      spot_id: selectedSpot.id,
      user_id: user.id,
      start_time: reservationStart.toISOString(),
      end_time: reservationEnd.toISOString(),
      status,
      total_price: bookingPrice.total,
      platform_fee: bookingPrice.platformFee,
      host_payout: bookingPrice.hostPayout,
      created_at: new Date().toISOString(),
    };

    let { data: inserted, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const looksLikeOptionalColumns = msg.includes('platform_fee') || msg.includes('host_payout') || msg.includes('total_price') || msg.includes('column') || msg.includes('schema cache');
      if (looksLikeOptionalColumns) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('bookings')
          .insert({
            spot_id: selectedSpot.id,
            user_id: user.id,
            start_time: reservationStart.toISOString(),
            end_time: reservationEnd.toISOString(),
            status,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (fallbackError) {
          setProcessingBooking(false);
          Alert.alert('Booking failed', fallbackError.message || 'Unable to create booking.');
          return;
        }

        void fallbackData;
      } else {
        setProcessingBooking(false);
        Alert.alert('Booking failed', error.message || 'Unable to create booking.');
        return;
      }
    }
    void inserted;

    setProcessingBooking(false);
    setBookingSheetVisible(false);
    handleCardClose();

    if (bookingMode === 'parkNow') {
      Alert.alert('Parking started', 'Your Park Now session is active.');
      refreshUnavailableNow();
      return;
    }

    Alert.alert('Reservation confirmed', 'Your future booking is confirmed and saved in Reservations.');
    refreshUnavailableNow();
    router.push('/reservations');
  };

  const handleRegionChange = (region: any) => {
    void region;
  };

  const handleSearch = (location: { title: string; lat: number; lng: number }) => {
    setSearchText(location.title);
    setSearchActive(false);
    setSearchLocation({ lat: location.lat, lng: location.lng });
    setRadiusConfirmed(true);
    setViewMode('map');

    // Animate map to location
    if (mapRef) {
      mapRef.animateToRegion({
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  const searchBarLabel = searchText || 'Find parking near…';

  useEffect(() => {
    if (!searchActive) return;
    const trimmed = searchText.trim();

    if (trimmed.length < 3) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6&lang=en`;
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

        if (nextResults.length === 0) {
          setSearchError('No results found.');
          setSearchResults([]);
          return;
        }

        setSearchResults(nextResults as { id: string; title: string; lat: number; lng: number }[]);
      } catch {
        setSearchError('Network error while searching.');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText, searchActive]);

  const appliedSpots = useMemo(() => {
    if (selectedFilters.length === 0) return filteredSpots;

    // Apply all filters - spot must match ALL selected filters (AND logic)
    return filteredSpots.filter((s) => selectedFilters.every((filterId) => {
      if (filterId === 'under10') return (s.pricePerHour ?? 0) < 10;
      if (filterId === 'available') return !unavailableNowSpotIds.has(String(s.id));
      if (filterId === 'driveway') return s.title.toLowerCase().includes('driveway');
      if (filterId === 'garage') return s.title.toLowerCase().includes('garage');
      return true;
    }));
  }, [filteredSpots, selectedFilters, unavailableNowSpotIds]);

  const sortedSpots = useMemo(() => (
    [...appliedSpots].sort((a, b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0))
  ), [appliedSpots]);

  const getSpotRate = useCallback((spot: Listing) => getHourlyRateForMode(spot.pricePerHour ?? DEFAULT_BASE_RATE, 'parkNow'), []);

  const spotRatesById = useMemo(() => {
    const rates: Record<string, number> = {};
    for (const spot of appliedSpots) {
      rates[spot.id] = getSpotRate(spot);
    }
    return rates;
  }, [appliedSpots, getSpotRate]);

  const renderListItem = useCallback(({ item }: { item: Listing }) => {
    const computedRate = getSpotRate(item);

    return (
    <TouchableOpacity 
      style={[styles.listCard, { backgroundColor: colors.backgroundCard }]}
      onPress={() => { 
        setSelectedSpot(item); 
        setViewMode('map'); 
      }}
      activeOpacity={0.7}
    >
      <View style={styles.listCardContent}>
        <Text style={[styles.listCardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.listCardAddress, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
      </View>
      <Text style={[styles.listCardPrice, { color: colors.primary }]}>
        ${computedRate.toFixed(2)}/hr
      </Text>
    </TouchableOpacity>
  );
  }, [colors, getSpotRate, setSelectedSpot, setViewMode]);

  const keyExtractor = useCallback((item: Listing) => item.id.toString(), []);

  const selectedSpotDistanceMiles = useMemo(() => {
    if (!selectedSpot || !searchLocation || selectedSpot.latitude == null || selectedSpot.longitude == null) return null;
    return calculateDistance(searchLocation.lat, searchLocation.lng, selectedSpot.latitude, selectedSpot.longitude);
  }, [searchLocation, selectedSpot]);

  const bookingSheetHeight = `${bookingSheetSnap}%` as const;

  const formatMinutesToLabel = (minutes: number) => {
    const safeMinutes = Math.max(0, minutes);
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;

    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        pointerEvents="none"
        style={[styles.topSafeArea, { height: insets.top, backgroundColor: colors.background }]}
      />
      <MapView
        ref={setMapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        onRegionChangeComplete={handleRegionChange}
      >
          {isViewSpot && focusCoordinate && (
            <Marker
              coordinate={{ latitude: focusCoordinate.lat, longitude: focusCoordinate.lng }}
              tracksViewChanges={false}
              tracksInfoWindowChanges={false}
              zIndex={999}
              onPress={() => {
                const target = getFocusedSpotForReserve();
                if (target) handleMarkerPress(target);
              }}
            >
              <View style={[styles.focusPricePill, { backgroundColor: colors.primary }]}>
                <Text style={styles.focusPricePillText}>
                  {focusedSpotMeta.price != null ? `$${focusedSpotMeta.price.toFixed(0)}` : 'Spot'}
                </Text>
              </View>
            </Marker>
          )}

          {searchLocation && radiusConfirmed && (
            <Circle
              center={{ latitude: searchLocation.lat, longitude: searchLocation.lng }}
              radius={radiusMiles * 1609.34}
              strokeWidth={1}
              strokeColor={`${colors.primary}66`}
              fillColor={`${colors.primary}1A`}
            />
          )}
          {appliedSpots.map((spot) => (
            spot.latitude != null && spot.longitude != null ? (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.latitude!, longitude: spot.longitude! }}
              onPress={() => handleMarkerPress(spot)}
              tracksViewChanges={false}
              tracksInfoWindowChanges={false}
            >
              <TouchableOpacity
                style={[
                  styles.pricePill,
                  { backgroundColor: colors.primary },
                  selectedSpot?.id === spot.id
                    ? [styles.pricePillSelected, { borderColor: colors.text }]
                    : undefined,
                ]}
              >
                <Text style={styles.pillText}>
                  ${(spotRatesById[spot.id] ?? getSpotRate(spot)).toFixed(0)}
                </Text>
              </TouchableOpacity>
            </Marker>
            ) : null
          ))}
      </MapView>

      {/* Search Bar at Top */}
      <TouchableOpacity 
        style={[
          styles.searchBarContainer,
          { top: insets.top + SPACING.md, backgroundColor: colors.backgroundCard }
        ]}
        onPress={() => setSearchActive(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.searchBarText, { color: colors.text }]} numberOfLines={1}>
          {searchBarLabel}
        </Text>
      </TouchableOpacity>

      {isViewSpot && focusCoordinate && (
        <View
          style={[
            styles.focusBanner,
            {
              top: insets.top + SPACING.md + 54,
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.focusBannerText, { color: colors.text }]} numberOfLines={1}>
            {focusedSpotMeta.price != null
              ? `Viewing: ${focusedSpotMeta.title} • $${focusedSpotMeta.price.toFixed(2)}/hr`
              : `Viewing: ${focusedSpotMeta.title}`}
          </Text>
        </View>
      )}

      {/* Clear Location */}
      <TouchableOpacity
        style={[
          styles.clearButton,
          {
            bottom: insets.bottom + SPACING.md + 48,
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
        onPress={() => {
          setSearchLocation(null);
          setSearchText('');
          setSearchResults([]);
          setSearchError(null);
          setRadiusConfirmed(false);
          setRadiusPickerVisible(false);
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.clearButtonText, { color: colors.background }]}>Clear</Text>
      </TouchableOpacity>

      {/* Radius Adjust */}
      {radiusConfirmed && (
        <TouchableOpacity
          style={[
            styles.radiusAdjustButton,
            {
              bottom: insets.bottom + SPACING.md + 88,
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
          onPress={() => setRadiusPickerVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.radiusAdjustText, { color: colors.background }]}>{radiusMiles} mi</Text>
        </TouchableOpacity>
      )}

      {/* Adjust Radius */}
      <Modal visible={radiusPickerVisible} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmContent, { backgroundColor: colors.backgroundCard }]}
          >
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Adjust Radius</Text>

            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((option) => {
                const active = option === radiusMiles;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radiusOption,
                      { borderColor: colors.border },
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setRadiusMiles(option)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.radiusOptionText, { color: active ? colors.background : colors.text }]}>{option} mi</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={() => setRadiusPickerVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCancelButton, { borderColor: colors.border }]}
                onPress={() => setRadiusPickerVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal visible={searchActive} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: insets.top + 40, backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Search Location</Text>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Enter destination address"
              placeholderTextColor={colors.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />

            {searchError && (
              <Text style={[styles.searchHint, { color: colors.badgeCancelled }]}>{searchError}</Text>
            )}

            {!searchError && searchText.trim().length < 3 && (
              <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Type at least 3 characters</Text>
            )}

            <ScrollView style={styles.suggestionsList}>
              {searchLoading && (
                <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Searching...</Text>
              )}
              {!searchLoading && searchResults.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleSearch({ title: suggestion.title, lat: suggestion.lat, lng: suggestion.lng })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.border }]}
              onPress={() => setSearchActive(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map/List View Toggle - Top Right */}
      <View style={[styles.viewToggleContainer, { top: insets.top + SPACING.md, backgroundColor: colors.backgroundCard }]}>
        <TouchableOpacity 
          onPress={() => setViewMode('map')} 
          style={[styles.toggleButton, viewMode === 'map' && [styles.toggleActive, { backgroundColor: colors.background }]]}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, { color: colors.textSecondary }, viewMode === 'map' && [styles.toggleTextActive, { color: colors.primary }]]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setViewMode('list')} 
          style={[styles.toggleButton, viewMode === 'list' && [styles.toggleActive, { backgroundColor: colors.background }]]}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, { color: colors.textSecondary }, viewMode === 'list' && [styles.toggleTextActive, { color: colors.primary }]]}>List</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Filter Menu - Bottom Right */}
      <View style={[styles.floatingFilterContainer, { bottom: insets.bottom + SPACING.md }]}>
        {!filterMenuExpanded ? (
          // Collapsed state: Compact floating button
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => setFilterMenuExpanded(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterButtonText, { color: colors.text }]}>Filters</Text>
            {selectedFilters.length > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={styles.filterBadgeText}>{selectedFilters.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          // Expanded state: Compact filter panel
          <View style={[styles.filterPanel, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>Filter</Text>
              <TouchableOpacity 
                onPress={() => setFilterMenuExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.filterCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              {FILTER_OPTIONS.map((filter) => {
                const isSelected = selectedFilters.includes(filter.id);
                return (
                  <TouchableOpacity
                    key={filter.id}
                    style={[
                      styles.filterOption,
                      isSelected && [styles.filterOptionActive, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }],
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedFilters(selectedFilters.filter(f => f !== filter.id));
                      } else {
                        setSelectedFilters([...selectedFilters, filter.id]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: colors.textSecondary },
                        isSelected && [styles.filterOptionTextActive, { color: colors.primary }],
                      ]}
                    >
                      {filter.label}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.filterCheckmark, { color: colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedFilters.length > 0 && (
              <TouchableOpacity
                style={[styles.clearFilterButton, { backgroundColor: colors.background, borderTopColor: colors.border }]}
                onPress={() => {
                  setSelectedFilters([]);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.clearFilterText, { color: colors.textSecondary }]}>
                  Clear All ({selectedFilters.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Tap outside to close filter menu */}
      {filterMenuExpanded && (
        <TouchableOpacity
          style={styles.filterBackdrop}
          onPress={() => setFilterMenuExpanded(false)}
          activeOpacity={1}
        />
      )}

      {/* List view overlay */}
      {viewMode === 'list' && (
        <View style={[styles.listOverlay, { 
          top: insets.top + 80,
          bottom: insets.bottom + SPACING.md 
        }]}>
          <FlatList
            data={sortedSpots}
            keyExtractor={keyExtractor}
            renderItem={renderListItem}
            contentContainerStyle={{ paddingBottom: SPACING.lg }}
            initialNumToRender={8}
            windowSize={5}
            removeClippedSubviews
          />
        </View>
      )}

      {/* Bottom Sheet Card */}
      {selectedSpot && (
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + SPACING.md,
              backgroundColor: colors.backgroundCard,
            },
          ]}
        >
          <View
            style={styles.cardHandleTouchZone}
            {...cardPanResponder.panHandlers}
          >
            <View style={[styles.cardHandle, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{selectedSpot.title}</Text>
            <Text style={[styles.cardAddress, { color: colors.textSecondary }]} numberOfLines={2}>{selectedSpot.address}</Text>
            <Text style={[styles.cardPrice, { color: colors.primary }]}>
              ${getSpotRate(selectedSpot).toFixed(2)}/hr
            </Text>
            {selectedSpotDistanceMiles != null && (
              <Text style={[styles.cardAddress, { color: colors.textSecondary }]}>
                {selectedSpotDistanceMiles.toFixed(2)} mi away
              </Text>
            )}
            <Text
              style={[
                styles.availabilityBadge,
                {
                  color: unavailableNowSpotIds.has(String(selectedSpot.id)) ? colors.badgeCancelled : colors.badgeConfirmed,
                },
              ]}
            >
              {unavailableNowSpotIds.has(String(selectedSpot.id)) ? 'Unavailable now' : 'Available now'}
            </Text>

            <TouchableOpacity
              style={[styles.reserveButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setBookingMode('parkNow');
                openBookingSheet(selectedSpot, 'parkNow');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.reserveButtonText}>Park Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondarySheetButton, { borderColor: colors.border }]}
              onPress={() => {
                setBookingMode('reserve');
                openBookingSheet(selectedSpot, 'reserve');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondarySheetButtonText, { color: colors.text }]}>Reserve</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Booking sheet */}
      <Modal visible={bookingSheetVisible} animationType="slide" transparent>
        <>
          <View style={styles.paymentModalOverlay}> 
            <View style={[styles.paymentModalContent, { height: bookingSheetHeight, backgroundColor: colors.backgroundCard }]}> 
              <View style={styles.sheetHandleRow}>
                {BOOKING_SNAP_POINTS.map((snap) => (
                  <TouchableOpacity
                    key={snap}
                    style={[
                      styles.snapDot,
                      { borderColor: colors.border },
                      bookingSheetSnap === snap && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setBookingSheetSnap(snap)}
                    activeOpacity={0.8}
                  />
                ))}
              </View>

              <ScrollView style={styles.sheetScrollable} contentContainerStyle={styles.sheetScrollableContent}>
                <Text style={[styles.paymentTitle, { color: colors.text }]}>Confirm Booking</Text>

                <View style={[styles.modeTabs, { backgroundColor: colors.background }]}> 
                  <TouchableOpacity
                    style={[styles.modeTab, bookingMode === 'parkNow' && { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setBookingMode('parkNow');
                      if (selectedSpot) openBookingSheet(selectedSpot, 'parkNow');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modeTabText, { color: bookingMode === 'parkNow' ? '#fff' : colors.textSecondary }]}>Park Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeTab, bookingMode === 'reserve' && { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setBookingMode('reserve');
                      if (selectedSpot) openBookingSheet(selectedSpot, 'reserve');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modeTabText, { color: bookingMode === 'reserve' ? '#fff' : colors.textSecondary }]}>Reserve</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.paymentHeaderRow}>
                  <View style={styles.paymentHeaderText}>
                    <Text style={[styles.paymentSpotTitle, { color: colors.text }]} numberOfLines={1}>{selectedSpot?.title}</Text>
                    <Text style={[styles.paymentSpotAddress, { color: colors.textSecondary }]} numberOfLines={1}>{selectedSpot?.address}</Text>
                  </View>
                  <Text style={[styles.paymentTimeText, { color: colors.text }]}> 
                    {reservationStart ? reservationStart.toLocaleDateString() : '--'}
                    {'\n'}{reservationStart ? reservationStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    {'–'}{reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </Text>
                </View>

                <View style={styles.divider} />

                {bookingMode === 'parkNow' ? (
                  <View style={styles.parkNowSection}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Duration</Text>
                    <View style={styles.durationButtonsRow}>
                      {[15, 30, 60].map((minutes) => (
                        <TouchableOpacity
                          key={minutes}
                          style={[
                            styles.durationButton,
                            { borderColor: colors.border },
                            selectedDurationPreset === minutes && {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            },
                          ]}
                          onPress={() => adjustParkNowDuration(minutes)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.durationButtonText,
                              { color: colors.text },
                              selectedDurationPreset === minutes && styles.durationButtonTextSelected,
                            ]}
                          >
                            +{minutes}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Current: {formatMinutesToLabel(parkNowDurationMinutes)}</Text>
                    <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Ends: {reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</Text>
                  </View>
                ) : (
                  <View style={styles.dateRangeContainer}>
                  <Pressable
                    style={[styles.dateField, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => openDatePickerForField('start')}
                  >
                    <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>Start Date</Text>
                    <Text style={[styles.dateFieldValue, { color: reservationStart ? colors.text : colors.textSecondary }]}> 
                      {formatDateLabel(reservationStart) ?? 'Pick a start date'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.dateField,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      !reservationStart && styles.dateFieldDisabled,
                    ]}
                    onPress={() => openDatePickerForField('end')}
                    disabled={!reservationStart}
                  >
                    <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>End Date</Text>
                    <Text style={[styles.dateFieldValue, { color: reservationEnd ? colors.text : colors.textSecondary }]}> 
                      {formatDateLabel(reservationEnd) ?? 'Pick an end date'}
                    </Text>
                  </Pressable>
                  </View>
                )}

                <View style={[styles.costBreakdown, { borderTopColor: colors.border }]}> 
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.text }]}>Subtotal</Text>
                    <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.subtotal.toFixed(2) ?? '0.00'}</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.text }]}>Booking fee</Text>
                    <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.bookingFee.toFixed(2) ?? '0.00'}</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.text }]}>Platform fee (30%)</Text>
                    <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.platformFee.toFixed(2) ?? '0.00'}</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.text }]}>Host payout (70%)</Text>
                    <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.hostPayout.toFixed(2) ?? '0.00'}</Text>
                  </View>
                  <View style={[styles.costRowTotal, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.costLabelTotal, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.costValueTotal, { color: colors.primary }]}> 
                      ${bookingPrice?.total.toFixed(2) ?? '0.00'}
                    </Text>
                  </View>
                  {bookingPrice?.minimumChargeApplied && (
                    <Text style={[styles.minimumChargeNote, { color: colors.textSecondary }]}>Minimum charge applied for short low-rate session.</Text>
                  )}
                </View>
              </ScrollView>

              <View style={[styles.paymentActions, { paddingBottom: insets.bottom + SPACING.xs }]}> 
                <TouchableOpacity
                  style={[styles.paymentButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirmAndPay}
                  activeOpacity={0.8}
                  disabled={processingBooking}
                >
                  <Text style={styles.paymentButtonText}>{processingBooking ? 'Processing...' : `Confirm & Pay $${bookingPrice?.total.toFixed(2) ?? '0.00'}`}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.paymentCancelButton} 
                  onPress={() => setBookingSheetVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paymentCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <DatePickerModal
            locale="en"
            mode="single"
            visible={pickerOpen}
            date={activeField === 'start' ? (reservationStart ?? undefined) : (reservationEnd ?? undefined)}
            onDismiss={() => {
              setPickerOpen(false);
              setActiveField(null);
            }}
            onConfirm={({ date }) => {
              if (date) {
                onSelectDate(date);
                return;
              }

              setPickerOpen(false);
              setActiveField(null);
            }}
            validRange={activeField === 'end' && reservationStart ? { startDate: reservationStart } : undefined}
          />
        </>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Search Bar
  searchBarContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  searchBarText: {
    fontSize: 16,
  },
  focusBanner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  focusBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    position: 'absolute',
    left: SPACING.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  radiusAdjustButton: {
    position: 'absolute',
    left: SPACING.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  radiusAdjustText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  confirmContent: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radiusOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  radiusOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmActions: {
    marginTop: SPACING.md,
    flexDirection: 'row',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginRight: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  confirmCancelText: {
    fontWeight: '600',
  },

  // Search Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.md,
  },
  modalContent: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  searchInput: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    fontSize: 16,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  searchHint: {
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  suggestionItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 15,
  },
  modalButton: {
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Map/List View Toggle (Top Right)
  viewToggleContainer: {
    position: 'absolute',
    right: SPACING.md,
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  toggleButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    minWidth: 50,
    alignItems: 'center',
  },
  toggleActive: {
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    fontWeight: '700',
  },

  // Floating Filter Menu (Bottom Right)
  floatingFilterContainer: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 15,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    minHeight: 36,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  filterPanel: {
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
    borderWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
    marginBottom: 4,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterCloseText: {
    fontSize: 18,
    fontWeight: '400',
  },
  filterOptions: {
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderRadius: 6,
    marginBottom: 2,
    minHeight: 36,
  },
  filterOptionActive: {
  },
  filterOptionText: {
    fontSize: 13,
  },
  filterOptionTextActive: {
    fontWeight: '600',
  },
  filterCheckmark: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearFilterButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.xs,
    borderRadius: 6,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 14,
  },

  // Map Markers
  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  pricePillSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  pillText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  focusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ffffff66',
  },
  focusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  focusPricePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ffffff66',
  },
  focusPricePillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // List View Overlay
  listOverlay: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'transparent',
    zIndex: 12,
  },
  listCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  listCardContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listCardAddress: {
    fontSize: 13,
  },
  listCardPrice: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Bottom Sheet Card
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  cardHandleTouchZone: {
    width: '100%',
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: 'center',
  },
  cardContent: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardAddress: {
    fontSize: 14,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  cardPrice: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  reserveButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 4,
  },
  reserveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  secondarySheetButton: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondarySheetButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  availabilityBadge: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },

  // Payment Modal
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  sheetHandleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  snapDot: {
    width: 24,
    height: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  sheetScrollable: {
    flex: 1,
  },
  sheetScrollableContent: {
    paddingBottom: SPACING.md,
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
  },
  modeTab: {
    flex: 1,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  parkNowSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  durationButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  durationButtonTextSelected: {
    color: '#fff',
  },
  parkNowMeta: {
    fontSize: 13,
    marginTop: 6,
  },
  paymentSpotTitle: {
    fontSize: 16,
    marginBottom: 2,
    fontWeight: '700',
  },
  paymentSpotAddress: {
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  paymentTimeText: {
    fontSize: 13,
    marginBottom: SPACING.xs,
    textAlign: 'right',
  },
  costBreakdown: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  costLabel: {
    fontSize: 15,
  },
  costValue: {
    fontSize: 15,
  },
  costRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  costLabelTotal: {
    fontSize: 17,
    fontWeight: '700',
  },
  costValueTotal: {
    fontSize: 18,
    fontWeight: '800',
  },
  minimumChargeNote: {
    fontSize: 12,
    marginTop: 6,
  },
  paymentActions: {
    marginTop: SPACING.md,
  },
  paymentButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  paymentCancelButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  dateRangeContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 10,
  },
  dateField: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    justifyContent: 'center',
  },
  dateFieldDisabled: {
    opacity: 0.55,
  },
  dateFieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  dateFieldValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#00000010',
    marginVertical: 8,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  paymentCancelText: {
    fontSize: 16,
  },
  activeBookingCard: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    zIndex: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  activeBookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeBookingSpot: {
    fontSize: 15,
    fontWeight: '600',
  },
  activeBookingMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  extendRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: 8,
  },
  extendButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  extendButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

