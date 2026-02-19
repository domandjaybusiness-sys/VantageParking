import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import Badge from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';

// Mock booking data
const MOCK_BOOKINGS = [
  {
    id: 1,
    spotName: 'Downtown Lot A',
    address: '123 Market St, San Francisco',
    date: 'Today',
    timeStart: '2:00 PM',
    timeEnd: '6:00 PM',
    hours: 4,
    pricePerHour: 8.5,
    totalPrice: 34.0,
    status: 'Active',
    checkInCode: 'GATE1234',
    instructions: 'Park on left side. Gate code required.',
    fees: 2.5,
    type: 'upcoming',
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    endTime: new Date(Date.now() + 3.5 * 60 * 60 * 1000), // 3.5 hours from now
    isActive: true,
  },
  {
    id: 2,
    spotName: 'Marina Garage',
    address: '456 Marina Blvd, San Francisco',
    date: 'Tomorrow',
    timeStart: '10:00 AM',
    timeEnd: '1:00 PM',
    hours: 3,
    pricePerHour: 12.0,
    totalPrice: 36.0,
    status: 'Confirmed',
    checkInCode: 'GATE5678',
    instructions: 'Use entrance on north side.',
    fees: 0,
    type: 'upcoming',
    startTime: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours from now
    endTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
    isActive: false,
  },
  {
    id: 3,
    spotName: 'Mission District',
    address: '789 Valencia St, San Francisco',
    date: 'Feb 15',
    timeStart: '6:00 PM',
    timeEnd: '10:00 PM',
    hours: 4,
    pricePerHour: 6.0,
    totalPrice: 24.0,
    status: 'Completed',
    checkInCode: 'GATE9999',
    instructions: 'Lot B, Level 2.',
    fees: 1.0,
    type: 'past',
    startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
    isActive: false,
  },
  {
    id: 4,
    spotName: 'Financial District',
    address: '321 Battery St, San Francisco',
    date: 'Feb 12',
    timeStart: '8:00 AM',
    timeEnd: '5:00 PM',
    hours: 9,
    pricePerHour: 10.0,
    totalPrice: 90.0,
    status: 'Completed',
    checkInCode: 'GATE7777',
    instructions: 'Enter from Battery St entrance.',
    fees: 5.0,
    type: 'past',
    startTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
    isActive: false,
  },
];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<(typeof MOCK_BOOKINGS)[0] | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const filteredBookings = MOCK_BOOKINGS.filter((b) => {
    if (activeTab === 'upcoming') return b.type === 'upcoming';
    if (activeTab === 'past') return b.type === 'past';
    return false;
  });

  const activeBooking = MOCK_BOOKINGS.find(b => b.isActive);
  const upcomingCount = MOCK_BOOKINGS.filter(b => b.type === 'upcoming').length;
  const totalSpent = MOCK_BOOKINGS.filter(b => b.type === 'past').reduce((sum, b) => sum + b.totalPrice, 0);

  const getTimeRemaining = (endTime: Date) => {
    const diff = endTime.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getTimeUntil = (startTime: Date) => {
    const diff = startTime.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `in ${minutes}m`;
    }
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'Active') return '#10b981';
    if (status === 'Confirmed') return '#3b82f6';
    if (status === 'Pending') return '#f59e0b';
    if (status === 'Completed') return '#64748b';
    return '#ef4444';
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{MOCK_BOOKINGS.filter(b => b.type === 'past').length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Active Parking Session */}
        {activeBooking && (
          <AnimatedListItem index={0} direction="down">
            <View style={styles.activeSessionCard}>
              <View style={styles.activeSessionHeader}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeSessionTitle}>Active Parking Session</Text>
              </View>
              <Text style={styles.activeSessionSpot}>{activeBooking.spotName}</Text>
              <Text style={styles.activeSessionAddress}>{activeBooking.address}</Text>
              
              <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Time Remaining</Text>
                <Text style={styles.timerValue}>{getTimeRemaining(activeBooking.endTime)}</Text>
              </View>

              <View style={styles.activeSessionActions}>
                <TouchableOpacity 
                  style={styles.activeActionButton}
                  onPress={() => Alert.alert('Directions', 'Opening map...')}
                >
                  <Text style={styles.activeActionText}>🗺️ Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.activeActionButton}
                  onPress={() => Alert.alert('Gate Code', `Your code: ${activeBooking.checkInCode}`)}
                >
                  <Text style={styles.activeActionText}>🔑 Gate Code</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.activeActionButton, styles.extendButton]}
                  onPress={() => Alert.alert('Extend Time', 'Add more parking time?')}
                >
                  <Text style={[styles.activeActionText, styles.extendText]}>⏱️ Extend</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedListItem>
        )}

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          {['upcoming', 'past'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as 'upcoming' | 'past')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                  {tab === 'upcoming' ? upcomingCount : MOCK_BOOKINGS.filter(b => b.type === 'past').length}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bookings List */}
        <View style={styles.listContainer}>
          {filteredBookings.map((item, index) => (
            <AnimatedListItem key={item.id} index={index + 1} direction="up">
              <AnimatedPressableButton
                style={[
                  styles.bookingCard,
                  item.isActive && styles.bookingCardActive,
                ]}
                onPress={() => setSelectedBooking(item)}
              >
                {/* Header: Spot Name + Status */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotName}>{item.spotName}</Text>
                    <Text style={styles.address}>{item.address}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Date & Time */}
                <View style={styles.cardSection}>
                  <View style={styles.infoRow}>
                    <Text style={styles.iconLabel}>📅</Text>
                    <Text style={styles.dateTime}>
                      {item.date} • {item.timeStart}–{item.timeEnd}
                    </Text>
                  </View>
                  {activeTab === 'upcoming' && !item.isActive && (
                    <Text style={styles.countdownText}>Starts {getTimeUntil(item.startTime)}</Text>
                  )}
                </View>

                {/* Price & Duration */}
                <View style={styles.priceRow}>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.hours}h</Text>
                  </View>
                  <Text style={styles.price}>${item.totalPrice.toFixed(2)}</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.buttonGroup}>
                  <TouchableOpacity 
                    style={styles.buttonSmall} 
                    onPress={() => setSelectedBooking(item)}
                  >
                    <Text style={styles.buttonSmallText}>View Details</Text>
                  </TouchableOpacity>

                  {activeTab === 'past' && (
                    <TouchableOpacity 
                      style={[styles.buttonSmall, styles.buttonPrimary]}
                      onPress={() => Alert.alert('Book Again', `Rebook ${item.spotName}?`)}
                    >
                      <Text style={styles.buttonPrimaryText}>Book Again</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'upcoming' && !item.isActive && (
                    <TouchableOpacity 
                      style={[styles.buttonSmall, styles.buttonOutline]}
                      onPress={() => Alert.alert('Cancel', 'Cancel this booking?')}
                    >
                      <Text style={styles.buttonOutlineText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </AnimatedPressableButton>
            </AnimatedListItem>
          ))}

          {filteredBookings.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' ? 'No Upcoming Bookings' : 'No Past Bookings'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' 
                  ? 'Find a parking spot on the Map tab to get started!' 
                  : 'Your completed bookings will appear here.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Details Modal */}
      <Modal visible={selectedBooking !== null} animationType="slide">
        <View style={styles.detailsContainer}>
          {/* Reserve Button */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.reserveButton}
              onPress={() => {
                if (selectedBooking) {
                  alert(`Reserved: ${selectedBooking.spotName} for $${selectedBooking.totalPrice.toFixed(2)}`);
                  setSelectedBooking(null);
                }
              }}
            >
              <Text style={styles.reserveButtonText}>Reserve Now</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailsContent}>
            {selectedBooking && (
              <>
                {/* Spot Info */}
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsTitle}>{selectedBooking.spotName}</Text>
                  <Text style={styles.detailsAddress}>{selectedBooking.address}</Text>
                </View>

                {/* Date & Time Details */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Date & Time</Text>
                  <Text style={styles.detailsText}>
                    {selectedBooking.date} {selectedBooking.timeStart}–
                    {selectedBooking.timeEnd}
                  </Text>
                  <Text style={styles.detailsText}>
                    {selectedBooking.hours} hours
                  </Text>
                </View>

                {/* Check-in Instructions */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Check-in Instructions</Text>
                  <Text style={styles.instructionBox}>Gate Code: {selectedBooking.checkInCode}</Text>
                  <Text style={styles.detailsText}>{selectedBooking.instructions}</Text>
                </View>

                {/* Receipt Breakdown */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Receipt</Text>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>
                      {selectedBooking.hours} hrs × ${selectedBooking.pricePerHour.toFixed(2)}/hr
                    </Text>
                    <Text style={styles.receiptValue}>
                      ${(selectedBooking.hours * selectedBooking.pricePerHour).toFixed(2)}
                    </Text>
                  </View>
                  {selectedBooking.fees > 0 && (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Service Fee</Text>
                      <Text style={styles.receiptValue}>${selectedBooking.fees.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.receiptRow, styles.receiptTotal]}>
                    <Text style={styles.receiptTotalLabel}>Total</Text>
                    <Text style={styles.receiptTotalValue}>
                      ${selectedBooking.totalPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.detailsSection}>
                  <TouchableOpacity
                    style={styles.directionButton}
                  >
                    <Text style={styles.directionButtonText}>📍 Get Directions</Text>
                  </TouchableOpacity>

                  {activeTab === 'upcoming' && (
                    <>
                      <TouchableOpacity style={styles.messageButton}>
                        <Text style={styles.messageButtonText}>💬 Message Host</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.supportButton}>
                        <Text style={styles.supportButtonText}>⚠️ Report Issue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.buttonSmall, styles.buttonCancel, { marginTop: 12 }]} onPress={() => {/* cancel logic */}}>
                        <Text style={styles.buttonCancelText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Close Button at Bottom */}
                <View style={styles.detailsSection}>
                  <TouchableOpacity
                    style={styles.closeButtonBottom}
                    onPress={() => setSelectedBooking(null)}
                  >
                    <Text style={styles.closeButtonBottomText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
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

  // Stats Summary
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

  // Active Parking Session
  activeSessionCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  activeSessionHeader: {
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
  activeSessionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeSessionSpot: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  activeSessionAddress: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  timerContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  timerLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    fontWeight: '600',
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
  },
  activeSessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeActionButton: {
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
  extendButton: {
    backgroundColor: '#10b981',
  },
  extendText: {
    color: 'white',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  tabBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: '#059669',
  },
  tabBadgeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: 'white',
  },

  // Bookings List
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  bookingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bookingCardActive: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconLabel: {
    fontSize: 14,
  },
  dateTime: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  countdownText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  durationText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  price: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonSmall: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSmallText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
  },
  buttonPrimaryText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  buttonOutlineText: {
    color: '#ef4444',
    fontSize: 13,
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
  },

  // Modal Details
  detailsContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 16,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 24,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  reserveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reserveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  detailsAddress: {
    fontSize: 14,
    color: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  detailsText: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 8,
  },
  instructionBox: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    color: '#cbd5e1',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    fontWeight: '600',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  receiptLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  receiptValue: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  receiptTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#334155',
    paddingTop: 12,
    marginTop: 12,
  },
  receiptTotalLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptTotalValue: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700',
  },
  directionButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  directionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  supportButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButtonBottom: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonBottomText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonCancel: {
    backgroundColor: '#ef4444',
  },
  buttonCancelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
