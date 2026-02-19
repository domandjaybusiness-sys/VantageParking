import Badge from '@/components/ui/badge';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Design } from '@/constants/theme';

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
    status: 'Confirmed',
    checkInCode: 'GATE1234',
    instructions: 'Park on left side. Gate code required.',
    fees: 2.5,
    type: 'upcoming',
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
    status: 'Pending',
    checkInCode: 'GATE5678',
    instructions: 'Use entrance on north side.',
    fees: 0,
    type: 'upcoming',
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
    status: 'Confirmed',
    checkInCode: 'GATE9999',
    instructions: 'Lot B, Level 2.',
    fees: 1.0,
    type: 'past',
  },
];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'canceled'>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<(typeof MOCK_BOOKINGS)[0] | null>(null);

  const filteredBookings = MOCK_BOOKINGS.filter((b) => {
    if (activeTab === 'upcoming') return b.type === 'upcoming';
    if (activeTab === 'past') return b.type === 'past';
    return false; // canceled not in mock data yet
  });

  const getStatusColor = (status: string) => {
    if (status === 'Confirmed') return '#10b981';
    if (status === 'Pending') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.container}>
      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        {['upcoming', 'past', 'canceled'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as 'upcoming' | 'past' | 'canceled')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.bookingCard}
            onPress={() => setSelectedBooking(item)}
          >
            {/* Header: Spot Name + Status */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.spotName}>{item.spotName}</Text>
                <Text style={styles.address}>{item.address}</Text>
              </View>
              <Badge status={item.status} />
            </View>

            {/* Date & Time */}
            <View style={styles.cardSection}>
              <Text style={styles.dateTime}>
                📅 {item.date} {item.timeStart}–{item.timeEnd}
              </Text>
            </View>

            {/* Price */}
            <View style={styles.cardSection}>
              <Text style={styles.price}>${item.totalPrice.toFixed(2)}</Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.buttonSmall} onPress={() => setSelectedBooking(item)}>
                <Text style={styles.buttonSmallText}>View Details</Text>
              </TouchableOpacity>

              {activeTab === 'past' && (
                <>
                  <TouchableOpacity style={styles.buttonSmall}>
                    <Text style={styles.buttonSmallText}>Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.buttonSmall}>
                    <Text style={styles.buttonSmallText}>Book Again</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />

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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#10b981',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#10b981',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  bookingCard: {
    backgroundColor: '#1e293b',
    borderRadius: Design.radius,
    padding: Design.spacing.md,
    marginBottom: Design.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cardSection: {
    marginBottom: Design.spacing.md,
  },
  dateTime: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  price: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonSmall: {
    flex: 1,
    backgroundColor: '#475569',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSmallText: {
    color: 'white',
    fontSize: 13,
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
});
