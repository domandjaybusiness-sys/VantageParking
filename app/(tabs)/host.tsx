import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { deleteListing, getListings, Listing, subscribe } from '@/lib/listings';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Extended mock data for enhanced features
const MOCK_REVENUE_DATA = [
  { date: 'Feb 13', amount: 45.5, bookings: 2 },
  { date: 'Feb 14', amount: 120.0, bookings: 4 },
  { date: 'Feb 15', amount: 85.0, bookings: 3 },
  { date: 'Feb 16', amount: 156.0, bookings: 5 },
  { date: 'Feb 17', amount: 92.0, bookings: 3 },
  { date: 'Feb 18', amount: 178.0, bookings: 6 },
  { date: 'Today', amount: 34.0, bookings: 1 },
];

const UPCOMING_HOST_BOOKINGS = [
  { id: 1, guestName: 'Alice K.', spotName: 'Downtown Lot A', date: 'Today 2:00 PM', duration: '4h', amount: 34.0, status: 'Active' },
  { id: 2, guestName: 'Bob M.', spotName: 'Downtown Lot A', date: 'Tomorrow 10:00 AM', duration: '3h', amount: 25.5, status: 'Confirmed' },
  { id: 3, guestName: 'Carol D.', spotName: 'Market Street Garage', date: 'Feb 22 6:00 PM', duration: '5h', amount: 60.0, status: 'Confirmed' },
];

export default function HostScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>(() => getListings() as Listing[]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [earningsTab, setEarningsTab] = useState<'week' | 'month'>('week');
  
  useEffect(() => {
    const unsub = subscribe((items) => setListings(items as Listing[]));
    return unsub;
  }, []);

  const totalEarnings = 710.5; // This month
  const weekEarnings = MOCK_REVENUE_DATA.reduce((sum, day) => sum + day.amount, 0);
  const todayEarnings = MOCK_REVENUE_DATA[MOCK_REVENUE_DATA.length - 1].amount;
  const totalBookings = 27;
  const activeBooking = UPCOMING_HOST_BOOKINGS.find(b => b.status === 'Active');

  const activeCount = useMemo(
    () => listings.filter((l) => l.status === 'Active').length,
    [listings]
  );

  const pausedCount = useMemo(
    () => listings.filter((l) => l.status === 'Paused').length,
    [listings]
  );

  const onAddNew = () => {
    router.push('/add-listing');
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* Stats Dashboard */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${totalEarnings.toFixed(0)}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active Spots</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalBookings}</Text>
          <Text style={styles.statLabel}>Total Bookings</Text>
        </View>
      </View>

      {/* Today's Earnings Card */}
      <AnimatedListItem index={0} direction="down">
        <TouchableOpacity 
          style={styles.todayEarningsCard}
          onPress={() => setShowEarnings(true)}
          activeOpacity={0.8}
        >
          <View style={styles.earningsHeader}>
            <View>
              <Text style={styles.todayLabel}>Today's Earnings</Text>
              <Text style={styles.todayAmount}>${todayEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.trendBadge}>
              <Text style={styles.trendText}>↗ +12%</Text>
            </View>
          </View>
          <View style={styles.miniChart}>
            {MOCK_REVENUE_DATA.slice(-7).map((day, i) => (
              <View
                key={i}
                style={[
                  styles.miniBar,
                  { height: (day.amount / 180) * 60 },
                  i === MOCK_REVENUE_DATA.length - 1 && styles.miniBarActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.viewDetailsText}>Tap to view full report →</Text>
        </TouchableOpacity>
      </AnimatedListItem>

      {/* Active Booking Session */}
      {activeBooking && (
        <AnimatedListItem index={1} direction="down">
          <View style={styles.activeBookingCard}>
            <View style={styles.activeBookingHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeBookingTitle}>Active Booking</Text>
            </View>
            <Text style={styles.guestName}>{activeBooking.guestName}</Text>
            <Text style={styles.spotNameActive}>{activeBooking.spotName}</Text>
            <View style={styles.activeBookingInfo}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>{activeBooking.date}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Duration</Text>
                <Text style={styles.infoValue}>{activeBooking.duration}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Earning</Text>
                <Text style={styles.earningValue}>${activeBooking.amount.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.activeActions}>
              <TouchableOpacity 
                style={styles.activeActionBtn}
                onPress={() => Alert.alert('Contact', `Message ${activeBooking.guestName}`)}>
                <Text style={styles.activeActionText}>💬 Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.activeActionBtn}
                onPress={() => Alert.alert('Issue', 'Report a problem')}>
                <Text style={styles.activeActionText}>⚠️ Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedListItem>
      )}

      {/* Upcoming Bookings Section */}
      {UPCOMING_HOST_BOOKINGS.filter(b => b.status !== 'Active').length > 0 && (
        <>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>Upcoming Bookings</Text>
            <Text style={styles.sectionCount}>{UPCOMING_HOST_BOOKINGS.filter(b => b.status !== 'Active').length}</Text>
          </View>
          {UPCOMING_HOST_BOOKINGS.filter(b => b.status !== 'Active').map((booking, index) => (
            <AnimatedListItem key={booking.id} index={index + 2} direction="up">
              <View style={styles.upcomingBookingCard}>
                <View style={styles.bookingCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guestNameSmall}>{booking.guestName}</Text>
                    <Text style={styles.spotNameSmall}>{booking.spotName}</Text>
                  </View>
                  <Text style={styles.bookingAmount}>${booking.amount.toFixed(2)}</Text>
                </View>
                <View style={styles.bookingCardFooter}>
                  <Text style={styles.bookingTime}>📅 {booking.date}</Text>
                  <View style={styles.durationBadgeSmall}>
                    <Text style={styles.durationTextSmall}>{booking.duration}</Text>
                  </View>
                </View>
              </View>
            </AnimatedListItem>
          ))}
        </>
      )}

      {/* My Listings Section */}
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionHeader}>My Parking Spots</Text>
        <TouchableOpacity onPress={onAddNew}>
          <Text style={styles.addNewText}>+ Add New</Text>
        </TouchableOpacity>
      </View>
      
      {listings.map((l, index) => (
        <AnimatedListItem key={l.id} index={index + 10} direction="up">
          <AnimatedPressableButton
            style={styles.listingCard}
            onPress={() => setSelectedListing(l)}
          >
            <View style={styles.listingThumb} />
            <View style={styles.listingInfo}>
              <Text style={styles.listingName}>{l.title}</Text>
              <Text style={styles.listingAddress}>{l.address}</Text>
              <View style={styles.listingMeta}>
                <Text style={styles.listingPrice}>${(l.pricePerHour ?? 0).toFixed(0)}/hr</Text>
                <View
                  style={[
                    styles.statusBadge,
                    l.status === 'Active' ? styles.statusActive : styles.statusPaused,
                  ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: l.status === 'Active' ? '#10b981' : '#64748b' }
                  ]} />
                  <Text
                    style={
                      l.status === 'Active' ? styles.statusTextActive : styles.statusTextPaused
                    }>
                    {l.status || 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedPressableButton>
        </AnimatedListItem>
      ))}

      {listings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🅿️</Text>
          <Text style={styles.emptyTitle}>No Parking Spots Yet</Text>
          <Text style={styles.emptyText}>
            List your parking spot and start earning money today!
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onAddNew}>
            <Text style={styles.emptyButtonText}>+ Add Your First Spot</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Earnings Modal */}
      <Modal visible={showEarnings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setShowEarnings(false)}
            activeOpacity={1}
          />
          <View style={styles.earningsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Earnings Report</Text>
              <TouchableOpacity onPress={() => setShowEarnings(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setEarningsTab('week')}
                style={[styles.tabButton, earningsTab === 'week' && styles.tabButtonActive]}>
                <Text style={[styles.tabText, earningsTab === 'week' && styles.tabTextActive]}>
                  This Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEarningsTab('month')}
                style={[styles.tabButton, earningsTab === 'month' && styles.tabButtonActive]}>
                <Text style={[styles.tabText, earningsTab === 'month' && styles.tabTextActive]}>
                  This Month
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.earningsSummary}>
              <Text style={styles.earningsSummaryLabel}>
                {earningsTab === 'week' ? 'Weekly Revenue' : 'Monthly Revenue'}
              </Text>
              <Text style={styles.earningsSummaryValue}>
                ${earningsTab === 'week' ? weekEarnings.toFixed(2) : totalEarnings.toFixed(2)}
              </Text>
            </View>

            <ScrollView style={styles.chartScroll}>
              <View style={styles.chartContainer}>
                {MOCK_REVENUE_DATA.map((day, i) => (
                  <View key={i} style={styles.chartDay}>
                    <View 
                      style={[
                        styles.chartBar, 
                        { height: (day.amount / 180) * 120 },
                      ]} 
                    />
                    <Text style={styles.chartLabel}>{day.date}</Text>
                    <Text style={styles.chartAmount}>${day.amount.toFixed(0)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Revenue Breakdown</Text>
                {MOCK_REVENUE_DATA.slice(-5).reverse().map((day, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breakdownDate}>{day.date}</Text>
                      <Text style={styles.breakdownBookings}>{day.bookings} bookings</Text>
                    </View>
                    <Text style={styles.breakdownAmount}>${day.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Listing Details Modal */}
      <Modal visible={selectedListing !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setSelectedListing(null)}
            activeOpacity={1}
          />
          <View style={styles.listingModal}>
            {selectedListing && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedListing.title}</Text>
                  <TouchableOpacity onPress={() => setSelectedListing(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <Text style={styles.listingModalAddress}>{selectedListing.address}</Text>

                  <View style={styles.listingModalStats}>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatLabel}>Price</Text>
                      <Text style={styles.modalStatValue}>
                        ${(selectedListing.pricePerHour ?? 0).toFixed(2)}/hr
                      </Text>
                    </View>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatLabel}>Status</Text>
                      <View style={[
                        styles.statusBadge,
                        selectedListing.status === 'Active' ? styles.statusActive : styles.statusPaused,
                      ]}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: selectedListing.status === 'Active' ? '#10b981' : '#64748b' }
                        ]} />
                        <Text style={
                          selectedListing.status === 'Active' ? styles.statusTextActive : styles.statusTextPaused
                        }>
                          {selectedListing.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={styles.modalActionButton}
                      onPress={() => {
                        Alert.alert('Edit', 'Edit listing details');
                        setSelectedListing(null);
                      }}>
                      <Text style={styles.modalActionText}>✏️ Edit Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.modalActionButton,
                        selectedListing.status === 'Active' ? styles.pauseButton : styles.activateButton
                      ]}
                      onPress={() => {
                        Alert.alert(
                          selectedListing.status === 'Active' ? 'Pause' : 'Activate',
                          `${selectedListing.status === 'Active' ? 'Pause' : 'Activate'} this listing?`
                        );
                      }}>
                      <Text style={styles.modalActionText}>
                        {selectedListing.status === 'Active' ? '⏸️ Pause Listing' : '▶️ Activate Listing'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.modalActionButton, styles.deleteButton]}
                      onPress={() => {
                        Alert.alert('Delete', 'Are you sure? This cannot be undone.', [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive', 
                            onPress: () => {
                              deleteListing(selectedListing.id);
                              setSelectedListing(null);
                            }
                          },
                        ]);
                      }}>
                      <Text style={styles.deleteActionText}>🗑️ Delete Listing</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a',
  },

  // Stats Dashboard
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // Today's Earnings Card
  todayEarningsCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  todayLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 6,
  },
  todayAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: 'white',
  },
  trendBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trendText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  miniChart: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 12,
  },
  miniBar: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 4,
    minHeight: 4,
  },
  miniBarActive: {
    backgroundColor: '#10b981',
  },
  viewDetailsText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Active Booking Card
  activeBookingCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  activeBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  activeBookingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  spotNameActive: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  activeBookingInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  earningValue: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
  },
  activeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeActionBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // Upcoming Bookings
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    backgroundColor: '#065f46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addNewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  upcomingBookingCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guestNameSmall: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  spotNameSmall: {
    fontSize: 13,
    color: '#94a3b8',
  },
  bookingAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  bookingCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingTime: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  durationBadgeSmall: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationTextSmall: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // Listing Cards
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listingThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    marginRight: 16,
  },
  listingInfo: {
    flex: 1,
  },
  listingName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  listingAddress: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusActive: {
    backgroundColor: '#065f46',
  },
  statusPaused: {
    backgroundColor: '#1f2937',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTextActive: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextPaused: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  earningsModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  listingModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  modalClose: {
    fontSize: 28,
    color: '#94a3b8',
    fontWeight: '300',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  earningsSummary: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  earningsSummaryLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  earningsSummaryValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#10b981',
  },
  chartScroll: {
    maxHeight: 400,
  },
  chartContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  chartDay: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#10b981',
    borderRadius: 6,
    minHeight: 8,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
    textAlign: 'center',
  },
  chartAmount: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
    textAlign: 'center',
  },
  breakdownSection: {
    marginTop: 20,
    paddingBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  breakdownDate: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginBottom: 4,
  },
  breakdownBookings: {
    fontSize: 12,
    color: '#94a3b8',
  },
  breakdownAmount: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
  },

  // Listing Modal
  listingModalAddress: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  listingModalStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  modalStatItem: {
    flex: 1,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '600',
  },
  modalStatValue: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
  },
  modalActions: {
    gap: 12,
  },
  modalActionButton: {
    backgroundColor: '#334155',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalActionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
  },
  activateButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteActionText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
