import LoadingOverlay from '@/components/ui/loading-overlay';
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
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { DatePickerModal } from 'react-native-paper-dates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SPACING = { xs: 8, sm: 12, md: 16, lg: 24 };
const RADIUS = { sm: 8, md: 12, lg: 16 };
const BOOKING_SNAP_POINTS = [18, 50, 92] as const;
const DURATION_PRESETS = [15, 30, 60, 120] as const;

type ActiveBookingBanner = {
  id: string;
  title: string;
  endTime: Date;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [spots, setSpots] = useState<Listing[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; lat: number; lng: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const radarDiameterAnim = useRef(new Animated.Value(0)).current;
  const radarLeftAnim = useRef(new Animated.Value(0)).current;
  const radarTopAnim = useRef(new Animated.Value(0)).current;
  const [radiusConfirmed, setRadiusConfirmed] = useState(false);

  // Ensure radiusConfirmed is false when there is no search location selected.
  useEffect(() => {
    if (!searchLocation) setRadiusConfirmed(false);
  }, [searchLocation]);

  const computeRadarPixelSize = useCallback(async () => {
    if (!mapRef || !searchLocation) {
      return;
    }

    try {
      const centerPt = await (mapRef as any).pointForCoordinate({ latitude: searchLocation.lat, longitude: searchLocation.lng });
      const latRad = (searchLocation.lat * Math.PI) / 180;
      const metersPerDegLon = 111320 * Math.cos(latRad);
      const radiusMeters = radiusMiles * 1609.34;
      const deltaLng = radiusMeters / metersPerDegLon;
      const edgeLng = searchLocation.lng + deltaLng;
      const edgePt = await (mapRef as any).pointForCoordinate({ latitude: searchLocation.lat, longitude: edgeLng });
      const dx = edgePt.x - centerPt.x;
      const dy = edgePt.y - centerPt.y;
      const pxRadius = Math.sqrt(dx * dx + dy * dy);
      const diameter = Math.max(0, pxRadius * 2);
      // animate diameter and position

      // Smoothly animate diameter and position changes
      Animated.parallel([
        Animated.timing(radarDiameterAnim, { toValue: diameter, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(radarLeftAnim, { toValue: centerPt.x - diameter / 2, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(radarTopAnim, { toValue: centerPt.y - diameter / 2, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    } catch {
      Animated.timing(radarDiameterAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }
  }, [mapRef, searchLocation, radiusMiles, radarDiameterAnim, radarLeftAnim, radarTopAnim]);

  // Recompute radar pixel size whenever radius, map region, or search location changes
  useEffect(() => {
    if (!radiusConfirmed || !searchLocation) {
      Animated.parallel([
        Animated.timing(radarDiameterAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(radarLeftAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(radarTopAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
      return;
    }

    // debounce small rapid region ticks
    const t = setTimeout(() => {
      void computeRadarPixelSize();
    }, 120);

    return () => clearTimeout(t);
  }, [radiusConfirmed, searchLocation, radiusMiles, mapRef, computeRadarPixelSize, radarDiameterAnim, radarLeftAnim, radarTopAnim]);

  const [unavailableNowSpotIds, setUnavailableNowSpotIds] = useState<Set<string>>(new Set());

  const [selectedSpot, setSelectedSpot] = useState<Listing | null>(null);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [bookingSheetSnap, setBookingSheetSnap] = useState<(typeof BOOKING_SNAP_POINTS)[number]>(50);
  const [bookingMode, setBookingMode] = useState<BookingMode>('parkNow');
  const [parkNowDurationMinutes, setParkNowDurationMinutes] = useState(DEFAULT_PARK_NOW_DURATION_MINUTES);
  const [selectedDurationPreset, setSelectedDurationPreset] = useState<number | 'custom'>(30);
  const [customDurationModalVisible, setCustomDurationModalVisible] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');

  const [reservationStart, setReservationStart] = useState<Date | null>(null);
  const [reservationEnd, setReservationEnd] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const [processingBooking, setProcessingBooking] = useState(false);

  const [activeBookingBanner, setActiveBookingBanner] = useState<ActiveBookingBanner | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [showUserSearchPin, setShowUserSearchPin] = useState(false);

  const handledOpenBookingRef = useRef(false);
  const handledViewSpotRef = useRef(false);

  const readSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

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

  const focusSpotMeta = useMemo(() => {
    const title = params.spotTitle ? decodeURIComponent(String(params.spotTitle)) : 'Selected spot';
    const address = params.spotAddress ? decodeURIComponent(String(params.spotAddress)) : '';
    const rawPrice = Number(params.viewPrice);
    const price = Number.isFinite(rawPrice) ? rawPrice : null;
    return { title, address, price };
  }, [params.spotAddress, params.spotTitle, params.viewPrice]);

  // Apply radius and view mode from incoming params (e.g., from Home "Find near me")
  useEffect(() => {
    const r = readSingleParam(params.radius as string | string[] | undefined);
    if (r) {
      const n = Number(r);
      if (Number.isFinite(n)) setRadiusMiles(n);
    }

    const show = readSingleParam(params.showList as string | string[] | undefined);
    if (show === 'true') setViewMode('list');
  }, [params.radius, params.showList]);

  const fetchSpots = useCallback(async () => {
    try {
      setLoadingSpots(true);
      const { data, error } = await supabase.from('spots').select('*').order('created_at', { ascending: false });
      if (error) {
        setSpots([]);
        return;
      }

      const mapped = (data ?? []).map(mapSpotRow).filter((spot) => spot.latitude != null && spot.longitude != null);
      setSpots(mapped);
    } finally {
      setLoadingSpots(false);
    }
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

  const refreshActiveBookingBanner = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setActiveBookingBanner(null);
      return;
    }

    const { data } = await supabase
      .from('bookings')
      .select('id, end_time, spot_name, spot_title, spot:spots(title)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('end_time', { ascending: true })
      .limit(1);

    const row = data?.[0];
    if (!row) {
      setActiveBookingBanner(null);
      return;
    }

    const joinedSpot = Array.isArray(row?.spot) ? row.spot[0] : row?.spot;
    const endTime = row?.end_time ? new Date(row.end_time) : null;
    if (!endTime || Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
      setActiveBookingBanner(null);
      return;
    }

    setActiveBookingBanner({
      id: String(row?.id ?? ''),
      title: joinedSpot?.title ?? row?.spot_name ?? row?.spot_title ?? 'Parking Spot',
      endTime,
    });
  }, []);

  useEffect(() => {
    fetchSpots();
    refreshUnavailableNow();
    refreshActiveBookingBanner();

    const spotsChannel = supabase
      .channel('spots-map-clean')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, () => fetchSpots())
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings-map-clean')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        refreshUnavailableNow();
        refreshActiveBookingBanner();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(spotsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [fetchSpots, refreshActiveBookingBanner, refreshUnavailableNow]);

  useEffect(() => {
    if (!activeBookingBanner) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeBookingBanner]);

  useEffect(() => {
    if (!focusCoordinate || !mapRef) return;

    // Do not set `searchLocation` or enable `radiusConfirmed` automatically here
    // because that can produce an unexpected circle overlay. Only animate the
    // map to the focused coordinate (e.g., when tapping a spot or navigating
    // with a spotId) — leave searchLocation unchanged so the radar/circle stays hidden
    // until the user explicitly searches or selects a radius.
    mapRef.animateToRegion({
      latitude: focusCoordinate.lat,
      longitude: focusCoordinate.lng,
      latitudeDelta: isViewSpot ? 0.012 : 0.05,
      longitudeDelta: isViewSpot ? 0.012 : 0.05,
    }, 1000);
  }, [focusCoordinate, isViewSpot, mapRef]);

  // On first mount, try to get user's current location and center the map there.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        // Only animate the map if the user hasn't explicitly focused a different coordinate
        if (mapRef && !focusCoordinate) {
          mapRef.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);
        }
      } catch {
        // ignore location errors silently
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSheetForSpot = useCallback((spot: Listing, mode: BookingMode = 'parkNow') => {
    const now = new Date();
    setSelectedSpot(spot);
    setBookingMode(mode);
    setBookingSheetSnap(50);
    setBookingSheetVisible(true);
    setProcessingBooking(false);

    if (mode === 'parkNow') {
      const start = now;
      const end = new Date(start.getTime() + parkNowDurationMinutes * 60000);
      setReservationStart(start);
      setReservationEnd(end);
      return;
    }

    if (params.date && params.startTime && params.endTime) {
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

      if (end <= start) end.setDate(end.getDate() + 1);
      setReservationStart(start);
      setReservationEnd(end);
    } else {
      const start = new Date(now.getTime() + 60 * 60000);
      const end = new Date(start.getTime() + 60 * 60000);
      setReservationStart(start);
      setReservationEnd(end);
    }
  }, [parkNowDurationMinutes, params.date, params.endTime, params.startTime]);

  const focusedSpotFromParams = useCallback((): Listing | null => {
    if (!isViewSpot || !focusCoordinate) return null;
    const spotId = readSingleParam(params.spotId as string | string[] | undefined);
    if (!spotId) return null;

    const existing = spots.find((s) => String(s.id) === String(spotId));
    if (existing) return existing;

    return {
      id: String(spotId),
      title: focusSpotMeta.title || 'Parking Spot',
      address: focusSpotMeta.address || 'Address unavailable',
      latitude: focusCoordinate.lat,
      longitude: focusCoordinate.lng,
      pricePerHour: focusSpotMeta.price ?? DEFAULT_BASE_RATE,
      status: 'Active',
      spots: 1,
    };
  }, [focusCoordinate, focusSpotMeta.address, focusSpotMeta.price, focusSpotMeta.title, isViewSpot, params.spotId, spots]);

  useEffect(() => {
    if (params.openBooking !== 'true') {
      handledOpenBookingRef.current = false;
      return;
    }

    if (handledOpenBookingRef.current) return;
    if (!params.spotId || spots.length === 0) return;

    const target = spots.find((s) => String(s.id) === String(params.spotId));
    if (!target) return;

    handledOpenBookingRef.current = true;
    openSheetForSpot(target, 'reserve');
  }, [openSheetForSpot, params.openBooking, params.spotId, spots]);

  useEffect(() => {
    if (params.viewSpot !== 'true') {
      handledViewSpotRef.current = false;
      return;
    }

    if (handledViewSpotRef.current) return;
    if (!params.spotId) return;

    const target = focusedSpotFromParams();
    if (!target) return;

    handledViewSpotRef.current = true;
    openSheetForSpot(target, 'parkNow');
  }, [focusedSpotFromParams, openSheetForSpot, params.spotId, params.viewSpot]);

  const applyParkNowDuration = useCallback((rawMinutes: number, preset: number | 'custom') => {
    const minutes = Math.min(12 * 60, Math.max(30, Math.round(rawMinutes)));
    const start = new Date();
    setSelectedDurationPreset(preset);
    setParkNowDurationMinutes(minutes);
    setReservationStart(start);
    setReservationEnd(new Date(start.getTime() + minutes * 60000));
  }, []);

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

  const bookingPrice = useMemo(() => {
    if (!selectedSpot || !reservationStart || !reservationEnd) return null;
    return computeBookingPriceBreakdown({
      mode: bookingMode,
      start: reservationStart,
      end: reservationEnd,
      hostRate: selectedSpot.pricePerHour,
    });
  }, [bookingMode, reservationEnd, reservationStart, selectedSpot]);

  const selectedSpotUnavailable = selectedSpot ? unavailableNowSpotIds.has(String(selectedSpot.id)) : false;

  const formatMinutesLabel = (minutes: number) => {
    const safe = Math.max(0, minutes);
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;

    if (hours > 0) {
      return `${hours}hr ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    }

    return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  };

  const formatRemainingLabel = (endTime: Date) => {
    const minutes = Math.ceil(Math.max(0, endTime.getTime() - nowMs) / 60000);
    return formatMinutesLabel(minutes);
  };

  const formatDateLabel = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const handleConfirmAndPay = async () => {
    if (!selectedSpot || !reservationStart || !reservationEnd || !bookingPrice) return;

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
        {
          text: 'Log In', onPress: () => {
            setBookingSheetVisible(false);
            router.push('/(auth)/login');
          },
        },
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

    await new Promise((resolve) => setTimeout(resolve, 900));

    const status = bookingMode === 'parkNow' ? 'active' : 'pending';
    const basePayload = {
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

    const { error } = await supabase.from('bookings').insert(basePayload);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const optionalCols = msg.includes('platform_fee') || msg.includes('host_payout') || msg.includes('total_price') || msg.includes('column') || msg.includes('schema cache');

      if (optionalCols) {
        const { error: fallbackError } = await supabase.from('bookings').insert({
          spot_id: selectedSpot.id,
          user_id: user.id,
          start_time: reservationStart.toISOString(),
          end_time: reservationEnd.toISOString(),
          status,
          created_at: new Date().toISOString(),
        });

        if (fallbackError) {
          setProcessingBooking(false);
          Alert.alert('Booking failed', fallbackError.message || 'Unable to create booking.');
          return;
        }
      } else {
        setProcessingBooking(false);
        Alert.alert('Booking failed', error.message || 'Unable to create booking.');
        return;
      }
    }

    setProcessingBooking(false);
    setBookingSheetVisible(false);
    setSelectedSpot(null);

    if (bookingMode === 'parkNow') {
      await refreshUnavailableNow();
      await refreshActiveBookingBanner();
      Alert.alert('Parking started', 'Your Park Now booking is now active.');
      return;
    }

    Alert.alert('Reservation confirmed', 'Your booking is confirmed and saved in Reservations.');
    await refreshUnavailableNow();
    router.push('/reservations');
  };

  const displayedSpots = useMemo(() => {
    const source = radiusConfirmed && searchLocation
      ? spots
        .filter((spot) => calculateDistance(searchLocation.lat, searchLocation.lng, spot.latitude!, spot.longitude!) < radiusMiles)
        .sort((a, b) => {
          const distA = calculateDistance(searchLocation.lat, searchLocation.lng, a.latitude!, a.longitude!);
          const distB = calculateDistance(searchLocation.lat, searchLocation.lng, b.latitude!, b.longitude!);
          return distA - distB;
        })
      : spots;

    // Apply selected filters (if any). If selectedFilters is empty or contains 'available', show all.
    const activeFilters = selectedFilters || [];
    if (activeFilters.length === 0 || activeFilters.includes('available')) return source;

    const filtered = source.filter((spot) => {
      return activeFilters.some((f) => {
        if (f === 'under10') return (spot.pricePerHour ?? 0) < 10;
        if (f === 'driveway') return String(spot.title || '').toLowerCase().includes('driveway');
        if (f === 'garage') return String(spot.title || '').toLowerCase().includes('garage');
        return true;
      });
    });

    return filtered;
  }, [radiusConfirmed, radiusMiles, searchLocation, spots, selectedFilters]);

  const searchBarLabel = searchText || 'Find parking near…';

  useEffect(() => {
    if (!searchActive) return;
    const trimmed = searchText.trim();

    if (trimmed.length < 3) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6&lang=en`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const next = (json.features || [])
          .map((feature: any) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [];
            const lng = coords[0];
            const lat = coords[1];
            if (typeof lat !== 'number' || typeof lng !== 'number') return null;

            const country = String(props.countrycode || '').toLowerCase();
            if (country && country !== 'us') return null;

            const title = [
              props.housenumber,
              props.name || props.street,
              props.city || props.town || props.village,
              props.state,
              props.postcode,
            ].filter(Boolean).join(', ');

            return {
              id: String(props.osm_id || `${lat},${lng}`),
              title: title || props.name || props.city || 'Unknown location',
              lat,
              lng,
            };
          })
          .filter(Boolean);

        setSearchResults(next as { id: string; title: string; lat: number; lng: number }[]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchActive, searchText]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View pointerEvents="none" style={[styles.topSafeArea, { height: insets.top, backgroundColor: colors.background }]} />

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
      >
        {isViewSpot && focusCoordinate && (
          <Marker
            coordinate={{ latitude: focusCoordinate.lat, longitude: focusCoordinate.lng }}
            tracksViewChanges={false}
            tracksInfoWindowChanges={false}
            zIndex={999}
            onPress={() => {
              const target = focusedSpotFromParams();
              if (target) openSheetForSpot(target, 'parkNow');
            }}
          >
            <View style={[styles.focusPricePill, { backgroundColor: colors.primary }]}>
              <Text style={styles.focusPricePillText}>
                {focusSpotMeta.price != null ? `$${focusSpotMeta.price.toFixed(0)}` : 'Spot'}
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

        {displayedSpots.map((spot) => (
          (() => {
            const unavailable = unavailableNowSpotIds.has(String(spot.id));
            return (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude!, longitude: spot.longitude! }}
            onPress={() => openSheetForSpot(spot, 'parkNow')}
            tracksViewChanges={false}
            tracksInfoWindowChanges={false}
          >
            <View
              style={[
                styles.pricePill,
                { backgroundColor: unavailable ? colors.border : colors.primary },
                selectedSpot?.id === spot.id ? [styles.pricePillSelected, { borderColor: colors.text }] : undefined,
              ]}
            >
              <Text style={styles.pillText}>${getHourlyRateForMode(spot.pricePerHour ?? DEFAULT_BASE_RATE, 'parkNow').toFixed(0)}</Text>
            </View>
          </Marker>
            );
          })()
        ))}
        {userLocation && (
          <Marker
            key="__user_loc"
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            tracksViewChanges={false}
            onPress={() => {
              setSearchLocation({ lat: userLocation.lat, lng: userLocation.lng });
              setRadiusConfirmed(true);
              setViewMode('map');
              if (mapRef) {
                mapRef.animateToRegion({ latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
              }
              void computeRadarPixelSize();
            }}
          >
            <View style={[styles.userDot, { borderColor: colors.backgroundCard, backgroundColor: colors.primary }]} />
            <Callout tooltip onPress={() => {
              setSearchLocation({ lat: userLocation.lat, lng: userLocation.lng });
              setRadiusConfirmed(true);
              setViewMode('map');
              if (mapRef) {
                mapRef.animateToRegion({ latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
              }
              void computeRadarPixelSize();
            }}>
              <View style={{ padding: 8, backgroundColor: colors.backgroundCard, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth }}>
                <Text style={{ color: colors.text }}>Search nearby</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {/* Search-pin placed at searchLocation (used when FAB pressed) */}
        {showUserSearchPin && searchLocation && (
          <Marker
            key="__user_search_pin"
            coordinate={{ latitude: searchLocation.lat, longitude: searchLocation.lng }}
            tracksViewChanges={false}
            pinColor={colors.primary}
            onPress={() => {
              setViewMode('map');
              if (mapRef) mapRef.animateToRegion({ latitude: searchLocation.lat, longitude: searchLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
            }}
          />
        )}
      </MapView>

        {/* Pixel-accurate radar overlay (falls back to map Circle if compute fails) */}
        {searchLocation && radiusConfirmed && (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            left: radarLeftAnim,
            top: radarTopAnim,
            width: radarDiameterAnim,
            height: radarDiameterAnim,
            borderRadius: Animated.divide(radarDiameterAnim, 2),
            borderWidth: 1,
            borderColor: `${colors.primary}66`,
            backgroundColor: `${colors.primary}1A`,
            zIndex: 9,
          }} />
        )}

          <LoadingOverlay visible={loadingSpots} text="Loading spots…" />

      {activeBookingBanner && (
        <View style={[styles.activeBookingBanner, { top: insets.top + SPACING.md + 52, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}> 
          <Text style={[styles.activeBookingBannerText, { color: colors.text }]} numberOfLines={1}>
            Active booking • {formatRemainingLabel(activeBookingBanner.endTime)} left
          </Text>
          <TouchableOpacity onPress={() => router.push('/reservations')} activeOpacity={0.8}>
            <Text style={[styles.activeBookingBannerView, { color: colors.primary }]}>View</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.searchBarContainer, { top: insets.top + SPACING.md, backgroundColor: colors.backgroundCard }]}
        onPress={() => setSearchActive(true)}
        activeOpacity={0.85}
      >
        <Text style={[styles.searchBarText, { color: colors.text }]} numberOfLines={1}>{searchBarLabel}</Text>
      </TouchableOpacity>

      <View style={[styles.viewToggleContainer, { top: insets.top + SPACING.md, backgroundColor: colors.backgroundCard }]}> 
        <TouchableOpacity
          onPress={() => setViewMode('map')}
          style={[styles.toggleButton, viewMode === 'map' && [styles.toggleActive, { backgroundColor: colors.background }]]}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, { color: viewMode === 'map' ? colors.primary : colors.textSecondary }]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[styles.toggleButton, viewMode === 'list' && [styles.toggleActive, { backgroundColor: colors.background }]]}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, { color: viewMode === 'list' ? colors.primary : colors.textSecondary }]}>List</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.controlsRow, { top: insets.top + SPACING.md + 48, backgroundColor: 'transparent' }]}>
        <View style={styles.radiusChips}>
          {[0.5, 1, 3, 5].map((r) => {
            const active = radiusMiles === r;
            return (
              <TouchableOpacity
                key={String(r)}
                style={[styles.chip, active && [styles.chipActive, { backgroundColor: colors.primary }], { borderColor: colors.border }]}
                onPress={() => {
                  setRadiusMiles(r);
                  if (searchLocation) {
                    setRadiusConfirmed(true);
                    if (mapRef) {
                      mapRef.animateToRegion({ latitude: searchLocation.lat, longitude: searchLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
                      void computeRadarPixelSize();
                    }
                  } else {
                    // don't enable radius unless a search location is selected
                    setRadiusConfirmed(false);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>{r} mi</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterChips}>
          <TouchableOpacity style={[styles.chip, { paddingHorizontal: 14 }]} onPress={() => setFilterModalVisible(true)} activeOpacity={0.85}>
            <Text style={[styles.chipText, { color: colors.text }]}>Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' && (
        <View style={[styles.listOverlay, { top: insets.top + 80, bottom: insets.bottom + SPACING.md }]}> 
          <FlatList
            data={displayedSpots}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: SPACING.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listCard, { backgroundColor: colors.backgroundCard }]}
                onPress={() => {
                  openSheetForSpot(item, 'parkNow');
                  setViewMode('map');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.listCardContent}>
                  <Text style={[styles.listCardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.listCardAddress, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
                </View>
                <Text style={[styles.listCardPrice, { color: colors.primary }]}>${getHourlyRateForMode(item.pricePerHour ?? DEFAULT_BASE_RATE, 'parkNow').toFixed(2)}/hr</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

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
            <ScrollView style={styles.suggestionsList}>
              {searchLoading && <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Searching...</Text>}
              {!searchLoading && searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSearchText(result.title);
                    setSearchActive(false);
                    setSearchLocation({ lat: result.lat, lng: result.lng });
                    setRadiusConfirmed(true);
                    setViewMode('map');
                    mapRef?.animateToRegion({
                      latitude: result.lat,
                      longitude: result.lng,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }, 1000);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{result.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={() => setSearchActive(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setSearchLocation(null);
                  setRadiusConfirmed(false);
                  setSearchActive(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: insets.top + 80, backgroundColor: colors.backgroundCard }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <View style={{ marginTop: 8 }}>
              {['under10', 'driveway', 'garage'].map((f) => {
                const active = selectedFilters.includes(f);
                const label = f === 'under10' ? 'Under $10' : f.charAt(0).toUpperCase() + f.slice(1);
                return (
                  <TouchableOpacity key={f} style={[styles.chip, { marginVertical: 6, justifyContent: 'flex-start' }, active && styles.chipActive]} onPress={() => {
                    if (active) setSelectedFilters(selectedFilters.filter((s) => s !== f));
                    else setSelectedFilters([...selectedFilters, f]);
                  }} activeOpacity={0.85}>
                    <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => setFilterModalVisible(false)} activeOpacity={0.85}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bookingSheetVisible} animationType="slide" transparent>
        <View style={styles.paymentModalOverlay}>
          <View style={[styles.paymentModalContent, { height: `${bookingSheetSnap}%`, backgroundColor: colors.backgroundCard }]}> 
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
              <Text style={[styles.paymentTitle, { color: colors.text }]}>{selectedSpot?.title ?? 'Spot'}</Text>
              <Text style={[styles.paymentSpotAddress, { color: colors.textSecondary }]} numberOfLines={2}>{selectedSpot?.address}</Text>
              <Text style={[styles.cardRate, { color: colors.primary }]}>${bookingPrice?.hourlyRate.toFixed(2) ?? getHourlyRateForMode(selectedSpot?.pricePerHour ?? DEFAULT_BASE_RATE, bookingMode).toFixed(2)}/hr</Text>
              <Text style={[styles.searchHint, { color: selectedSpotUnavailable ? colors.badgeCancelled : colors.badgeConfirmed }]}>
                {selectedSpotUnavailable ? 'Unavailable now' : 'Available now'}
              </Text>

              {selectedSpot && searchLocation && selectedSpot.latitude != null && selectedSpot.longitude != null && (
                <Text style={[styles.searchHint, { color: colors.textSecondary }]}>
                  {calculateDistance(searchLocation.lat, searchLocation.lng, selectedSpot.latitude, selectedSpot.longitude).toFixed(2)} mi away
                </Text>
              )}

              <View style={[styles.modeTabs, { backgroundColor: colors.background }]}> 
                <TouchableOpacity
                  style={[styles.modeTab, bookingMode === 'parkNow' && { backgroundColor: colors.primary }]}
                  onPress={() => openSheetForSpot(selectedSpot!, 'parkNow')}
                  activeOpacity={0.8}
                  disabled={!selectedSpot}
                >
                  <Text style={[styles.modeTabText, { color: bookingMode === 'parkNow' ? '#fff' : colors.textSecondary }]}>Park Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, bookingMode === 'reserve' && { backgroundColor: colors.primary }]}
                  onPress={() => openSheetForSpot(selectedSpot!, 'reserve')}
                  activeOpacity={0.8}
                  disabled={!selectedSpot}
                >
                  <Text style={[styles.modeTabText, { color: bookingMode === 'reserve' ? '#fff' : colors.textSecondary }]}>Reserve</Text>
                </TouchableOpacity>
              </View>

              {bookingMode === 'parkNow' ? (
                <View style={styles.parkNowSection}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Duration</Text>
                  <View style={styles.durationButtonsRow}>
                    {DURATION_PRESETS.map((minutes) => (
                      <TouchableOpacity
                        key={minutes}
                        style={[
                          styles.durationButton,
                          { borderColor: colors.border },
                          selectedDurationPreset === minutes && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => applyParkNowDuration(minutes, minutes)}
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

                    <TouchableOpacity
                      style={[
                        styles.durationButton,
                        { borderColor: colors.border },
                        selectedDurationPreset === 'custom' && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        setCustomDurationInput(String(parkNowDurationMinutes));
                        setCustomDurationModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.durationButtonText,
                        { color: colors.text },
                        selectedDurationPreset === 'custom' && styles.durationButtonTextSelected,
                      ]}
                      >
                        Custom
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Start: Now</Text>
                  <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Current: {formatMinutesLabel(parkNowDurationMinutes)}</Text>
                  <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Ends at: {reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</Text>
                  <Text style={[styles.parkNowMeta, { color: colors.textSecondary }]}>Total: ${bookingPrice?.total.toFixed(2) ?? '0.00'}</Text>
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
                {bookingPrice?.minimumChargeApplied && (
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.text }]}>Minimum charge</Text>
                    <Text style={[styles.costValue, { color: colors.text }]}>$3.99</Text>
                  </View>
                )}
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.text }]}>Platform fee (30%)</Text>
                  <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.platformFee.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.text }]}>Host payout (70%)</Text>
                  <Text style={[styles.costValue, { color: colors.text }]}>${bookingPrice?.hostPayout.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={[styles.costRowTotal, { borderTopColor: colors.border }]}>
                  <Text style={[styles.costLabelTotal, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.costValueTotal, { color: colors.primary }]}>${bookingPrice?.total.toFixed(2) ?? '0.00'}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.paymentActions, { paddingBottom: insets.bottom + SPACING.xs }]}> 
              <TouchableOpacity
                style={[styles.paymentButton, { backgroundColor: colors.primary }]}
                onPress={handleConfirmAndPay}
                activeOpacity={0.85}
                disabled={processingBooking || !selectedSpot || !bookingPrice}
              >
                <Text style={styles.paymentButtonText}>
                  {processingBooking ? 'Processing...' : `Confirm & Pay $${bookingPrice?.total.toFixed(2) ?? '0.00'}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentCancelButton}
                onPress={() => {
                  setBookingSheetVisible(false);
                  setSelectedSpot(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.paymentCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={customDurationModalVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmContent, { backgroundColor: colors.backgroundCard }]}> 
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Custom duration</Text>
            <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Enter minutes (30 to 720)</Text>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text }]}
              keyboardType="number-pad"
              value={customDurationInput}
              onChangeText={setCustomDurationInput}
              placeholder="e.g. 90"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const value = Number(customDurationInput);
                  if (!Number.isFinite(value)) {
                    Alert.alert('Invalid duration', 'Please enter a valid number of minutes.');
                    return;
                  }

                  applyParkNowDuration(value, 'custom');
                  setCustomDurationModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCancelButton, { borderColor: colors.border }]}
                onPress={() => setCustomDurationModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating action button to use current location as search pin */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={async () => {
            if (!userLocation) {
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const pos = await Location.getCurrentPositionAsync({});
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(coords);
                setSearchLocation(coords);
              } catch {
                return;
              }
            } else {
              setSearchLocation({ lat: userLocation.lat, lng: userLocation.lng });
            }

            setRadiusConfirmed(true);
            setShowUserSearchPin((s) => !s);
            setViewMode('map');
            if (mapRef && searchLocation == null) {
              // if searchLocation was just set above, prefer userLocation
              const target = userLocation ?? null;
              if (target) mapRef.animateToRegion({ latitude: target.lat, longitude: target.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
            } else if (mapRef && searchLocation) {
              mapRef.animateToRegion({ latitude: searchLocation.lat, longitude: searchLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
            }

            void computeRadarPixelSize();
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.fabIcon, { color: colors.text }]}>📍</Text>
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  map: { ...StyleSheet.absoluteFillObject },
  activeBookingBanner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBookingBannerText: {
    flex: 1,
    marginRight: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  activeBookingBannerView: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchBarContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: 999,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  searchBarText: { fontSize: 16 },
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
  toggleActive: {},
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listOverlay: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 12,
  },
  listCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRow: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  radiusChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listCardContent: { flex: 1, marginRight: SPACING.sm },
  listCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  listCardAddress: { fontSize: 13 },
  listCardPrice: { fontSize: 16, fontWeight: '700' },
  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pricePillSelected: {
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  pillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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
  suggestionsList: { maxHeight: 300 },
  searchHint: {
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  suggestionItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  suggestionText: { fontSize: 15 },
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
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
  sheetScrollable: { flex: 1 },
  sheetScrollableContent: {
    paddingBottom: SPACING.md,
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  paymentSpotAddress: {
    fontSize: 13,
    marginBottom: 8,
  },
  cardRate: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
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
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  durationButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  dateFieldDisabled: { opacity: 0.55 },
  dateFieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  dateFieldValue: {
    fontSize: 15,
    fontWeight: '600',
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
  costLabel: { fontSize: 15 },
  costValue: { fontSize: 15 },
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
  paymentActions: {
    marginTop: SPACING.sm,
  },
  paymentButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  paymentCancelButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  paymentCancelText: {
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
