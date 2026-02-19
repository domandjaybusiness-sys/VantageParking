import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Design } from '@/constants/theme';
import { deleteListing, getListings, Listing, subscribe } from '@/lib/listings';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function HostScreen() {
  const router = useRouter();
  // Connect to listings store
  const [listings, setListings] = useState<Listing[]>(() => getListings() as Listing[]);
  
  useEffect(() => {
    const unsub = subscribe((items) => setListings(items as Listing[]));
    return unsub;
  }, []);

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

  const onListingPress = (listing: Listing) => {
    Alert.alert('Listing tapped', listing.title);
    // navigate to edit/availability etc.
  };
  
  const onAddNew = () => {
    router.push('/add-listing');
  };

  const onSummaryPress = () => {
    setShowEarnings(true);
    setEarningsTab('overview');
  };
  
  return (
    <ScrollView style={styles.container}>
      <AnimatedListItem index={0} direction="down">
        <AnimatedPressableButton style={styles.summaryCard} onPress={onSummaryPress}>
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
        </AnimatedPressableButton>
      </AnimatedListItem>

      <Text style={styles.sectionHeader}>My Listings</Text>
      {listings.map((l, index) => (
        <AnimatedListItem key={l.id} index={index + 1} direction="up">
          <AnimatedPressableButton
            style={styles.listingCard}
            onPress={() => onListingPress(l)}
          >
            <View style={styles.listingThumb} />
            <View style={styles.listingInfo}>
              <Text style={styles.listingName}>{l.title}</Text>
              <Text style={styles.listingAddress}>{l.address}</Text>
            </View>
            <Text style={styles.listingPrice}>${(l.pricePerHour ?? 0).toFixed(0)}/hr</Text>
            <View
              style={[
                styles.statusBadge,
                l.status === 'Active' ? styles.statusActive : styles.statusPaused,
              ]}>
              <Text
                style={
                  l.status === 'Active' ? styles.statusTextActive : styles.statusTextPaused
                }>
                {l.status || 'Active'}
              </Text>
            </View>
            <Pressable onPress={() => {
              Alert.alert('Delete spot', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteListing(l.id) },
              ]);
            }} hitSlop={8} style={{ marginLeft: 8 }}>
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </AnimatedPressableButton>
        </AnimatedListItem>
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
  container: { flex: 1, backgroundColor: Colors.dark.background },
  summaryCard: {
    backgroundColor: Colors.dark.backgroundCard,
    margin: Design.spacing.lg,
    padding: Design.spacing.md,
    borderRadius: Design.radius,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  summaryValueLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  earningsBackground: {
    borderRadius: Design.radius,
    padding: Design.spacing.md,
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
    backgroundColor: Colors.dark.backgroundCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  monthSelectorText: {
    fontSize: 12,
    color: Colors.dark.tint,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Design.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: Colors.dark.backgroundCard,
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
    color: Colors.dark.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
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
    color: Colors.dark.text,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundCard,
    borderRadius: Design.radius,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Design.spacing.md,
    marginHorizontal: Design.spacing.md,
    marginVertical: Design.spacing.sm,
  },
  listingThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#0b1220',
    marginRight: Design.spacing.md,
  },
  listingInfo: { flex: 1 },
  listingName: { fontSize: 16, fontWeight: '600', color: Colors.dark.text },
  listingAddress: { fontSize: 12, color: Colors.dark.textSecondary, marginTop: 2 },
  listingPrice: { fontSize: 16, fontWeight: '700', color: Colors.dark.tint, marginRight: 8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusActive: { backgroundColor: '#083a2a' },
  statusPaused: { backgroundColor: '#1f2937' },
  statusTextActive: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  statusTextPaused: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  listingCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.2,
  },
  addButton: {
    margin: Design.spacing.lg,
    borderRadius: Design.radius,
    overflow: 'hidden',
  },
  addButtonBackground: {
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius,
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
    backgroundColor: Colors.dark.backgroundCard,
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
  tabText: { color: '#94a3b8', fontSize: 16 },
  tabTextActive: { color: Colors.dark.tint, fontSize: 16, fontWeight: '600' },
  chartContainer: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 12,
  },
  chartBar: {
    width: 20,
    backgroundColor: Colors.dark.tint,
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
