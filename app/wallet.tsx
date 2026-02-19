import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WalletScreen() {
  const router = useRouter();
  const [balance] = useState(47.50);
  
  const transactions = [
    { id: 1, title: 'Parking - Market St', date: 'Feb 18, 2026', amount: -12.50, status: 'completed' },
    { id: 2, title: 'Parking - Marina District', date: 'Feb 15, 2026', amount: -8.00, status: 'completed' },
    { id: 3, title: 'Added funds', date: 'Feb 10, 2026', amount: 50.00, status: 'completed' },
    { id: 4, title: 'Parking - Valencia St', date: 'Feb 8, 2026', amount: -15.00, status: 'completed' },
  ];

  const paymentMethods = [
    { id: 1, type: 'Visa', last4: '4242', isDefault: true },
    { id: 2, type: 'Mastercard', last4: '8888', isDefault: false },
  ];

  const handleAddFunds = () => {
    Alert.prompt(
      'Add Funds',
      'Enter amount to add to your wallet',
      (text) => {
        const amount = parseFloat(text);
        if (amount > 0) {
          Alert.alert('Success', `$${amount.toFixed(2)} added to your wallet`);
        }
      },
      'plain-text',
      '',
      'numeric'
    );
  };

  const handleAddPaymentMethod = () => {
    Alert.alert('Add Payment Method', 'Payment method screen coming soon');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#10b981" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
          <TouchableOpacity style={styles.addFundsButton} onPress={handleAddFunds}>
            <Text style={styles.addFundsText}>Add Funds</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <TouchableOpacity onPress={handleAddPaymentMethod}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {paymentMethods.map((method) => (
            <View key={method.id} style={styles.paymentCard}>
              <View style={styles.paymentCardContent}>
                <IconSymbol name="creditcard" size={24} color="#10b981" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.paymentType}>{method.type} •••• {method.last4}</Text>
                  {method.isDefault && (
                    <Text style={styles.defaultBadge}>Default</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.transactionTitle}>{transaction.title}</Text>
                <Text style={styles.transactionDate}>{transaction.date}</Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                transaction.amount > 0 ? styles.transactionPositive : styles.transactionNegative
              ]}>
                {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 16,
  },
  addFundsButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  addFundsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  addButton: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  paymentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentType: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  defaultBadge: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
  },
  transactionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#94a3b8',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  transactionPositive: {
    color: '#10b981',
  },
  transactionNegative: {
    color: '#94a3b8',
  },
});
