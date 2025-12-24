// Colors
export const colors = {
  light: {
    primary: '#059669',
    primaryDark: '#047857',
    primaryLight: '#10b981',
    background: '#f0fdf4',
    cardBg: '#ffffff',
    text: '#064e3b',
    textLight: '#6b7280',
    border: '#d1fae5',
    error: '#dc2626',
  },
  dark: {
    primary: '#10b981',
    primaryDark: '#059669',
    primaryLight: '#34d399',
    background: '#0f172a',
    cardBg: '#1e293b',
    text: '#f1f5f9',
    textLight: '#94a3b8',
    border: '#334155',
    error: '#ef4444',
  }
};

// Typography
export const fonts = {
  primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sizes: {
    small: '0.875rem',
    base: '1rem',
    large: '1.125rem',
    xl: '1.5rem',
    xxl: '2rem',
  }
};

// API Configuration
export const API_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';

// User Types
export const USER_TYPES = [
  { value: 'hospital', label: 'Hospital', icon: '🏥' },
  { value: 'clinic', label: 'Clinic', icon: '🏥' },
  { value: 'doctor', label: 'Doctor', icon: '👨‍⚕️' },
  { value: 'nurse', label: 'Nurse', icon: '👩‍⚕️' },
  { value: 'staff', label: 'Other Staff', icon: '👤' }
];

// Specializations
export const SPECIALIZATIONS = [
  'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology',
  'Neurology', 'Oncology', 'Orthopedics', 'Pediatrics',
  'Psychiatry', 'Radiology', 'Surgery', 'General Practice'
];

// Indian States
export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// Hospital Types
export const HOSPITAL_TYPES = [
  'General Hospital',
  'Specialty Hospital',
  'Teaching Hospital',
  'Multispecialty Hospital',
  'Super Specialty Hospital',
  'Government Hospital',
  'Private Hospital',
  'Charitable Hospital'
];

// Clinic Types
export const CLINIC_TYPES = [
  'General Clinic',
  'Dental Clinic',
  'Eye Clinic',
  'Skin Clinic',
  'Physiotherapy Clinic',
  'Diagnostic Center',
  'Polyclinic',
  'Specialty Clinic'
];

// Services
export const HOSPITAL_SERVICES = [
  'Emergency Services',
  'ICU/CCU',
  'OPD',
  'IPD',
  'Surgery',
  'Diagnostics',
  'Pharmacy',
  'Ambulance',
  'Blood Bank',
  'Maternity',
  'Pediatrics',
  'Radiology',
  'Pathology',
  'Dialysis'
];

export const CLINIC_SERVICES = [
  'Consultation',
  'Diagnostics',
  'Minor Surgery',
  'Pathology',
  'Pharmacy',
  'X-Ray',
  'Ultrasound',
  'ECG',
  'Vaccination'
];

// Registration Authorities
export const REGISTRATION_AUTHORITIES = [
  'Medical Council of India',
  'State Medical Council',
  'Nursing Council of India',
  'Pharmacy Council of India',
  'Dental Council of India',
  'Other'
];

// Ownership Types
export const OWNERSHIP_TYPES = [
  'Private',
  'Government',
  'Trust',
  'Society',
  'Partnership',
  'Proprietorship',
  'Corporate'
];
