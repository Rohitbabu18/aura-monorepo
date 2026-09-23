// Seeds master data (symptoms, feed specialities). With --demo, also loads the placeholder
// doctors / hospitals / rooms the mobile app currently hardcodes, for local development only.
//
//   node src/prisma/seed.ts          # master data
//   node src/prisma/seed.ts --demo   # master data + demo catalogue
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma, pool } from '../lib/prisma.ts';

const SYMPTOMS = [
  'Covid-19',
  'Fever',
  'Period Issue',
  'Diabetes',
  'Hairfall',
  'Depression',
  'Stomach ache',
  'Acne/Pimples',
  'Cough',
  'Pregnancy Queries'
];

const SPECIALITIES = ['Aura Homeo', 'BHMS', 'Skin Allergy', 'Fever', 'Pregnancy Query', 'Allopathy'];

const seedMasterData = async () => {
  for (const [index, name] of SYMPTOMS.entries()) {
    await prisma.symptom.upsert({ where: { name }, create: { name, sortOrder: index }, update: { sortOrder: index } });
  }
  for (const [index, name] of SPECIALITIES.entries()) {
    await prisma.speciality.upsert({ where: { name }, create: { name, sortOrder: index }, update: { sortOrder: index } });
  }
  console.log(`Seeded ${SYMPTOMS.length} symptoms and ${SPECIALITIES.length} specialities.`);
};

// ---------- Demo catalogue (mirrors the app's placeholder data) ----------

const INDORE = { city: 'Indore', state: 'Madhya Pradesh', country: 'India' };

const DEMO_DOCTORS = [
  { name: 'Dr. Kabir Pal', degree: 'MBBS, MD', experience: '12', fee: 500, featured: true, aura: false, lat: 22.7533, lng: 75.8937 },
  { name: 'Dr. Uvika Sharma', degree: 'BHMS', experience: '5', fee: 300, featured: true, aura: false, lat: 22.7196, lng: 75.8577 },
  { name: 'Dr. Shivani Maheta', degree: 'BUMS', experience: '20', fee: 500, featured: true, aura: false, lat: 22.6916, lng: 75.8674 },
  { name: 'Dr. Deepak Jain', degree: 'BDS', experience: '4', fee: 300, featured: true, aura: false, lat: 22.7244, lng: 75.8839 },
  { name: 'Dr. Pavan Jat', degree: 'BHMS', experience: '5', fee: 500, featured: false, aura: true, lat: 22.7445, lng: 75.8990 },
  { name: 'Dr. Sonam Sisodiya', degree: 'BDS', experience: '11', fee: 300, featured: false, aura: true, lat: 22.7011, lng: 75.8350 },
  { name: 'Dr. Rajesh Patil', degree: 'MBBS, MD', experience: '22', fee: 500, featured: false, aura: true, lat: 22.7300, lng: 75.8700 },
  { name: 'Dr. Akash Sharma', degree: 'MBBS, MD (Orthopaedic)', experience: '12', fee: 300, featured: true, aura: true, lat: 22.7505, lng: 75.8950 }
];

const DEMO_HOSPITALS = [
  { name: 'MY Hospital', email: 'demo-my@aura.local', address: 'Shivaji Vatika, Dawa Bazar', lat: 22.7118, lng: 75.8738 },
  { name: 'Apple Hospital', email: 'demo-apple@aura.local', address: 'Bhawarkua', lat: 22.6927, lng: 75.8670 },
  { name: 'Choithram Hospital', email: 'demo-choithram@aura.local', address: 'Manik Bagh Road', lat: 22.6966, lng: 75.8420 },
  { name: 'Bombay Hospital', email: 'demo-bombay@aura.local', address: 'Ring Road, Vijay Nagar', lat: 22.7527, lng: 75.8981 }
];

// ChargeRoom / ChooseRoom / CompareHospitalDetails placeholder values
const DEMO_ROOMS = [
  { roomType: 'GENERAL_MALE', name: 'General Ward for Male', feePerDay: 1200, patientsPerRoom: 4, minBookingAmount: 800 },
  { roomType: 'GENERAL_FEMALE', name: 'General Ward for Female', feePerDay: 1400, patientsPerRoom: 4, minBookingAmount: 800 },
  { roomType: 'SEMI_PRIVATE', name: 'Semi-Private', feePerDay: 2500, patientsPerRoom: 2, minBookingAmount: 1000 },
  { roomType: 'PRIVATE', name: 'Private Room', feePerDay: 5000, patientsPerRoom: 1, minBookingAmount: 1200 },
  { roomType: 'ICU', name: 'ICU', feePerDay: 4200, patientsPerRoom: 1, minBookingAmount: 2000 }
] as const;

const DEMO_PACKAGES = [
  { name: 'Operation Delivery', description: 'Deluxe Room + 3 days + Medicine', price: 30000 },
  { name: 'Normal Delivery', description: 'Semi-Private + 3 days + Medicine', price: 20000 }
];

const seedDemo = async () => {
  const unusablePassword = await bcrypt.hash(randomUUID(), 10);

  const hospitals = [];
  for (const h of DEMO_HOSPITALS) {
    const addressData = { complete: `${h.address}, Indore (M.P.)`, ...INDORE };
    const hospital = await prisma.hospital.upsert({
      where: { email: h.email },
      create: {
        name: h.name,
        email: h.email,
        phone: null,
        role: 'HOSPITAL',
        emergencyAvailable: true,
        ambulanceAvailable: true,
        servicesOffered: ['Surgery Facility', 'Emergency', 'ICU/NICU', 'MRI Facility', 'Testing Lab', 'X-ray and Sonography'],
        registrationNumber: 'DEMO-REG',
        address: { create: { ...addressData, location: { create: { latitude: String(h.lat), longitude: String(h.lng) } } } },
        operatingData: {
          create: Object.fromEntries(
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].flatMap((day) => [
              [`${day}Enabled`, day !== 'sunday'],
              [`${day}Start`, '10:30'],
              [`${day}End`, '19:00']
            ])
          )
        }
      },
      update: {}
    });
    hospitals.push(hospital);

    if ((await prisma.hospitalRoom.count({ where: { hospitalId: hospital.id } })) === 0) {
      await prisma.hospitalRoom.createMany({
        data: DEMO_ROOMS.map((r) => ({ ...r, hospitalId: hospital.id, serviceChargePercent: 15, doctorVisitCharge: 400 }))
      });
      await prisma.hospitalPackage.createMany({ data: DEMO_PACKAGES.map((p) => ({ ...p, hospitalId: hospital.id })) });
    }
  }

  for (const [index, d] of DEMO_DOCTORS.entries()) {
    const phone = `90000000${String(index).padStart(2, '0')}`;
    const doctor = await prisma.doctor.upsert({
      where: { phone },
      create: {
        name: d.name,
        phone,
        role: 'doctor',
        password: unusablePassword,
        degree: d.degree,
        specialization: 'Orthopaedic',
        experience: d.experience,
        clinicName: 'Arthros Clinic',
        consultationFee: d.fee,
        waitingTimeMins: 20,
        services: ['ACL Reconstruction', 'Arthroscopy', 'Hip Resurfacing', 'Hip Replacement', 'Knee Osteotomy'],
        isFeatured: d.featured,
        isAuraSpecialist: d.aura,
        about: 'Demo doctor profile.',
        address: {
          create: {
            complete: '102, Vijay Nagar, A.B. Road, Indore (M.P.)',
            ...INDORE,
            location: { create: { latitude: String(d.lat), longitude: String(d.lng) } }
          }
        },
        hospitals: { connect: [{ id: hospitals[index % hospitals.length].id }] }
      },
      update: {}
    });

    if ((await prisma.doctorAvailability.count({ where: { doctorId: doctor.id } })) === 0) {
      // DoctorHome timings: 10:30 AM - 11:45 AM and 05:00 PM - 07:00 PM, Monday to Saturday
      await prisma.doctorAvailability.createMany({
        data: [1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) => [
          { doctorId: doctor.id, dayOfWeek, startTime: '10:30', endTime: '11:45', slotMinutes: 15 },
          { doctorId: doctor.id, dayOfWeek, startTime: '17:00', endTime: '19:00', slotMinutes: 30 }
        ])
      });
    }
  }

  console.log(`Seeded demo catalogue: ${DEMO_HOSPITALS.length} hospitals, ${DEMO_DOCTORS.length} doctors.`);
};

const main = async () => {
  await seedMasterData();
  if (process.argv.includes('--demo')) {
    if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
      throw new Error('Refusing to load demo data with NODE_ENV=production (pass --force to override).');
    }
    await seedDemo();
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
