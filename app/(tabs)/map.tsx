import { useTheme } from '@/contexts/ThemeContext';
import { Listing, mapSpotRow } from '@/lib/listings';
import { computeHourlyRate, DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filteredSpots, setFilteredSpots] = useState<Listing[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Listing | null>(null);
  const [slideAnim] = useState(new Animated.Value(300));
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mapPickLoading, setMapPickLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; lat: number; lng: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pinEnabled, setPinEnabled] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [reservationTotal, setReservationTotal] = useState<number>(0);
  const [reservationStart, setReservationStart] = useState<Date | null>(null);
  const [reservationEnd, setReservationEnd] = useState<Date | null>(null);
  const [filterMenuExpanded, setFilterMenuExpanded] = useState(false);

  const params = useLocalSearchParams();

  // Handle opening search from external navigation
  useEffect(() => {
    if (params.openSearch === 'true') {
      setSearchActive(true);
    }
  }, [params.openSearch]);

  // Handle centering map on provided coordinates
  useEffect(() => {
    if (params.lat && params.lng && mapRef) {
      const lat = parseFloat(params.lat as string);
      const lng = parseFloat(params.lng as string);
      setSearchLocation({ lat, lng });
      mapRef.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  }, [params.lat, params.lng, mapRef]);

  const fetchSpots = useCallback(async () => {
    const { data, error } = await supabase.from('spots').select('*');
    if (error) {
      setFilteredSpots([]);
      return;
    }

    const mapped = (data ?? []).map(mapSpotRow);
    const withCoords = mapped.filter((spot) => spot.latitude != null && spot.longitude != null);

    if (searchLocation) {
      const nearby = withCoords
        .filter((spot) => {
          const distance = calculateDistance(searchLocation.lat, searchLocation.lng, spot.latitude!, spot.longitude!);
          return distance < 5; // Within 5 miles
        })
        .sort((a, b) => {
          const distA = calculateDistance(searchLocation.lat, searchLocation.lng, a.latitude!, a.longitude!);
          const distB = calculateDistance(searchLocation.lat, searchLocation.lng, b.latitude!, b.longitude!);
          return distA - distB;
        });
      setFilteredSpots(nearby.length > 0 ? nearby : withCoords);
    } else {
      setFilteredSpots(withCoords);
    }
  }, [searchLocation]);

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

  const handleMarkerPress = (spot: Listing) => {
    setSelectedSpot(spot);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

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
        return gestureState.dy > 6 && isVerticalSwipe;
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

  const handleReserve = (spot: Listing) => {
    const computedRate = computeHourlyRate({
      baseRate: spot.pricePerHour ?? DEFAULT_BASE_RATE,
      address: spot.address,
      startTime: new Date(),
    });
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
    setReservationStart(start);
    setReservationEnd(end);
    setReservationTotal(computedRate * 1); // 1 hour by default
    setPaymentModalVisible(true);
  };

  const handleRegionChange = (region: any) => {
    const zoom = Math.log2(360 / region.latitudeDelta);
    setZoomLevel(Math.max(1, Math.min(zoom / 5, 3)));
  };

  const handleSearch = (location: { title: string; lat: number; lng: number }) => {
    setSearchText(location.title);
    setSearchLocation({ lat: location.lat, lng: location.lng });
    setSearchActive(false);

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

  const buildAddressLabel = (props: any) => (
    [
      props?.housenumber,
      props?.name || props?.street,
      props?.city || props?.town || props?.village,
      props?.state,
      props?.postcode,
    ].filter(Boolean).join(', ')
  );

  const handleCoordinatePick = useCallback(async (latitude: number, longitude: number) => {
    setSearchActive(false);
    setSearchResults([]);
    setSearchError(null);
    setMapPickLoading(true);
    setSearchLocation({ lat: latitude, lng: longitude });
    setPickedLocation({ lat: latitude, lng: longitude });

    try {
      const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&limit=1&lang=en`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const json = await res.json();
      const feature = json?.features?.[0];
      const label = buildAddressLabel(feature?.properties);
      setSearchText(label || `Dropped pin (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    } catch (error) {
      setSearchText(`Dropped pin (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    } finally {
      setMapPickLoading(false);
    }
  }, []);

  const handleMapPress = async (event: any) => {
    if (!pinEnabled) return;
    const { latitude, longitude } = event?.nativeEvent?.coordinate ?? {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    handleCoordinatePick(latitude, longitude);
  };

  const searchBarLabel = mapPickLoading
    ? 'Locating address...'
    : searchText
      ? `📍 ${searchText}`
      : '🔍 Find parking near…';

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

            return {
              id: String(props.osm_id || `${lat},${lon}`),
              title: title || props.name || props.city || 'Unknown location',
              lat,
              lng: lon,
            };
          })
          .filter(Boolean);

        if (nextResults.length === 0) {
          setSearchError('No results found.');
          setSearchResults([]);
          return;
        }

        setSearchResults(nextResults as { id: string; title: string; lat: number; lng: number }[]);
      } catch (error) {
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
      if (filterId === 'available') return true; // demo: all available
      if (filterId === 'driveway') return s.title.toLowerCase().includes('driveway');
      if (filterId === 'garage') return s.title.toLowerCase().includes('garage');
      return true;
    }));
  }, [filteredSpots, selectedFilters]);

  const sortedSpots = useMemo(() => (
    [...appliedSpots].sort((a, b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0))
  ), [appliedSpots]);

  const renderListItem = useCallback(({ item }: { item: Listing }) => {
    const computedRate = computeHourlyRate({
      baseRate: item.pricePerHour ?? DEFAULT_BASE_RATE,
      address: item.address,
      startTime: new Date(),
    });

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
  }, [colors, setSelectedSpot, setViewMode]);

  const keyExtractor = useCallback((item: Listing) => item.id.toString(), []);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
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
        onPress={handleMapPress}
      >
          {pinEnabled && pickedLocation && (
            <Marker
              coordinate={{ latitude: pickedLocation.lat, longitude: pickedLocation.lng }}
              pinColor={colors.primary}
              title="Selected location"
              description={searchText}
            />
          )}
          {appliedSpots.map((spot) => (
            spot.latitude != null && spot.longitude != null ? (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.latitude!, longitude: spot.longitude! }}
              onPress={() => handleMarkerPress(spot)}
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
                  ${computeHourlyRate({
                    baseRate: spot.pricePerHour ?? DEFAULT_BASE_RATE,
                    address: spot.address,
                    startTime: new Date(),
                  }).toFixed(0)}
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

      {/* Pin Toggle */}
      <TouchableOpacity
        style={[
          styles.pinToggleButton,
          {
            bottom: insets.bottom + SPACING.md,
            backgroundColor: pinEnabled ? colors.primary : colors.backgroundCard,
            borderColor: colors.border,
          },
        ]}
        onPress={() => {
          setPinEnabled((prev) => {
            if (prev) {
              setPickedLocation(null);
            }
            return !prev;
          });
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.pinToggleText, { color: pinEnabled ? colors.background : colors.text }]}>📍</Text>
      </TouchableOpacity>

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
          {...cardPanResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + SPACING.md,
              backgroundColor: colors.backgroundCard,
            },
          ]}
        >
          <View style={[styles.cardHandle, { backgroundColor: colors.border }]} />
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{selectedSpot.title}</Text>
            <Text style={[styles.cardAddress, { color: colors.textSecondary }]} numberOfLines={2}>{selectedSpot.address}</Text>
            <Text style={[styles.cardPrice, { color: colors.primary }]}>
              ${computeHourlyRate({
                baseRate: selectedSpot.pricePerHour ?? DEFAULT_BASE_RATE,
                address: selectedSpot.address,
                startTime: new Date(),
              }).toFixed(2)}/hr
            </Text>

            <TouchableOpacity
              style={[styles.reserveButton, { backgroundColor: colors.primary }]}
              onPress={() => handleReserve(selectedSpot)}
              activeOpacity={0.8}
            >
              <Text style={styles.reserveButtonText}>Reserve Spot</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Checkout bottom sheet */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent>
        <View style={styles.paymentModalOverlay}> 
          <View style={[styles.paymentModalContent, { paddingBottom: insets.bottom + SPACING.md, backgroundColor: colors.backgroundCard }]}> 
            <Text style={[styles.paymentTitle, { color: colors.text }]}>Review & Pay</Text>

            <Text style={[styles.paymentSpotTitle, { color: colors.text }]} numberOfLines={1}>{selectedSpot?.title}</Text>
            <Text style={[styles.paymentSpotAddress, { color: colors.textSecondary }]} numberOfLines={1}>{selectedSpot?.address}</Text>

            <Text style={[styles.paymentTimeText, { color: colors.text }]}>
              Time: {reservationStart ? reservationStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              {'–'}{reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
            </Text>

            {/* Cost breakdown */}
            <View style={[styles.costBreakdown, { borderTopColor: colors.border }]}>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.text }]}>Parking</Text>
                <Text style={[styles.costValue, { color: colors.text }]}>${reservationTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.text }]}>Service fee</Text>
                <Text style={[styles.costValue, { color: colors.text }]}>${(reservationTotal * 0.12).toFixed(2)}</Text>
              </View>
              <View style={[styles.costRowTotal, { borderTopColor: colors.border }]}
              >
                <Text style={[styles.costLabelTotal, { color: colors.text }]}>Total</Text>
                <Text style={[styles.costValueTotal, { color: colors.primary }]}>
                  ${(reservationTotal * 1.12).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={[styles.paymentButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  alert('Payment successful');
                  setPaymentModalVisible(false);
                  handleCardClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.paymentButtonText}>Pay ${(reservationTotal * 1.12).toFixed(2)}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.paymentCancelButton} 
                onPress={() => setPaymentModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.paymentCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

  pinToggleButton: {
    position: 'absolute',
    left: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 10,
  },
  pinToggleText: {
    fontSize: 16,
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
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
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
  },
  reserveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
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
    padding: SPACING.lg,
    maxHeight: '75%',
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  paymentSpotTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  paymentSpotAddress: {
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  paymentTimeText: {
    fontSize: 15,
    marginBottom: SPACING.sm,
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
  paymentActions: {
    marginTop: SPACING.lg,
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
  paymentCancelText: {
    fontSize: 16,
  },
});

