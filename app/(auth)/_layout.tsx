import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="email-login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
