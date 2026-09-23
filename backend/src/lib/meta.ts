// Enum values + the labels the mobile app displays (chips, dropdowns, radio groups).

export const LABELS = {
  gender: { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' },
  bloodGroup: {
    A_POSITIVE: 'A+',
    A_NEGATIVE: 'A-',
    B_POSITIVE: 'B+',
    B_NEGATIVE: 'B-',
    AB_POSITIVE: 'AB+',
    AB_NEGATIVE: 'AB-',
    O_POSITIVE: 'O+',
    O_NEGATIVE: 'O-'
  },
  maritalStatus: { SINGLE: 'Single', MARRIED: 'Married' },
  allergyType: { NONE: 'No Allergy', FOOD: 'Food Allergy', PET: 'Pet Allergy', SKIN: 'Skin Allergy', OTHER: 'Other Allergy' },
  historyStatus: { NONE: 'None', CURRENT: 'Current', PAST: 'Past' },
  smokingHabit: {
    NON_SMOKER: "I don't smoke",
    QUIT: "I've quit",
    HALF_PACK_PER_DAY: '1/2 day',
    THREE_TO_FIVE_PER_DAY: '3/5 day',
    TEN_TO_FIFTEEN_PER_DAY: '10/15 day'
  },
  alcoholConsumption: { NONE: 'None', OCCASIONALLY: 'Occasionally', MILD: 'Mild', MODERATE: 'Moderate', HEAVY: 'Heavy' },
  activityLevel: { LOW: 'Low', MODERATE: 'Moderate', ACTIVE: 'Active', HIGHLY_ACTIVE: 'Highly Active' },
  roomType: {
    GENERAL_MALE: 'General for Male',
    GENERAL_FEMALE: 'General for Female',
    PRIVATE: 'Private',
    SEMI_PRIVATE: 'Semi-Private',
    DELUXE: 'Deluxe',
    SUPER_DELUXE: 'Super Deluxe',
    ICU: 'ICU',
    NICU: 'NICU'
  },
  appointmentStatus: {
    PENDING_PAYMENT: 'Pending Payment',
    CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show'
  },
  hospitalBookingStatus: {
    REQUESTED: 'Requested',
    CONFIRMED: 'Confirmed',
    ADMITTED: 'Admitted',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected'
  },
  paymentStatus: { PENDING: 'Pending', SUCCESS: 'Success', FAILED: 'Failed', CANCELLED: 'Cancelled', REFUNDED: 'Refunded' },
  postVisibility: { PUBLIC: 'Public', DOCTORS: 'Doctors' },
  assistantRequestType: {
    DOCTOR: 'Doctor',
    HOSPITAL: 'Hospital',
    MEDICINE: 'Medicine',
    BLOOD_DONATION: 'Blood Donation',
    JOB: 'Job'
  },
  complaintTarget: { DOCTOR: 'Doctor', NURSE: 'Nurse', HOSPITAL: 'Hospital', ASSISTANT: 'Assistant' },
  helpCategory: {
    APPOINTMENT: 'Appointment',
    DOCTOR: 'Doctor',
    HOSPITAL: 'Hospital',
    HEALTH_PLANS: 'Health Plans',
    MEDICINE_ORDERS: 'Medicine Orders',
    INSURANCE_PLANS: 'Insurance Plans'
  },
  doctorSort: {
    distance: 'By Distance',
    availability: 'By Availability',
    rating: 'By Top Rated',
    recommended: 'By Top Recommended'
  }
} as const;

type LabelGroup = keyof typeof LABELS;

export const enumValues = <G extends LabelGroup>(group: G) =>
  Object.keys(LABELS[group]) as [keyof (typeof LABELS)[G] & string, ...(keyof (typeof LABELS)[G] & string)[]];

export const labelOf = (group: LabelGroup, value: string | null | undefined) =>
  value ? ((LABELS[group] as Record<string, string>)[value] ?? value) : null;

/** { value, label } option lists for every group, served by GET /api/meta. */
export const metaOptions = () =>
  Object.fromEntries(
    Object.entries(LABELS).map(([group, labels]) => [
      group,
      Object.entries(labels).map(([value, label]) => ({ value, label }))
    ])
  );
