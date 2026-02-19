import { useColorScheme } from '@/hooks/use-color-scheme';
import { getListings, Listing, subscribe } from '@/lib/listings';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const COLORS = {
  background: '#0f172a',
  card: '#1e293b',
  cardLight: '#334155',
  primary: '#10b981',
  text: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  border: '#334155',
  overlay: 'rgba(0, 0, 0, 0.5)',
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

// Mock search locations
const SEARCH_SUGGESTIONS = [
  { title: 'Market St, San Francisco', lat: 37.7749, lng: -122.4194 },
  { title: 'Marina District, San Francisco', lat: 37.805, lng: -122.41 },
  { title: 'Valencia St, San Francisco', lat: 37.76, lng: -122.41 },
];

const FILTER_OPTIONS = [
  { id: 'available', label: 'Available Now' },
  { id: 'under10', label: 'Under $10' },
  { id: 'driveway', label: 'Driveway' },
  { id: 'garage', label: 'Garage' },
  { id: 'ev', label: 'EV Charging' },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [filteredSpots, setFilteredSpots] = useState<Listing[]>(() => (getListings() as Listing[]).filter(s => s.latitude != null && s.longitude != null));
  const [selectedSpot, setSelectedSpot] = useState<Listing | null>(null);
  const [slideAnim] = useState(new Animated.Value(300));
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
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

  useEffect(() => {
    // Subscribe to listings store updates
    const update = (all: Listing[]) => {
      // Filter out listings without coordinates
      const withCoords = all.filter((spot) => spot.latitude != null && spot.longitude != null);
      if (searchLocation) {
        const nearby = withCoords.filter((spot) => {
          const distance = calculateDistance(searchLocation.lat, searchLocation.lng, spot.latitude!, spot.longitude!);
          return distance < 5; // Within 5 miles
        }).sort((a, b) => {
          const distA = calculateDistance(searchLocation.lat, searchLocation.lng, a.latitude!, a.longitude!);
          const distB = calculateDistance(searchLocation.lat, searchLocation.lng, b.latitude!, b.longitude!);
          return distA - distB;
        });
        setFilteredSpots(nearby.length > 0 ? nearby : withCoords);
      } else {
        setFilteredSpots(withCoords);
      }
    };

    // Initial load
    update(getListings() as Listing[]);
    const unsub = subscribe(update);
    return unsub;
  }, [searchLocation]);

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

  const handleReserve = (spot: Listing) => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
    setReservationStart(start);
    setReservationEnd(end);
    setReservationTotal(spot.pricePerHour * 1); // 1 hour by default
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

  const theme = useColorScheme() ?? 'light';

  const appliedSpots = filteredSpots.filter((s) => {
    if (!selectedFilter) return true;
    if (selectedFilter === 'under10') return (s.pricePerHour ?? 0) < 10;
    if (selectedFilter === 'available') return true; // demo: all available
    if (selectedFilter === 'driveway') return s.title.toLowerCase().includes('driveway');
    if (selectedFilter === 'garage') return s.title.toLowerCase().includes('garage');
    if (selectedFilter === 'ev') return false; // demo has no EV data
    return true;
  });

  return (
    <View style={styles.container}>
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
                  selectedSpot?.id === spot.id ? styles.pricePillSelected : undefined,
                ]}
              >
                <Text style={styles.pillText}>${((spot.pricePerHour ?? 0)).toFixed(0)}</Text>
              </TouchableOpacity>
            </Marker>
            ) : null
          ))}
      </MapView>

      {/* Search Bar at Top */}
      <TouchableOpacity 
        style={[styles.searchBarContainer, { top: insets.top + SPACING.md }]}
        onPress={() => setSearchActive(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.searchBarText}>🔍 Find parking near…</Text>
      </TouchableOpacity>

      {/* Search Modal */}
      <Modal visible={searchActive} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: insets.top + 40 }]}>
            <Text style={styles.modalTitle}>Search Location</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter destination address"
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />

            <ScrollView style={styles.suggestionsList}>
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.title}
                  style={styles.suggestionItem}
                  onPress={() => handleSearch(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{suggestion.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setSearchActive(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map/List View Toggle - Top Right */}
      <View style={[styles.viewToggleContainer, { top: insets.top + SPACING.md }]}>
        <TouchableOpacity 
          onPress={() => setViewMode('map')} 
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setViewMode('list')} 
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Filter Menu - Bottom Right */}
      <View style={[styles.floatingFilterContainer, { bottom: insets.bottom + SPACING.md }]}>
        {!filterMenuExpanded ? (
          // Collapsed state: Compact floating button
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterMenuExpanded(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterButtonText}>⚡</Text>
            {selectedFilter && (
              <View style={styles.filterBadge}>
                <View style={styles.filterBadgeDot} />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          // Expanded state: Compact filter panel
          <View style={styles.filterPanel}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter</Text>
              <TouchableOpacity 
                onPress={() => setFilterMenuExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.filterCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              {FILTER_OPTIONS.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterOption,
                    selectedFilter === filter.id && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedFilter(selectedFilter === filter.id ? null : filter.id);
                    setFilterMenuExpanded(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedFilter === filter.id && styles.filterOptionTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                  {selectedFilter === filter.id && (
                    <Text style={styles.filterCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedFilter && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setSelectedFilter(null);
                  setFilterMenuExpanded(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.clearFilterText}>Clear</Text>
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
            data={appliedSpots.sort((a,b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0))}
            keyExtractor={(i) => i.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.listCard} 
                onPress={() => { 
                  setSelectedSpot(item); 
                  setViewMode('map'); 
                }}
                activeOpacity={0.7}
              >
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.listCardAddress} numberOfLines={1}>{item.address}</Text>
                </View>
                <Text style={styles.listCardPrice}>${((item.pricePerHour ?? 0)).toFixed(2)}/hr</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: SPACING.lg }}
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
            },
          ]}
        >
          <View style={styles.cardHandle} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{selectedSpot.title}</Text>
            <Text style={styles.cardAddress} numberOfLines={2}>{selectedSpot.address}</Text>
            <Text style={styles.cardPrice}>${((selectedSpot.pricePerHour ?? 0)).toFixed(2)}/hr</Text>

            <TouchableOpacity
              style={styles.reserveButton}
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
          <View style={[styles.paymentModalContent, { paddingBottom: insets.bottom + SPACING.md }]}> 
            <Text style={styles.paymentTitle}>Review & Pay</Text>

            <Text style={styles.paymentSpotTitle} numberOfLines={1}>{selectedSpot?.title}</Text>
            <Text style={styles.paymentSpotAddress} numberOfLines={1}>{selectedSpot?.address}</Text>

            <Text style={styles.paymentTimeText}>
              Time: {reservationStart ? reservationStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              {'–'}{reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
            </Text>

            {/* Cost breakdown */}
            <View style={styles.costBreakdown}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Parking</Text>
                <Text style={styles.costValue}>${reservationTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Service fee</Text>
                <Text style={styles.costValue}>${(reservationTotal * 0.12).toFixed(2)}</Text>
              </View>
              <View style={styles.costRowTotal}>
                <Text style={styles.costLabelTotal}>Total</Text>
                <Text style={styles.costValueTotal}>${(reservationTotal * 1.12).toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.paymentButton}
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
                <Text style={styles.paymentCancelText}>Cancel</Text>
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
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Search Bar
  searchBarContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.card,
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
    color: COLORS.text,
  },

  // Search Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: SPACING.md,
  },
  searchInput: {
    backgroundColor: COLORS.background,
    color: 'white',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    fontSize: 16,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  suggestionText: {
    color: 'white',
    fontSize: 15,
  },
  modalButton: {
    backgroundColor: '#475569',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Map/List View Toggle (Top Right)
  viewToggleContainer: {
    position: 'absolute',
    right: SPACING.md,
    flexDirection: 'row',
    backgroundColor: COLORS.card,
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
    backgroundColor: COLORS.background,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Floating Filter Menu (Bottom Right)
  floatingFilterContainer: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 15,
  },
  filterButton: {
    backgroundColor: COLORS.card,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonText: {
    fontSize: 18,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  filterBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  filterPanel: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterCloseText: {
    fontSize: 18,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.primary + '15',
  },
  filterOptionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  filterCheckmark: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  clearFilterButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.xs,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  clearFilterText: {
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pricePillSelected: {
    borderWidth: 3,
    borderColor: 'white',
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
    backgroundColor: COLORS.card,
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
    color: 'white',
    marginBottom: 4,
  },
  listCardAddress: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listCardPrice: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Bottom Sheet Card
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
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
    backgroundColor: '#475569',
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
    color: 'white',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardAddress: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  cardPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  reserveButton: {
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '75%',
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: SPACING.md,
  },
  paymentSpotTitle: {
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 4,
  },
  paymentSpotAddress: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  paymentTimeText: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: SPACING.sm,
  },
  costBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  costLabel: {
    color: COLORS.text,
    fontSize: 15,
  },
  costValue: {
    color: COLORS.text,
    fontSize: 15,
  },
  costRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  costLabelTotal: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  costValueTotal: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  paymentActions: {
    marginTop: SPACING.lg,
  },
  paymentButton: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.textMuted,
    fontSize: 16,
  },
});

