import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import React, { useMemo } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

export default function HostScreen() {
  // placeholder data
  const listings = [
    {
      id: '1',
      name: 'Downtown Garage',
      address: '123 Main St, Springfield',
      price: 5,
      status: 'Active',
    },
    {
      id: '2',
      name: 'Mall Lot',
      address: '456 Center Ave, Springfield',
      price: 3,
      status: 'Paused',
    },
  ];

  const totalBookings = 27; // pretend
  const totalEarnings = 1425.5; // pretend

  const activeCount = useMemo(
    () => listings.filter((l) => l.status === 'Active').length,
    [listings]
  );

const [showEarnings, setShowEarnings] = React.useState(false);
  const [earningsTab, setEarningsTab] = React.useState<'overview' | 'past'>('overview');

  const upcomingBookings = [
    { id: 'a', title: 'Guest: Alice', date: 'Mar 1' },
    { id: 'b', title: 'Guest: Bob', date: 'Mar 5' },
  ];
  const pastBookings = [
    { id: 'c', title: 'Guest: Carol', date: 'Feb 10' },
    { id: 'd', title: 'Guest: Dave', date: 'Feb 14' },
  ];

  const onListingPress = (listing: typeof listings[0]) => {
    Alert.alert('Listing tapped', listing.name);
    // navigate to edit/availability etc.
  };
  
  const onAddNew = () => {
    Alert.alert('Add new spot', undefined, [{ text: 'OK' }]);
  };

  const onSummaryPress = () => {
    setShowEarnings(true);
    setEarningsTab('overview');
  };
  
  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.summaryCard} onPress={onSummaryPress}>
        <View style={styles.earningsBackground}>
          <View style={styles.earningsHeader}>
            <Text style={styles.summaryValueLarge}>${totalEarnings.toFixed(2)}</Text>
            <View style={styles.trendContainer}>
              <IconSymbol name="chevron.up" size={14} color="#10b981" />
              <Text style={styles.trendText}>12% from last month</Text>
            </View>
          </View>
          <Pressable style={styles.monthSelector}>
            <Text style={styles.monthSelectorText}>This month ▼</Text>
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <IconSymbol name="calendar" size={20} color={Colors.light.tint} />
            <Text style={styles.statNumber}>{totalBookings}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statCard}>
            <IconSymbol name="map.fill" size={20} color={Colors.light.tint} />
            <Text style={styles.statNumber}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </Pressable>

      <Text style={styles.sectionHeader}>My Listings</Text>
      {listings.map((l) => (
        <Pressable
          key={l.id}
          style={({ pressed }) => [
            styles.listingCard,
            pressed && styles.listingCardPressed,
          ]}
          onPress={() => onListingPress(l)}
          android_ripple={{ color: '#eee' }}>
          <View style={styles.listingThumb} />
          <View style={styles.listingInfo}>
            <Text style={styles.listingName}>{l.name}</Text>
            <Text style={styles.listingAddress}>{l.address}</Text>
          </View>
          <Text style={styles.listingPrice}>${l.price}/hr</Text>
          <View
            style={[
              styles.statusBadge,
              l.status === 'Active' ? styles.statusActive : styles.statusPaused,
            ]}>
            <Text
              style={
                l.status === 'Active' ? styles.statusTextActive : styles.statusTextPaused
              }>
              {l.status}
            </Text>
          </View>
          <IconSymbol name="square.and.pencil" size={18} color="#999" />
        </Pressable>
      ))}

      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.addButtonPressed,
        ]}
        onPress={onAddNew}>
        <View style={[styles.addButtonBackground, { backgroundColor: Colors.light.tint }]}> 
          <Text style={styles.addButtonText}>+ Add New Spot</Text>
        </View>
      </Pressable>

      {/* earnings/modal overlay */}
      {showEarnings && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable
            style={styles.backdrop}
            onPress={() => setShowEarnings(false)}
          />
          <View style={styles.earningsModal}>
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setEarningsTab('overview')}
                style={[
                  styles.tabButton,
                  earningsTab === 'overview' && styles.tabButtonActive,
                ]}>
                <Text
                  style={
                    earningsTab === 'overview'
                      ? styles.tabTextActive
                      : styles.tabText
                  }>
                  Earnings
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEarningsTab('past')}
                style={[
                  styles.tabButton,
                  earningsTab === 'past' && styles.tabButtonActive,
                ]}>
                <Text
                  style={
                    earningsTab === 'past' ? styles.tabTextActive : styles.tabText
                  }>
                  Past Bookings
                </Text>
              </Pressable>
            </View>
            {earningsTab === 'overview' ? (
              <View>
                {/* Placeholder chart - simple bars */}
                <View style={styles.chartContainer}>
                  {[50, 75, 60, 90, 40, 80].map((h, i) => (
                    <View
                      key={i}
                      style={[styles.chartBar, { height: h }]}
                    />
                  ))}
                </View>
                <Text style={styles.subHeader}>Upcoming bookings</Text>
                {upcomingBookings.map((b) => (
                  <View key={b.id} style={styles.bookingRow}>
                    <Text style={styles.bookingText}>{b.title}</Text>
                    <Text style={styles.bookingDate}>{b.date}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                {pastBookings.map((b) => (
                  <View key={b.id} style={styles.bookingRow}>
                    <Text style={styles.bookingText}>{b.title}</Text>
                    <Text style={styles.bookingDate}>{b.date}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
  },
  summaryValueLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.light.text,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  earningsBackground: {
    borderRadius: 12,
    padding: 16,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  monthSelector: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  monthSelectorText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    color: Colors.light.text,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  listingThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  listingInfo: { flex: 1 },
  listingName: { fontSize: 16, fontWeight: '600', color: Colors.light.text },
  listingAddress: { fontSize: 12, color: '#888', marginTop: 2 },
  listingPrice: { fontSize: 16, fontWeight: '700', color: Colors.light.tint, marginRight: 8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusActive: { backgroundColor: '#d1fae5' },
  statusPaused: { backgroundColor: '#f3f4f6' },
  statusTextActive: { color: '#047857', fontSize: 12, fontWeight: '600' },
  statusTextPaused: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  listingCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.2,
  },
  addButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonBackground: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  earningsModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.light.tint,
  },
  tabText: { color: '#555', fontSize: 16 },
  tabTextActive: { color: Colors.light.tint, fontSize: 16, fontWeight: '600' },
  chartContainer: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 12,
  },
  chartBar: {
    width: 20,
    backgroundColor: Colors.light.tint,
  },
  subHeader: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  bookingText: { color: Colors.light.text },
  bookingDate: { color: '#888' },
});
