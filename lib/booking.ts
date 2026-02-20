export type BookingMode = 'parkNow' | 'reserve';

export const PLATFORM_SHARE = 0.3;
export const HOST_SHARE = 0.7;

export const PARK_NOW_MIN_RATE = 2;
export const PARK_NOW_MAX_RATE = 4;
export const RESERVE_MIN_RATE = 1.5;
export const RESERVE_MAX_RATE = 3;

export const DEFAULT_PARK_NOW_DURATION_MINUTES = 30;
export const PARK_NOW_MIN_AVAILABILITY_MINUTES = 30;

const LOW_RATE_THRESHOLD = 2;
const STANDARD_BOOKING_FEE = 0.49;
const LOW_RATE_BOOKING_FEE = 0.79;
const LOW_RATE_MINIMUM_CHARGE = 3.99;

export type BookingPriceBreakdown = {
  hourlyRate: number;
  hours: number;
  subtotal: number;
  bookingFee: number;
  total: number;
  platformFee: number;
  hostPayout: number;
  minimumChargeApplied: boolean;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getHourlyRateForMode(hostRate: number | null | undefined, mode: BookingMode) {
  const safeHostRate = Number.isFinite(hostRate) ? Number(hostRate) : (mode === 'parkNow' ? 3 : 2.25);
  if (mode === 'parkNow') {
    return roundMoney(clamp(safeHostRate, PARK_NOW_MIN_RATE, PARK_NOW_MAX_RATE));
  }

  return roundMoney(clamp(safeHostRate, RESERVE_MIN_RATE, RESERVE_MAX_RATE));
}

export function computeBookingPriceBreakdown(params: {
  mode: BookingMode;
  start: Date;
  end: Date;
  hostRate: number | null | undefined;
}) : BookingPriceBreakdown {
  const { mode, start, end, hostRate } = params;
  const milliseconds = Math.max(0, end.getTime() - start.getTime());
  const hours = Math.max(0.25, milliseconds / 3600000);
  const hourlyRate = getHourlyRateForMode(hostRate, mode);
  const subtotal = roundMoney(hours * hourlyRate);

  const bookingFee = roundMoney(hourlyRate <= LOW_RATE_THRESHOLD ? LOW_RATE_BOOKING_FEE : STANDARD_BOOKING_FEE);
  const rawTotal = roundMoney(subtotal + bookingFee);

  const minimumChargeApplied = mode === 'parkNow' && hourlyRate <= LOW_RATE_THRESHOLD && rawTotal < LOW_RATE_MINIMUM_CHARGE;
  const total = minimumChargeApplied ? LOW_RATE_MINIMUM_CHARGE : rawTotal;

  const platformFee = roundMoney(subtotal * PLATFORM_SHARE);
  const hostPayout = roundMoney(subtotal * HOST_SHARE);

  return {
    hourlyRate,
    hours,
    subtotal,
    bookingFee,
    total,
    platformFee,
    hostPayout,
    minimumChargeApplied,
  };
}
