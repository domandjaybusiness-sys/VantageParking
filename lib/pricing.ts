export type PricingInputs = {
  hours: number;
  ratePerHour: number;
  platformFeePercent: number;
  driverServiceFeePercent: number;
  driverServiceFeeFixed: number;
  processingPercent: number;
  processingFixed: number;
  salesTaxPercent: number;
  currencyMinorUnit?: number;
  processingPaidByHost?: boolean;
};

export type PricingBreakdown = {
  base: number;
  driverServiceFee: number;
  tax: number;
  driverTotal: number;
  processingFee: number;
  platformFee: number;
  hostPayout: number;
  platformNet: number;
};

export type RateInputs = {
  baseRate?: number;
  address?: string;
  isEventDay?: boolean;
  demandScore?: number;
  vehicleType?: 'standard' | 'suv' | 'truck';
  startTime?: Date;
  bookingCreatedAt?: Date;
};

export const DEFAULT_BASE_RATE = 10;
export const DEFAULTS = {
  platformFeePercent: 0.12,
  driverServiceFeePercent: 0.08,
  driverServiceFeeFixed: 0.5,
  processingPercent: 0.029,
  processingFixed: 0.3,
  salesTaxPercent: 0,
  currencyMinorUnit: 2,
};

export function roundToMinor(amount: number, minor = 2) {
  const factor = Math.pow(10, minor);
  return Math.round(amount * factor) / factor;
}

export function computePricing(inputs: PricingInputs): PricingBreakdown {
  const {
    hours,
    ratePerHour,
    platformFeePercent,
    driverServiceFeePercent,
    driverServiceFeeFixed,
    processingPercent,
    processingFixed,
    salesTaxPercent,
    currencyMinorUnit = 2,
    processingPaidByHost = false,
  } = inputs;

  const base = roundToMinor(hours * ratePerHour, currencyMinorUnit);
  const driverServiceFee = roundToMinor((base * driverServiceFeePercent) + driverServiceFeeFixed, currencyMinorUnit);
  const tax = roundToMinor((base + driverServiceFee) * salesTaxPercent, currencyMinorUnit);
  const driverTotal = roundToMinor(base + driverServiceFee + tax, currencyMinorUnit);
  const processingFee = roundToMinor((driverTotal * processingPercent) + processingFixed, currencyMinorUnit);
  const platformFee = roundToMinor(base * platformFeePercent, currencyMinorUnit);

  const hostPayout = processingPaidByHost
    ? roundToMinor(base - platformFee - processingFee, currencyMinorUnit)
    : roundToMinor(base - platformFee, currencyMinorUnit);

  const platformNet = processingPaidByHost
    ? roundToMinor(driverServiceFee + platformFee, currencyMinorUnit)
    : roundToMinor(driverServiceFee + platformFee - processingFee, currencyMinorUnit);

  return {
    base,
    driverServiceFee,
    tax,
    driverTotal,
    processingFee,
    platformFee,
    hostPayout,
    platformNet,
  };
}

export function deriveZoneMultiplier(address?: string) {
  const text = (address || '').toLowerCase();
  if (text.includes('downtown')) return 1.25;
  if (text.includes('stadium') || text.includes('arena')) return 1.35;
  return 1.0;
}

export function computeHourlyRate(inputs: RateInputs) {
  const baseRate = inputs.baseRate ?? DEFAULT_BASE_RATE;
  const start = inputs.startTime ?? new Date();
  const created = inputs.bookingCreatedAt ?? new Date();

  const zoneMultiplier = deriveZoneMultiplier(inputs.address);
  const day = start.getDay();
  const hour = start.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const isMorningPeak = isWeekday && hour >= 7 && hour < 10;
  const isEveningPeak = isWeekday && hour >= 16 && hour < 19;
  const peakMultiplier = (isMorningPeak || isEveningPeak) ? 1.15 : 1.0;
  const overnightMultiplier = hour >= 0 && hour < 5 ? 0.9 : 1.0;
  const eventMultiplier = inputs.isEventDay ? 1.3 : 1.0;
  const demandMultiplier = 1 + Math.min(0.25, (inputs.demandScore ?? 0) * 0.25);

  const leadHours = Math.max(0, (start.getTime() - created.getTime()) / 3600000);
  const leadTimeMultiplier = leadHours <= 2 ? 1.1 : 1.0;

  const vehicleMultiplier = inputs.vehicleType === 'suv' || inputs.vehicleType === 'truck' ? 1.1 : 1.0;

  const totalMultiplier = zoneMultiplier * peakMultiplier * overnightMultiplier * eventMultiplier * demandMultiplier * leadTimeMultiplier * vehicleMultiplier;
  return roundToMinor(baseRate * totalMultiplier, DEFAULTS.currencyMinorUnit);
}
