import { useColorScheme } from '@/hooks/use-color-scheme';
import { getListings, Listing, subscribe } from '@/lib/listings';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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

export default function MapScreen() {
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

  const handleConfirmPayment = () => {
    alert('Payment confirmed — thank you!');
    setPaymentModalVisible(false);
    handleCardClose();
  };

  const handlePaymentBack = () => {
    setPaymentModalVisible(false);
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

  const markerSize = 28 + zoomLevel * 6;

  const theme = useColorScheme() ?? 'light';

  const appliedSpots = filteredSpots.filter((s) => {
    if (!selectedFilter) return true;
    if (selectedFilter === 'Under $10') return (s.pricePerHour ?? 0) < 10;
    if (selectedFilter === 'Available now') return true; // demo: all available
    if (selectedFilter === 'Driveway') return s.title.toLowerCase().includes('driveway');
    if (selectedFilter === 'Garage') return s.title.toLowerCase().includes('garage');
    if (selectedFilter === 'EV') return false; // demo has no EV data
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
        style={styles.searchBarContainer}
        onPress={() => setSearchActive(true)}
      >
        <Text style={styles.searchBarText}>🔍 Find parking near…</Text>
      </TouchableOpacity>

      {/* Search Modal */}
      <Modal visible={searchActive} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter destination address"
              placeholderTextColor="#94a3b8"
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
                >
                  <Text style={styles.suggestionText}>{suggestion.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setSearchActive(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filters + Map/List toggle */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['Available now', 'Under $10', 'Driveway', 'Garage', 'EV'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(selectedFilter === filter ? null : filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.viewToggle}>
            <TouchableOpacity onPress={() => setViewMode('map')} style={[styles.toggleButton, viewMode === 'map' && styles.toggleActive]}>
              <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.toggleButton, viewMode === 'list' && styles.toggleActive]}>
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* List view overlay */}
      {viewMode === 'list' && (
        <View style={styles.listOverlay}>
          <FlatList
            data={appliedSpots.sort((a,b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0))}
            keyExtractor={(i) => i.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listCard} onPress={() => { setSelectedSpot(item); setViewMode('map'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardAddress}>{item.address}</Text>
                </View>
                <Text style={styles.cardPriceSmall}>${((item.pricePerHour ?? 0)).toFixed(2)}/hr</Text>
              </TouchableOpacity>
            )}
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
            },
          ]}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{selectedSpot.title}</Text>
            <Text style={styles.cardAddress}>{selectedSpot.address}</Text>
            <Text style={styles.cardPrice}>${((selectedSpot.pricePerHour ?? 0)).toFixed(2)}/hr</Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => handleReserve(selectedSpot)}
            >
              <Text style={styles.closeButtonText}>Reserve</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Checkout bottom sheet */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'flex-end', paddingTop: 0 }]}> 
          <View style={[styles.modalContent, { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }]}> 
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 12 }}>Review & Pay</Text>

            <Text style={{ color: '#cbd5e1', marginBottom: 6 }}>{selectedSpot?.title}</Text>
            <Text style={{ color: '#94a3b8', marginBottom: 12 }}>{selectedSpot?.address}</Text>

            <Text style={{ color: '#cbd5e1', marginBottom: 6 }}>
              Time: {reservationStart ? reservationStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              {'–'}{reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
            </Text>

            {/* Cost breakdown */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#111827', paddingTop: 12, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#cbd5e1' }}>Parking</Text>
                <Text style={{ color: '#cbd5e1' }}>${reservationTotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#cbd5e1' }}>Service fee</Text>
                <Text style={{ color: '#cbd5e1' }}>${(reservationTotal * 0.12).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Total</Text>
                <Text style={{ color: '#10b981', fontWeight: '800' }}>${(reservationTotal * 1.12).toFixed(2)}</Text>
              </View>
            </View>

            <View style={{ marginTop: 18 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#10b981' }]}
                onPress={() => {
                  // simulate payment success
                  // show confirmation inside modal
                  alert('Payment successful');
                  setPaymentModalVisible(false);
                  handleCardClose();
                }}
              >
                <Text style={styles.modalButtonText}>Pay ${(reservationTotal * 1.12).toFixed(2)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 12 }} onPress={handlePaymentBack}>
                <Text style={{ color: '#94a3b8', textAlign: 'center' }}>Cancel</Text>
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
    backgroundColor: '#0f172a',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBarContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  searchBarText: {
    fontSize: 16,
    color: '#cbd5e1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  searchInput: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  suggestionText: {
    color: 'white',
    fontSize: 15,
  },
  modalButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterContainer: {
    position: 'absolute',
    top: 160,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 9,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#10b981',
  },
  filterChipText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: 'white',
  },
  controlsContainer: {
    position: 'absolute',
    top: 160,
    left: 16,
    right: 16,
    zIndex: 11,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 4,
    marginLeft: 8,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: '#0b1220',
  },
  toggleText: { color: '#cbd5e1' },
  toggleTextActive: { color: '#10b981', fontWeight: '700' },
  markerPin: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#10b981',
    borderWidth: 0,
  },
  pricePillSelected: {
    borderWidth: 2,
    borderColor: 'white',
    transform: [{ scale: 1.05 }],
  },
  pillText: { color: 'white', fontWeight: '700' },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  listOverlay: {
    position: 'absolute',
    top: 220,
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 12,
  },
  listCard: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPriceSmall: { color: '#10b981', fontWeight: '700', marginLeft: 12 },
  cardContent: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  cardAddress: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  cardPrice: {
    fontSize: 24,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

