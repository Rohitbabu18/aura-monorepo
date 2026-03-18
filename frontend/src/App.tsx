import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import {
  USER_TYPES,
  SPECIALIZATIONS,
  STATES,
  HOSPITAL_TYPES,
  CLINIC_TYPES,
  HOSPITAL_SERVICES,
  CLINIC_SERVICES,
  REGISTRATION_AUTHORITIES,
  OWNERSHIP_TYPES,
  UserType,
} from './constants/appConstants';
import { API_URLS } from './api/urls';
import useApi from './api/hooks/useApi';
import './App.css';
import Images from './halper/Images';
import OperatingHoursField from './components/operatingHours/OperatingHoursField';
import {
  OperatingHoursData,
  WEEK_DAYS,
  createDefaultOperatingHours,
} from './components/operatingHours/operatingHoursTypes';

type RegistrationFormData = {
  userType: UserType | '';
  name: string;
  contactNumber: string;
  email: string;
  alternateContact: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  latitude: string;
  longitude: string;
  specialization: string;
  experience: string;
  registrationNumber: string;
  registrationAuthority: string;
  facilityType: string;
  establishedYear: string;
  ownershipType: string;
  registrationNo: string;
  licenseNumber: string;
  totalBeds: string;
  totalStaff: string;
  services: string[];
  operatingHours: OperatingHoursData;
  emergencyAvailable: boolean;
  ambulanceAvailable: boolean;
  websiteUrl: string;
};

type FormErrors = Partial<Record<keyof RegistrationFormData | 'submit', string>>;

type RegisterPayload = Omit<
  RegistrationFormData,
  | 'contactNumber'
  | 'alternateContact'
  | 'address'
  | 'city'
  | 'state'
  | 'pinCode'
  | 'latitude'
  | 'longitude'
  | 'specialization'
  | 'experience'
  | 'registrationNumber'
  | 'registrationAuthority'
  | 'facilityType'
  | 'establishedYear'
  | 'ownershipType'
  | 'registrationNo'
  | 'licenseNumber'
  | 'totalBeds'
  | 'totalStaff'
  | 'services'
  | 'operatingHours'
  | 'emergencyAvailable'
  | 'ambulanceAvailable'
  | 'websiteUrl'
> & {
  phone: string;
  alternatePhone: string;
};

type RegisterResponse = {
 data:{
   id?: number | string;
    [key: string]: unknown;
 } 
};

type ToastState = {
  message: string;
  type: 'success' | 'error';
};

const REGISTRATION_ID_KEY = 'aura_registration_id';

const getStoredRegistrationId = () =>
  localStorage.getItem(REGISTRATION_ID_KEY);

const storeRegistrationId = (id: string | number) => {
  localStorage.setItem(REGISTRATION_ID_KEY, String(id));
};

const clearStoredRegistrationId = () => {
  localStorage.removeItem(REGISTRATION_ID_KEY);
};

const initialFormData: RegistrationFormData = {
  userType: '',
  name: '',
  contactNumber: '',
  email: '',
  alternateContact: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  latitude: '',
  longitude: '',
  specialization: '',
  experience: '',
  registrationNumber: '',
  registrationAuthority: '',
  facilityType: '',
  establishedYear: '',
  ownershipType: '',
  registrationNo: '',
  licenseNumber: '',
  totalBeds: '',
  totalStaff: '',
  services: [],
  operatingHours: createDefaultOperatingHours(),
  emergencyAvailable: false,
  ambulanceAvailable: false,
  websiteUrl: '',
};

function RegistrationApp() {
  const { isDark, toggleTheme } = useTheme();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState<number | string | null>(
    null
  );
  
  const [formData, setFormData] = useState<RegistrationFormData>(initialFormData);

  const [errors, setErrors] = useState<FormErrors>({});
  const { request, loading: isSubmitting } = useApi();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const storedId = getStoredRegistrationId();
    if (storedId && !registrationId) {
      setRegistrationId(storedId);
    }
  }, [registrationId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ message, type });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    const field = name as keyof RegistrationFormData;
    setFormData(prev => ({ 
      ...prev, 
      [field]: type === 'checkbox' ? checked : value 
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleOperatingHoursChange = (next: OperatingHoursData) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: next
    }));
    if (errors.operatingHours) {
      setErrors(prev => ({ ...prev, operatingHours: '' }));
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude.toFixed(6);
        const nextLongitude = position.coords.longitude.toFixed(6);
        setFormData(prev => ({
          ...prev,
          latitude: nextLatitude,
          longitude: nextLongitude
        }));
      },
      (error) => {
        console.log(error.message || 'Unable to fetch current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const getTotalSteps = () => {
    if (formData.userType === 'hospital' || formData.userType === 'clinic') {
      return 3;
    }
    return 2; // For doctor, nurse, staff
  };

  const validateStep = (step: number) => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      // Basic Information - Mandatory
      if (!formData.userType) newErrors.userType = 'Please select a user type';
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      else if (formData.name.trim().length < 3) newErrors.name = 'Name must be at least 3 characters';
      
      if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
      else if (!/^[6-9]\d{9}$/.test(formData.contactNumber)) {
        newErrors.contactNumber = 'Please enter a valid 10-digit mobile number';
      }

      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
    }

    if (step === 2) {
      // Address & Registration - Mandatory
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.state) newErrors.state = 'Please select a state';
      if (!formData.pinCode.trim()) newErrors.pinCode = 'PIN code is required';
      else if (!/^\d{6}$/.test(formData.pinCode)) newErrors.pinCode = 'Please enter a valid 6-digit PIN code';
      if ((formData.latitude.trim() && !formData.longitude.trim()) || (!formData.latitude.trim() && formData.longitude.trim())) {
        newErrors.latitude = 'Please provide both latitude and longitude';
        newErrors.longitude = 'Please provide both latitude and longitude';
      }

      // Type specific validations
      if (formData.userType === 'hospital' || formData.userType === 'clinic') {
        if (!formData.facilityType) newErrors.facilityType = 'Facility type is required';
        if (!formData.registrationNo.trim()) newErrors.registrationNo = 'Registration number is required';
        if (!formData.ownershipType) newErrors.ownershipType = 'Ownership type is required';
      }

      if (formData.userType === 'doctor') {
        if (!formData.specialization) newErrors.specialization = 'Specialization is required';
        if (!formData.experience.trim()) newErrors.experience = 'Experience is required';
        else if (!/^\d+$/.test(formData.experience) || parseInt(formData.experience) < 0) {
          newErrors.experience = 'Please enter valid years of experience';
        }
        if (!formData.registrationNumber.trim()) newErrors.registrationNumber = 'Registration number is required';
        if (!formData.registrationAuthority) newErrors.registrationAuthority = 'Registration authority is required';
      }
    }

    // Step 3 validations (optional fields, basic checks only)
    if (step === 3 && (formData.userType === 'hospital' || formData.userType === 'clinic')) {
      if (formData.totalBeds && !/^\d+$/.test(formData.totalBeds)) {
        newErrors.totalBeds = 'Please enter a valid number';
      }
      if (formData.totalStaff && !/^\d+$/.test(formData.totalStaff)) {
        newErrors.totalStaff = 'Please enter a valid number';
      }

      const operating = formData.operatingHours;
      const enabledDays = WEEK_DAYS.filter(day => operating.days[day.key].enabled);

      if (operating.allDays) {
        if (!operating.startTime || !operating.endTime) {
          newErrors.operatingHours = 'Please provide start and end time for all days';
        } else if (!enabledDays.length) {
          newErrors.operatingHours = 'Please select at least one day';
        }
      } else if (enabledDays.length > 0) {
        const hasMissingTime = enabledDays.some(day => {
          const hours = operating.days[day.key];
          return !hours.start || !hours.end;
        });

        if (hasMissingTime) {
          newErrors.operatingHours = 'Please provide start and end time for selected days';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildRegisterPayload = (): RegisterPayload => {
    return {
      userType: formData.userType,
      name: formData.name,
      email: formData.email,
      phone: formData.contactNumber,
      alternatePhone: formData.alternateContact,
    };
  };

  const toOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const toOptionalString = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const buildOperatingHoursPayload = () => {
    const operating = formData.operatingHours;
    const dayEntries = WEEK_DAYS.map(day => {
      const hours = operating.days[day.key];
      const allDaysStart = operating.allDays ? operating.startTime : hours.start;
      const allDaysEnd = operating.allDays ? operating.endTime : hours.end;
      return {
        day: day.key,
        enabled: hours.enabled,
        startTime: hours.enabled ? allDaysStart || undefined : undefined,
        endTime: hours.enabled ? allDaysEnd || undefined : undefined
      };
    });

    const anyEnabled = dayEntries.some(entry => entry.enabled);
    if (!operating.allDays && !anyEnabled) {
      return undefined;
    }

    if (operating.allDays && !anyEnabled) {
      return undefined;
    }

    if (operating.allDays && (!operating.startTime || !operating.endTime)) {
      return undefined;
    }

    return {
      days: dayEntries
    };
  };

  const buildHospitalUpdatePayload = () => {
    const role =
      formData.userType === 'hospital'
        ? 'HOSPITAL'
        : formData.userType === 'clinic'
        ? 'CLINIC'
        : undefined;

    const operatingHours = buildOperatingHoursPayload();

    const addressPayload = {
      complete: toOptionalString(formData.address),
      city: toOptionalString(formData.city),
      state: toOptionalString(formData.state),
      pincode: toOptionalString(formData.pinCode),
      location:
        formData.latitude.trim() && formData.longitude.trim()
          ? {
              latitude: toOptionalString(formData.latitude),
              longitude: toOptionalString(formData.longitude),
            }
          : undefined,
    };

    return {
      name: toOptionalString(formData.name),
      email: toOptionalString(formData.email),
      phone: toOptionalString(formData.contactNumber),
      alternatePhone: toOptionalString(formData.alternateContact),
      role,
      facilityType: toOptionalString(formData.facilityType),
      ownershipType: toOptionalString(formData.ownershipType),
      numberOfBeds: toOptionalNumber(formData.totalBeds),
      emergencyAvailable: formData.emergencyAvailable,
      ambulanceAvailable: formData.ambulanceAvailable,
      servicesOffered: formData.services.length ? formData.services : undefined,
      registrationNumber: toOptionalString(formData.registrationNo),
      yearEstablished: toOptionalNumber(formData.establishedYear),
      licenseNumber: toOptionalString(formData.licenseNumber),
      address:
        addressPayload.complete ||
        addressPayload.city ||
        addressPayload.state ||
        addressPayload.pincode ||
        addressPayload.location
          ? addressPayload
          : undefined,
      operatingHours,
      websiteUrl: toOptionalString(formData.websiteUrl),
    };
  };

  const buildUserUpdatePayload = () => {
    const role = formData.userType
      ? formData.userType.toUpperCase()
      : undefined;

    const addressPayload = {
      complete: toOptionalString(formData.address),
      city: toOptionalString(formData.city),
      state: toOptionalString(formData.state),
      pincode: toOptionalString(formData.pinCode),
      location:
        formData.latitude.trim() && formData.longitude.trim()
          ? {
              latitude: toOptionalString(formData.latitude),
              longitude: toOptionalString(formData.longitude),
            }
          : undefined,
    };

    return {
      name: toOptionalString(formData.name),
      phone: toOptionalString(formData.contactNumber),
      email: toOptionalString(formData.email),
      alternatePhone: toOptionalString(formData.alternateContact),
      role,
      specialization: toOptionalString(formData.specialization),
      experience: toOptionalNumber(formData.experience),
      registrationNumber: toOptionalString(formData.registrationNumber),
      registrationAuthority: toOptionalString(formData.registrationAuthority),
      address:
        addressPayload.complete ||
        addressPayload.city ||
        addressPayload.state ||
        addressPayload.pincode ||
        addressPayload.location
          ? addressPayload
          : undefined,
      websiteUrl: toOptionalString(formData.websiteUrl),
    };
  };

  const saveStepData = async (): Promise<boolean> => {
    try {
      const isHospitalOrClinic =
        formData.userType === 'hospital' || formData.userType === 'clinic';
      const isFirstStep = currentStep === 1;
      const storedId = registrationId ?? getStoredRegistrationId();
      const apiUrl=isHospitalOrClinic?API_URLS.registerHospital:API_URLS.registerDoctor
      if (isFirstStep) {
        const { data } = await request<RegisterResponse>(apiUrl, {
          method: 'POST',
          body: buildRegisterPayload(),
        });

        const id = data?.data.id ?? Date.now();
        setRegistrationId(id);
        storeRegistrationId(id);
        return true;
      }

      if (!storedId) {
        const message = 'Registration ID missing. Please start again.';
        showToast(message, 'error');
        setErrors({ submit: message });
        return false;
      }

      const updateUrl = isHospitalOrClinic
        ? API_URLS.updateHospital(storedId)
        : API_URLS.updateUser(storedId);

      const payload = isHospitalOrClinic
        ? buildHospitalUpdatePayload()
        : buildUserUpdatePayload();

      await request(updateUrl, {
        method: 'PATCH',
        body: payload,
      });

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save data';
      console.error('Save error:', error);
      showToast(message, 'error');
      setErrors({ submit: message });
      return false;
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    const saved = await saveStepData();
    if (saved) {
      if (currentStep < getTotalSteps()) {
        setCurrentStep(currentStep + 1);
        showToast('Step saved successfully.', 'success');
      } else {
        setSubmitSuccess(true);
        showToast('Registration completed successfully.', 'success');
        clearStoredRegistrationId();
        setTimeout(() => {
          setFormData({
            ...initialFormData,
            operatingHours: createDefaultOperatingHours()
          });
          setCurrentStep(1);
          setRegistrationId(null);
          setSubmitSuccess(false);
        }, 3000);
      }
    } else {
      setErrors({ submit: 'Failed to save data. Please try again.' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => {
    const totalSteps = getTotalSteps();
    return (
      <div className="step-indicator">
        {[...Array(totalSteps)].map((_, index) => (
          <div key={index} className={`step ${currentStep > index ? 'completed' : ''} ${currentStep === index + 1 ? 'active' : ''}`}>
            <div className="step-number">{index + 1}</div>
            <div className="step-label">
              {index === 0 ? 'Basic Info' : 
               index === 1 ? 'Details' : 
               'Additional'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="step-content">
      <h3>Basic Information</h3>
      
      {/* User Type Selection */}
      <div className="form-group">
        <label>User Type <span className="required">*</span></label>
        <div className="user-type-grid">
          {USER_TYPES.map((type) => (
            <motion.label
              key={type.value}
              className={`user-type-card ${formData.userType === type.value ? 'selected' : ''}`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <input
                type="radio"
                name="userType"
                value={type.value}
                checked={formData.userType === type.value}
                onChange={handleChange}
              />
              <span className="icon">{type.icon}</span>
              <span>{type.label}</span>
            </motion.label>
          ))}
        </div>
        {errors.userType && <span className="error">{errors.userType}</span>}
      </div>

      {/* Name */}
      <div className="form-group">
        <label>
          {formData.userType === 'hospital' || formData.userType === 'clinic' 
            ? 'Facility Name' 
            : 'Full Name'} <span className="required">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={formData.userType === 'hospital' || formData.userType === 'clinic' 
            ? 'Enter facility name' 
            : 'Enter your full name'}
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div className="form-row">
        {/* Contact Number */}
        <div className="form-group">
          <label>Contact Number <span className="required">*</span></label>
          <div className="input-with-prefix">
            <span className="prefix">+91</span>
            <input
              type="tel"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleChange}
              placeholder="10-digit mobile"
              maxLength={10}
              className={errors.contactNumber ? 'error' : ''}
            />
          </div>
          {errors.contactNumber && <span className="error">{errors.contactNumber}</span>}
        </div>

        {/* Email */}
        <div className="form-group">
          <label>Email Address <span className="required">*</span></label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@example.com"
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>
      </div>

      {/* Alternate Contact */}
      <div className="form-group">
        <label>Alternate Contact Number</label>
        <div className="input-with-prefix">
          <span className="prefix">+91</span>
          <input
            type="tel"
            name="alternateContact"
            value={formData.alternateContact}
            onChange={handleChange}
            placeholder="10-digit mobile (optional)"
            maxLength={10}
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <div className="section-title-row">
        <h3>Address & Registration Details</h3>
        <button
          type="button"
          className="location-button"
          onClick={() => {
            setIsLocationModalOpen(true);
          }}
          aria-label="Set location"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a7 7 0 0 1 7 7c0 5.1-7 13-7 13S5 14.1 5 9a7 7 0 0 1 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
          </svg>
        </button>
      </div>
      
      {/* Address */}
      <div className="form-group">
        <label>Complete Address <span className="required">*</span></label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Enter complete address"
          rows={3}
          className={errors.address ? 'error' : ''}
        />
        {errors.address && <span className="error">{errors.address}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>PIN Code <span className="required">*</span></label>
          <input
            type="text"
            name="pinCode"
            value={formData.pinCode}
            onChange={handleChange}
            placeholder="6-digit PIN"
            maxLength={6}
            className={errors.pinCode ? 'error' : ''}
          />
          {errors.pinCode && <span className="error">{errors.pinCode}</span>}
        </div>

        <div className="form-group">
          <label>State <span className="required">*</span></label>
          <select
            name="state"
            value={formData.state}
            onChange={handleChange}
            className={errors.state ? 'error' : ''}
          >
            <option value="">Select State</option>
            {STATES.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {errors.state && <span className="error">{errors.state}</span>}
        </div>

        <div className="form-group">
          <label>City / Village <span className="required">*</span></label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="Enter city or village"
            className={errors.city ? 'error' : ''}
          />
          {errors.city && <span className="error">{errors.city}</span>}
        </div>
      </div>

      {/* Hospital/Clinic specific fields */}
      {(formData.userType === 'hospital' || formData.userType === 'clinic') && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Facility Type <span className="required">*</span></label>
              <select
                name="facilityType"
                value={formData.facilityType}
                onChange={handleChange}
                className={errors.facilityType ? 'error' : ''}
              >
                <option value="">Select Type</option>
                {(formData.userType === 'hospital' ? HOSPITAL_TYPES : CLINIC_TYPES).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.facilityType && <span className="error">{errors.facilityType}</span>}
            </div>

            <div className="form-group">
              <label>Ownership Type <span className="required">*</span></label>
              <select
                name="ownershipType"
                value={formData.ownershipType}
                onChange={handleChange}
                className={errors.ownershipType ? 'error' : ''}
              >
                <option value="">Select Ownership</option>
                {OWNERSHIP_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.ownershipType && <span className="error">{errors.ownershipType}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Registration Number <span className="required">*</span></label>
              <input
                type="text"
                name="registrationNo"
                value={formData.registrationNo}
                onChange={handleChange}
                placeholder="Facility registration number"
                className={errors.registrationNo ? 'error' : ''}
              />
              {errors.registrationNo && <span className="error">{errors.registrationNo}</span>}
            </div>

            <div className="form-group">
              <label>License Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                placeholder="Operating license number"
              />
            </div>

            <div className="form-group">
              <label>Established Year</label>
              <input
                type="number"
                name="establishedYear"
                value={formData.establishedYear}
                onChange={handleChange}
                placeholder="e.g. 2010"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {isLocationModalOpen && (
          <motion.div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal-card"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
            >
              <div className="modal-header">
                <h4>Location Details</h4>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setIsLocationModalOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <button type="button" className="location-action-btn" onClick={handleUseCurrentLocation}>
                  Use Current Location
                </button>
                <div className="location-grid">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="e.g. 12.9716"
                      className={errors.latitude ? 'error' : ''}
                    />
                    {errors.latitude && <span className="error">{errors.latitude}</span>}
                  </div>
                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      placeholder="e.g. 77.5946"
                      className={errors.longitude ? 'error' : ''}
                    />
                    {errors.longitude && <span className="error">{errors.longitude}</span>}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="primary-btn" onClick={() => setIsLocationModalOpen(false)}>
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doctor specific fields */}
      {formData.userType === 'doctor' && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Specialization <span className="required">*</span></label>
              <select
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                className={errors.specialization ? 'error' : ''}
              >
                <option value="">Select Specialization</option>
                {SPECIALIZATIONS.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
              {errors.specialization && <span className="error">{errors.specialization}</span>}
            </div>

            <div className="form-group">
              <label>Years of Experience <span className="required">*</span></label>
              <input
                type="number"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="Years"
                min="0"
                className={errors.experience ? 'error' : ''}
              />
              {errors.experience && <span className="error">{errors.experience}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Medical Registration Number <span className="required">*</span></label>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                placeholder="MCI/State registration no."
                className={errors.registrationNumber ? 'error' : ''}
              />
              {errors.registrationNumber && <span className="error">{errors.registrationNumber}</span>}
            </div>

            <div className="form-group">
              <label>Registration Authority <span className="required">*</span></label>
              <select
                name="registrationAuthority"
                value={formData.registrationAuthority}
                onChange={handleChange}
                className={errors.registrationAuthority ? 'error' : ''}
              >
                <option value="">Select Authority</option>
                {REGISTRATION_AUTHORITIES.map(auth => (
                  <option key={auth} value={auth}>{auth}</option>
                ))}
              </select>
              {errors.registrationAuthority && <span className="error">{errors.registrationAuthority}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <h3>Additional Information</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label>Total Beds {formData.userType === 'hospital' && <span className="text-light">(if applicable)</span>}</label>
          <input
            type="number"
            name="totalBeds"
            value={formData.totalBeds}
            onChange={handleChange}
            placeholder="Number of beds"
            min="0"
            className={errors.totalBeds ? 'error' : ''}
          />
          {errors.totalBeds && <span className="error">{errors.totalBeds}</span>}
        </div>

        <div className="form-group">
          <label>Total Staff</label>
          <input
            type="number"
            name="totalStaff"
            value={formData.totalStaff}
            onChange={handleChange}
            placeholder="Number of staff"
            min="0"
            className={errors.totalStaff ? 'error' : ''}
          />
          {errors.totalStaff && <span className="error">{errors.totalStaff}</span>}
        </div>

        <div className="form-group">
          <OperatingHoursField
            value={formData.operatingHours}
            onChange={handleOperatingHoursChange}
            error={errors.operatingHours}
          />
        </div>
      </div>

      {/* Services */}
      <div className="form-group">
        <label>Services Offered</label>
        <div className="services-grid">
          {(formData.userType === 'hospital' ? HOSPITAL_SERVICES : CLINIC_SERVICES).map(service => (
            <label key={service} className="service-checkbox">
              <input
                type="checkbox"
                checked={formData.services.includes(service)}
                onChange={() => handleServiceToggle(service)}
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="form-row">
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="emergencyAvailable"
              checked={formData.emergencyAvailable}
              onChange={handleChange}
            />
            <span>24/7 Emergency Services Available</span>
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="ambulanceAvailable"
              checked={formData.ambulanceAvailable}
              onChange={handleChange}
            />
            <span>Ambulance Service Available</span>
          </label>
        </div>
      </div>

      {/* Website */}
      <div className="form-group">
        <label>Website URL</label>
        <input
          type="url"
          name="websiteUrl"
          value={formData.websiteUrl}
          onChange={handleChange}
          placeholder="https://www.example.com"
        />
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="background-pattern"></div>
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
      
      <motion.div 
        className="container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <motion.header 
          className="header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="logo-container">
            <div className="logo">
              <img src={Images.logo} alt="Aura MediCare Logo" className='logo-img' />
            </div>
            <div>
              <h1>Aura MediCare Portal</h1>
              <p>Professional Registration System</p>
            </div>
          </div>
          
          <button className="theme-toggle" onClick={toggleTheme}>
            <div className={`toggle-switch ${isDark ? 'active' : ''}`}>
              <div className="toggle-slider">
                {isDark ? '🌙' : '☀️'}
              </div>
            </div>
          </button>
        </motion.header>

        {/* Form Card */}
        <motion.div 
          className="form-card"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="form-header">
            <h2>Register Your Profile</h2>
            <p>Complete the registration process step by step</p>
          </div>

          {renderStepIndicator()}

          <form onSubmit={(e) => e.preventDefault()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
              </motion.div>
            </AnimatePresence>

            {errors.submit && <div className="submit-error">{errors.submit}</div>}

            <div className="form-actions">
              {currentStep > 1 && (
                <motion.button
                  type="button"
                  className="back-btn"
                  onClick={handleBack}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  ← Back
                </motion.button>
              )}
              
              <motion.button
                type="button"
                className="submit-btn"
                onClick={handleNext}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <span><span className="spinner"></span> Saving...</span>
                ) : currentStep === getTotalSteps() ? (
                  'Complete Registration'
                ) : (
                  'Save & Continue →'
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.footer 
          className="footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <p>© 2024 Aura MediCare Portal. All rights reserved.</p>
          <p>Your information is secure and will be processed according to healthcare privacy standards.</p>
        </motion.footer>
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div 
            className="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="success-card"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
            >
              <div className="success-icon">✓</div>
              <h3>Registration Complete!</h3>
              <p>Your profile has been successfully registered.</p>
              {registrationId && <p className="reg-id">Registration ID: #{registrationId}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <RegistrationApp />
    </ThemeProvider>
  );
}

export default App;
