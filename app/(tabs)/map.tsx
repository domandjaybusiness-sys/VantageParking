import { useEffect, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Demo parking spots with address info for searching
const DEMO_SPOTS = [
  {
    id: 1,
    title: 'Downtown Lot A',
    address: 'Market St, San Francisco',
    latitude: 37.7749,
    longitude: -122.4194,
    pricePerHour: 8.5,
  },
  {
    id: 2,
    title: 'Marina Garage',
    address: 'Marina District, San Francisco',
    latitude: 37.805,
    longitude: -122.41,
    pricePerHour: 12.0,
  },
  {
    id: 3,
    title: 'Mission District',
    address: 'Valencia St, San Francisco',
    latitude: 37.76,
    longitude: -122.41,
    pricePerHour: 6.0,
  },
];

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
  const [filteredSpots, setFilteredSpots] = useState<typeof DEMO_SPOTS>([]);
  const [selectedSpot, setSelectedSpot] = useState<(typeof DEMO_SPOTS)[0] | null>(null);
  const [slideAnim] = useState(new Animated.Value(300));
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [reservationTotal, setReservationTotal] = useState<number>(0);
  const [reservationStart, setReservationStart] = useState<Date | null>(null);
  const [reservationEnd, setReservationEnd] = useState<Date | null>(null);

  useEffect(() => {
    // Show all spots or filter by search location
    if (searchLocation) {
      const nearby = DEMO_SPOTS.filter((spot) => {
        const distance = calculateDistance(searchLocation.lat, searchLocation.lng, spot.latitude, spot.longitude);
        return distance < 5; // Within 5 miles
      }).sort((a, b) => {
        const distA = calculateDistance(searchLocation.lat, searchLocation.lng, a.latitude, a.longitude);
        const distB = calculateDistance(searchLocation.lat, searchLocation.lng, b.latitude, b.longitude);
        return distA - distB;
      });
      setFilteredSpots(nearby.length > 0 ? nearby : DEMO_SPOTS);
    } else {
      setFilteredSpots(DEMO_SPOTS);
    }
  }, [searchLocation]);

  const handleMarkerPress = (spot: (typeof DEMO_SPOTS)[0]) => {
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

  const handleReserve = (spot: (typeof DEMO_SPOTS)[0]) => {
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

  const markerSize = 50 + zoomLevel * 15;

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
        {filteredSpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            onPress={() => handleMarkerPress(spot)}
          >
            <TouchableOpacity style={[styles.markerPin, { width: markerSize, height: markerSize }]}>
              <Text style={styles.markerPrice}>${spot.pricePerHour.toFixed(2)}</Text>
            </TouchableOpacity>
          </Marker>
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

      {/* Filter Chips (optional) */}
      {searchLocation && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['Price', 'Covered', 'EV', 'Time'].map((filter) => (
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
            <Text style={styles.cardPrice}>${selectedSpot.pricePerHour.toFixed(2)}/hr</Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => handleReserve(selectedSpot)}
            >
              <Text style={styles.closeButtonText}>Reserve</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Review & Pay Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: 180 }]}> 
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 12 }}>Review & Pay</Text>

            <Text style={{ color: '#cbd5e1', marginBottom: 8 }}>Spot: {selectedSpot?.title}</Text>
            <Text style={{ color: '#cbd5e1', marginBottom: 8 }}>
              Time: {reservationStart ? reservationStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              {'–'}{reservationEnd ? reservationEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
            </Text>
            <Text style={{ color: '#cbd5e1', marginBottom: 18 }}>Total: ${reservationTotal.toFixed(2)}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, marginRight: 8, backgroundColor: '#475569' }]}
                onPress={handlePaymentBack}
              >
                <Text style={styles.modalButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, marginLeft: 8, backgroundColor: '#10b981' }]}
                onPress={handleConfirmPayment}
              >
                <Text style={styles.modalButtonText}>Confirm Payment</Text>
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
    backgroundColor: 'white',
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
    color: '#64748b',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#10b981',
  },
  filterChipText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: 'white',
  },
  markerPin: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderWidth: 3,
    borderColor: 'white',
  },
  markerPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
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

