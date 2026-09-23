# Aura Patient App — Backend API

This file maps every screen in the Aura React Native app (`aura/src`) to the endpoints and tables behind it.

## 1. Conventions

- **Base URL:** `/api`. Every response has the shape `{ message, code, data }`.
  - Lists also return `pagination: { page, limit, total, totalPages }`.
  - Lists accept `?page=` (default 1) and `?limit=` (default 20, max 100).
- **Errors:** errors return `{ message, code, errors? }`.
  - `errors` lists the fields that failed validation, as `[{ path, message }]`.
  - Status codes:

    | Code | Meaning |
    |---|---|
    | 400 | Validation error |
    | 401 | Missing or expired token |
    | 403 | Not allowed |
    | 404 | Not found |
    | 409 | Conflict, e.g. the slot is taken or the phone is already in use |
    | 429 | OTP rate limit |
- **Auth:** send `Authorization: Bearer <accessToken>`.
  - The access token lives 15 minutes. Renew it with `POST /api/user/refresh-token`.
  - Each user has **one active session**. Signing in on another device invalidates the old device's tokens.
- **Enums:** enum values are sent as UPPER_SNAKE (for example `B_POSITIVE`). `GET /api/meta` returns every option list with display labels (`B+`), so the app has no hardcoded chips.
- **Dates and times:**
  - Dates are `YYYY-MM-DD`.
  - Times are 24-hour `HH:mm`, local to `APP_TIMEZONE` (default `Asia/Kolkata`).
  - Money is whole INR.
- **Uploads:** uploads use `multipart/form-data`.
  - Public files (avatars, feed media) are served from `/uploads/...`.
  - Private files (reports, prescriptions, resumes, evidence) come back with a **signed URL** (`/api/files/:id?expires&sig`, valid for 1 hour). The app can open that URL directly with `Linking.openURL`.

## 2. Data model (Prisma, `src/prisma/modals/*.prisma`)

| Area | Tables | Notes |
|---|---|---|
| Patient | `User`, `UserHealthProfile`, `Address`, `Location`, `OtpCode` | Personal info is on `User`. Medical and lifestyle info is on `UserHealthProfile` (1:1). |
| Providers | `Doctor`, `DoctorAvailability`, `Hospital`, `OperatingData`, `HospitalRoom`, `HospitalPackage`, `_DoctorToHospital` | `DoctorAvailability` holds weekly windows, from which slots are generated. Ratings are denormalised into `ratingAvg` and `ratingCount`. |
| Booking | `Appointment`, `HospitalBooking`, `Payment`, `_AppointmentToSymptom`, `_HospitalBookingToSymptom`, `_AppointmentReports`, `_HospitalBookingReports` | `Appointment.slotLock` is unique, which makes double-booking impossible. |
| Catalogue | `Symptom`, `Speciality`, `Banner`, `AppConfig`, `HelpArticle`, `Review`, `FavouriteDoctor` | |
| Engagement | `Notification`, `Conversation`, `Message`, `Post`, `PostMedia`, `PostLike`, `PostSave`, `Comment`, `_PostToSpeciality` | Comments nest one level deep (reply → `parentId`). |
| Support | `AssistantRequest`, `Complaint`, `Feedback` | |
| Files | `FileObject` | Stores every upload, with its owner, purpose and visibility. |

The existing tables and columns are unchanged. The additions are new nullable or defaulted columns, plus the new tables.

## 3. Screen → endpoint map

### Onboarding (ValidationStack)

| Screen | Endpoint(s) |
|---|---|
| Splash | `POST /api/user/refresh-token` to restore a stored session |
| Login | `POST /api/user/signin` `{ phone, password }` returns `data` + `auth` |
| Login → "Forget Password?" | `POST /api/otp/send` `{ phone, purpose: RESET_PASSWORD }`, then `POST /api/otp/verify`, then `POST /api/user/reset-password` `{ phone, verificationToken, newPassword }` |
| Registration → Verification | Collected on the device only. **Do not store the password in MMKV.** Then `POST /api/otp/send` `{ phone, purpose: REGISTER }` |
| OTPVerify | `POST /api/otp/verify` `{ phone, purpose, code }` returns a `verificationToken`. Then `POST /api/user/register` `{ name, email, phone, password, verificationToken }`, which returns `auth` (the user is signed in) |
| ProfilePage1 (Personal) | `PATCH /api/me` `{ gender, dateOfBirth, bloodGroup, maritalStatus, address{complete,city,state,pincode,latitude,longitude} }` and `POST /api/me/avatar` (field `avatar`) |
| ProfilePage2 (Medical) | `PATCH /api/me/medical` `{ allergyType, allergyDetails, medicationStatus, medicationDetails, diseaseStatus, diseaseDetails, surgeryStatus, surgeryDetails }` |
| ProfilePage3 (Lifestyle) | `PATCH /api/me/lifestyle` `{ smokingHabit, alcoholConsumption, activityLevel, occupation }` |

### Home tab

| Screen | Endpoint(s) |
|---|---|
| Home | `GET /api/home`. Returns banners, exploreBanners, stats, topHospitals, topSpecialists, auraSpecialists, unreadNotifications and user |
| Header bell badge | `GET /api/notifications/unread-count` |
| "View All" Top / Aura → ShowDoctorList | `GET /api/doctor?type=top\|aura&search=&sort=distance\|availability\|rating\|recommended&lat=&lng=` |
| NotificationList / NotificationMessages | `GET /api/notifications`, `GET /api/notifications/:id` (marks the notification read), `POST /api/notifications/read-all` |
| ChooseChatBox → DoctorListForChat | `GET /api/conversations?type=DOCTOR` |
| ChatWithDoctor | `POST /api/conversations` `{ doctorId }` (get or create), `GET /:id/messages?before=`, `POST /:id/messages` `{ text }`, `POST /:id/read`, `POST /:id/block` `{ blocked }` |
| ChatWithAura | `POST /api/conversations` `{ type: AURA }`, then the same message endpoints. Staff reply via admin |

### Doctor booking (DoctorHomeStack and AppointmentStack flows)

| Screen | Endpoint(s) |
|---|---|
| DoctorHome / Doctor (+ About / Education / Awards tabs) | `GET /api/doctor/:id`. Returns the profile, fee, timings, todayTimings, services, photoUrls, hospitals, reviews and isFavourite |
| Star (favourite) | `POST` / `DELETE /api/doctor/:id/favourite` |
| Reviews | `GET /api/doctor/:id/reviews`, `POST /api/doctor/:id/reviews` `{ rating, comment }` |
| ChooseSymptom / MakeAppointment | `GET /api/symptoms?search=` |
| Calendar / CalendarHome | `GET /api/doctor/:id/available-dates?days=30` |
| SelectDoctor | `GET /api/doctor?date=YYYY-MM-DD&search=&sort=` (only doctors who consult that day) |
| TimeSloat / TimeSloatHome | `GET /api/doctor/:id/available-dates?days=8` for the date strip and `GET /api/doctor/:id/slots?date=` for slots grouped MORNING / AFTERNOON / EVENING / NIGHT |
| PatientDetails / PatientDetailsHome | `POST /api/appointments` `{ doctorId, date, startTime, symptomIds, otherSymptoms, forSelf, patientName, patientPhone, patientEmail, reportIds, acceptTerms: true }`, then `POST /api/appointments/:id/pay` |

An unpaid booking holds its slot for `PAYMENT_HOLD_MINUTES` (default 15). After that it is released automatically.

### Hospital tab

| Screen | Endpoint(s) |
|---|---|
| HospitalList | `GET /api/hospital?search=&role=&city=&sort=&lat=&lng=` |
| Hospital (+ AboutHospital / ChargeRoom / Photos tabs) | `GET /api/hospital/:id`. Returns about, registrationNumber, photoUrls, operatingHours, closedDays, rooms, roomTypes, packages, doctors, reviews, phone and ambulancePhone |
| ChargeRoom chips / ChooseRoom | `GET /api/hospital/:id/rooms?roomType=` |
| ChooseDoctor | `GET /api/hospital/:id/doctors` |
| ChooseTypeofDisease | `GET /api/symptoms` |
| UploadYourReports | `POST /api/reports` (files), then `POST /api/hospital-bookings` `{ hospitalId, admissionDate, symptomIds, otherSymptoms, doctorId?, roomId?, reportIds }` |
| Rating | `POST /api/hospital/:id/reviews` |
| CompareHospital → CompareHospitalDetails | `GET /api/hospital/compare?ids=a,b` or `?names=MY Hospital,Apple`. Returns `roomTypes`, and per hospital: `feesPerDay` by room type, `doctors` and `packages` |

### Assistant tab

| Screen | Endpoint(s) |
|---|---|
| Assistent (call / chat) | `GET /api/config` returns the support phone numbers. Chat uses the Aura conversation |
| AssForDoctor | `POST /api/assistant-requests` `{ type: DOCTOR, doctorName?, locationText, latitude, longitude, details }` |
| AssForHospital | `{ type: HOSPITAL, hospitalName, ... }` |
| AssForMedicine | multipart `{ type: MEDICINE, medicineName, ... }` plus file `attachment` (the prescription) |
| AssForBloodDonation | `{ type: BLOOD_DONATION, bloodGroup, hospitalName?, ... }` |
| AssForJob | multipart `{ type: JOB, qualification, workExperience?, expectedSalary?, ... }` plus file `attachment` (the resume) |

### Feed tab

| Screen | Endpoint(s) |
|---|---|
| Feed | `GET /api/posts?tagId=&saved=true&mine=true`, `POST`/`DELETE /api/posts/:id/like`, `POST`/`DELETE /api/posts/:id/save` |
| ShareCase | `GET /api/specialities`, then multipart `POST /api/posts` `{ title, body, visibility: PUBLIC\|DOCTORS, tagIds }` with files `images[]` and `files[]` |
| CaseDetail | `GET /api/posts/:id` (includes comments and replies), `POST /api/posts/:id/comments` `{ text, parentId? }`, `DELETE /api/comments/:id` |

### Drawer

| Screen | Endpoint(s) |
|---|---|
| CustomDrawer header / Profile | `GET /api/me`. Returns the profile, age, `medical`, `lifestyle` and `profileCompletion` |
| EditPersonalInfo | `PATCH /api/me` |
| EditMobileVerify → OtpConform | `POST /api/otp/send` `{ phone, purpose: CHANGE_PHONE }`, then `/verify`, then `PATCH /api/me/phone` `{ phone, verificationToken }` |
| EditMedicalInfo / EditLifeStyleInfo | `PATCH /api/me/medical`, `PATCH /api/me/lifestyle` |
| MyAppointments (Current / Past) | `GET /api/appointments?scope=current\|past` and `GET /api/hospital-bookings?scope=current\|past` |
| CurrentAppointInfo | `GET /api/appointments/:id`, `POST /:id/cancel` `{ reason? }`, `POST /:id/reports` `{ reportIds }` |
| RescheduleSymptom → RescheduleDate → RescheduleTimeSloat | `POST /api/appointments/:id/reschedule` `{ date, startTime, symptomIds?, otherSymptoms? }`. For hospital bookings: `POST /api/hospital-bookings/:id/reschedule` `{ admissionDate }` |
| MyDoctor | `GET /api/me/favourite-doctors` |
| Your Reports | `GET /api/reports`, `POST /api/reports` (field `files`, up to 10), `DELETE /api/reports/:id` |
| Payment History | `GET /api/payments?status=` |
| AccountSetting | `GET` / `PATCH /api/me/settings` `{ notificationsEnabled }` |
| ChangePassword | `PATCH /api/me/password` `{ oldPassword, newPassword, confirmPassword }` |
| MobileVerify → CreatePassword ("Try Other Way?") | The OTP `RESET_PASSWORD` flow above |
| ReportComplaint | multipart `POST /api/complaints` `{ target: DOCTOR\|NURSE\|HOSPITAL\|ASSISTANT, doctorId?, hospitalId?, subjectName, city, address, clinicName, registrationNo, description }` plus file `evidence` |
| FeedbackSuggestions | `POST /api/feedback` `{ subject, message }` |
| AreyouDoctor | `GET /api/config`, key `doctorAppUrl` |
| HelpCenter (+ Appointment sub-pages) | `GET /api/help-articles?category=` and `GET /api/config` for the contact number |
| Logout | `POST /api/user/logout` `{ refreshToken }`. The app must also clear `auth-token` and `user` from MMKV |

### Shared

- `GET /api/meta`: every enum option list with labels.
- `GET /api/banners?placement=`
- `GET /api/config`
- `GET /api/files/:id`: private file download, by signed URL or owner token.

## 4. Provider / back-office endpoints

**Existing endpoints, unchanged, used by the web registration form:**
- `POST /api/doctor/register`
- `POST /api/doctor/signin`
- `PATCH /api/doctor/update/:id`
- `POST /api/hospital/create`
- `PATCH /api/hospital/update/:id`
- `GET /api/doctor/all`
- `GET /api/hospital/all`

**Admin endpoints (`/api/admin/*`):**
- Access requires the `x-admin-key` header. The endpoints are disabled unless `ADMIN_API_KEY` is set.
- Doctor management:
  - Profile, fee and flags: `PATCH /doctors/:id`
  - Weekly availability: `PUT /doctors/:id/availability`
  - Hospital affiliations: `PUT /doctors/:id/hospitals`
- Hospital management:
  - Profile: `PATCH /hospitals/:id`
  - Rooms: `POST /hospitals/:id/rooms`, `PATCH /rooms/:id`, `DELETE /rooms/:id`
  - Packages: `POST /hospitals/:id/packages`, `DELETE /packages/:id`
- Master-data CRUD: `symptoms`, `specialities`, `banners`, `help-articles`.
- App config: `PUT /config/:key`.
- Booking status: `PATCH /appointments/:id/status`, `PATCH /hospital-bookings/:id/status`. This also notifies the patient.
- Chat replies: `POST /conversations/:id/messages`, sent as DOCTOR or SYSTEM.

## 5. Running

```bash
yarn install
cp .env.example .env               # set DATABASE_URL and JWT_SECRET
npx prisma db push                 # or: prisma migrate dev
yarn seed                          # master data (symptoms, specialities)
yarn seed:demo                     # + demo doctors/hospitals/rooms (non-production only)
yarn dev
API_URL=http://localhost:3000 ADMIN_API_KEY=... yarn test:smoke   # 127 end-to-end checks
```

## 6. Open items (need a decision or integration)

1. **SMS provider for OTP.**
   - Outside production, the code is logged and returned as `data.devCode`.
   - In production, `/api/otp/send` returns 503 until a provider is wired in `src/services/otp.ts`.
2. **Payment gateway.**
   - Outside production, a mock provider approves `POST /api/appointments/:id/pay` immediately.
   - A real gateway needs an order + webhook flow in `src/services/payments.ts`.
   - Refunds for cancelled paid appointments are not automated.
3. **Doctor-side app.** There is no doctor authentication yet. Doctors reply to chats through the admin endpoint for now.
4. **Push notifications.** Notifications are stored in-app only. `src/services/notify.ts` is the hook for FCM.
5. **Security debt in pre-existing endpoints.**
   - `POST /api/doctor/register` gives every provider the same default password.
   - The doctor and hospital update and delete endpoints are unauthenticated.
   - Both should move behind provider or admin auth.
6. **File storage.** Files are on local disk (`UPLOAD_DIR`). Use a persistent volume, or move to S3-compatible storage, before scaling beyond one instance.
