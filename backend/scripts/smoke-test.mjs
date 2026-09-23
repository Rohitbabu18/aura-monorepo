// End-to-end smoke test for the patient-app API. Needs a running server (non-production, so OTP
// dev codes and the mock payment provider are enabled), seeded with `yarn seed:demo`, and
// ADMIN_API_KEY set on the server.
//
//   API_URL=http://localhost:3000 ADMIN_API_KEY=... node scripts/smoke-test.mjs
const BASE = process.env.API_URL || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { pass++; } else { fail++; failures.push(name); console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const call = async (method, path, { body, token, form, headers = {}, raw } = {}) => {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  if (raw) return res;
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
};
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const phone = '7' + rnd().slice(0, 1) + rnd();
const phone2 = '6' + rnd().slice(0, 1) + rnd();
const email = `u${rnd()}@test.local`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const fileForm = (fields, files) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const [k, buf, name, type] of files) f.append(k, new Blob([buf], { type }), name);
  return f;
};

// ---- Auth / OTP / register ----
let r = await call('POST', '/api/user/register', { body: { name: 'Test', phone, password: 'secret12' } });
check('register without OTP -> 400', r.status === 400, r.json);
r = await call('POST', '/api/otp/send', { body: { phone, purpose: 'REGISTER' } });
check('otp send', r.status === 200 && /^\d{4}$/.test(r.json.data.devCode), r.json);
const code = r.json.data.devCode;
r = await call('POST', '/api/otp/send', { body: { phone, purpose: 'REGISTER' } });
check('otp resend cooldown 429', r.status === 429, r.json);
r = await call('POST', '/api/otp/verify', { body: { phone, purpose: 'REGISTER', code: code === '0000' ? '1111' : '0000' } });
check('otp wrong code 400', r.status === 400, r.json);
r = await call('POST', '/api/otp/verify', { body: { phone, purpose: 'REGISTER', code } });
check('otp verify', r.status === 200 && r.json.data.verificationToken, r.json);
const vt = r.json.data.verificationToken;
r = await call('POST', '/api/user/register', { body: { name: 'Rahul Test', email, phone, password: 'secret12', verificationToken: vt } });
check('register with OTP -> 201 + tokens', r.status === 201 && r.json.auth?.accessToken && !r.json.data.password, r.json);
let token = r.json.auth.accessToken;
const userId = r.json.data.id;
r = await call('POST', '/api/user/register', { body: { name: 'X', phone, password: 'secret12', verificationToken: vt } });
check('register duplicate -> 409', r.status === 409, r.json);
r = await call('POST', '/api/user/signin', { body: { phone, password: 'secret12' } });
check('signin', r.status === 200 && r.json.auth.accessToken && r.json.data.refreshTokenHash === undefined, r.json);
const oldToken = token; token = r.json.auth.accessToken; const refresh = r.json.auth.refreshToken;
r = await call('GET', '/api/me', { token: oldToken });
check('old session token rejected after new signin', r.status === 401, r.json);
r = await call('GET', '/api/me');
check('me without token 401', r.status === 401, r.json);
r = await call('POST', '/api/user/refresh-token', { body: { refreshToken: refresh } });
check('refresh token', r.status === 200 && r.json.auth.accessToken, r.json);
r = await call('GET', '/api/me', { token: refresh });
check('refresh token not usable as access token', r.status === 401, r.json);

// ---- Profile ----
r = await call('GET', '/api/me', { token });
check('get me', r.status === 200 && r.json.data.phoneVerified === true && typeof r.json.data.profileCompletion === 'number', r.json);
const c0 = r.json.data.profileCompletion;
r = await call('PATCH', '/api/me', { token, body: { gender: 'MALE', dateOfBirth: '1996-04-10', bloodGroup: 'B_POSITIVE', maritalStatus: 'SINGLE', heightFeet: 5.6, weightKg: 69, address: { complete: '130 Kumar Bhatti, Palda', city: 'Indore', pincode: 452001, latitude: 22.72, longitude: 75.86 } } });
check('update personal', r.status === 200 && r.json.data.bloodGroup.label === 'B+' && r.json.data.age >= 29 && r.json.data.address.location.latitude === 22.72, r.json);
r = await call('PATCH', '/api/me', { token, body: { dateOfBirth: '2999-01-01' } });
check('future DOB rejected', r.status === 400, r.json);
r = await call('PATCH', '/api/me', { token, body: { bloodGroup: 'Z' } });
check('bad enum rejected', r.status === 400, r.json);
r = await call('PATCH', '/api/me/medical', { token, body: { allergyType: 'SKIN', allergyDetails: 'Itchy', medicationStatus: 'CURRENT', diseaseStatus: 'NONE', surgeryStatus: 'PAST', surgeryDetails: 'Knee' } });
check('update medical', r.status === 200 && r.json.data.medical.allergyType.label === 'Skin Allergy', r.json);
r = await call('PATCH', '/api/me/lifestyle', { token, body: { smokingHabit: 'NON_SMOKER', alcoholConsumption: 'MODERATE', activityLevel: 'ACTIVE', occupation: 'Engineer' } });
check('update lifestyle', r.status === 200 && r.json.data.lifestyle.smokingHabit.label === "I don't smoke" && r.json.data.profileCompletion > c0, r.json);
r = await call('POST', '/api/me/avatar', { token, form: fileForm({}, [['avatar', PNG, 'a.png', 'image/png']]) });
check('avatar upload', r.status === 200 && r.json.data.avatarUrl.includes('/uploads/'), r.json);
const av = await call('GET', new URL(r.json.data.avatarUrl, BASE).pathname, { raw: true });
check('avatar served publicly', av.status === 200);
r = await call('POST', '/api/me/avatar', { token, form: fileForm({}, [['avatar', PDF, 'a.pdf', 'application/pdf']]) });
check('avatar rejects pdf', r.status === 400, r.json);
r = await call('PATCH', '/api/me/settings', { token, body: { notificationsEnabled: false } });
check('settings', r.status === 200 && r.json.data.notificationsEnabled === false, r.json);
r = await call('GET', `/api/user/00000000-0000-0000-0000-000000000000`, { token });
check('/api/user/:id other user 403', r.status === 403, r.json);
r = await call('GET', `/api/user/${userId}`, { token });
check('/api/user/:id self 200', r.status === 200 && !('password' in r.json.data) && !('refreshTokenHash' in r.json.data), r.json);

// ---- Catalog ----
r = await call('GET', '/api/meta');
check('meta', r.status === 200 && r.json.data.bloodGroup.length === 8, r.json);
r = await call('GET', '/api/home', { token });
check('home', r.status === 200 && r.json.data.topSpecialists.length > 0 && r.json.data.auraSpecialists.length > 0 && r.json.data.topHospitals.length > 0 && r.json.data.stats.totalDoctors >= 8, r.json);
r = await call('GET', '/api/symptoms');
check('symptoms', r.status === 200 && r.json.data.length === 10, r.json);
const symptomIds = r.json.data.slice(0, 2).map((s) => s.id);
r = await call('GET', '/api/specialities');
check('specialities', r.status === 200 && r.json.data.length === 6, r.json);
const tagIds = r.json.data.slice(0, 2).map((s) => s.id);

// ---- Doctors ----
r = await call('GET', '/api/doctor?limit=5');
check('doctor list', r.status === 200 && r.json.data.length === 5 && r.json.pagination.total >= 8, r.json);
r = await call('GET', '/api/doctor?type=aura');
check('doctor list aura', r.status === 200 && r.json.data.every((d) => d.isAuraSpecialist), r.json);
r = await call('GET', '/api/doctor?search=akash');
check('doctor search', r.status === 200 && r.json.data.some((d) => d.name.includes('Akash')), r.json);
r = await call('GET', '/api/doctor?sort=distance&lat=22.75&lng=75.895');
check('doctor distance sort', r.status === 200 && r.json.data[0].distanceKm !== null && r.json.data[0].distanceKm <= r.json.data[1].distanceKm, r.json);
r = await call('GET', '/api/doctor?sort=distance');
check('distance sort needs lat/lng', r.status === 400, r.json);
r = await call('GET', '/api/doctor?sort=availability');
check('doctor availability sort', r.status === 200, r.json);
r = await call('GET', '/api/doctor/all');
check('legacy doctor/all still works', r.status === 200 && Array.isArray(r.json.data), r.json);
const docId = (await call('GET', '/api/doctor?search=Akash')).json.data[0].id;
r = await call('GET', `/api/doctor/${docId}`, { token });
check('doctor profile', r.status === 200 && r.json.data.timings.length > 0 && !('password' in r.json.data) && r.json.data.hospitals.length === 1, r.json);
r = await call('GET', `/api/doctor/${docId}/available-dates?days=8`);
check('available dates', r.status === 200 && r.json.data.length === 8, r.json);
const workDay = r.json.data.find((d, i) => i > 0 && d.hasAvailability).date;
r = await call('GET', `/api/doctor/${docId}/slots?date=${workDay}`);
check('slots', r.status === 200 && r.json.data.groups.length >= 2, r.json);
const allSlots = r.json.data.groups.flatMap((g) => g.slots);
const [slotA, slotB] = allSlots.filter((s) => s.available);
r = await call('GET', `/api/doctor/${docId}/slots?date=2000-01-01`);
check('past date slots 400', r.status === 400, r.json);
r = await call('POST', `/api/doctor/${docId}/favourite`, { token });
check('favourite add', r.status === 200, r.json);
r = await call('GET', '/api/me/favourite-doctors', { token });
check('favourite list', r.status === 200 && r.json.data.length === 1 && r.json.data[0].isFavourite, r.json);
r = await call('POST', `/api/doctor/${docId}/reviews`, { token, body: { rating: 4, comment: 'Good' } });
check('doctor review', r.status === 201, r.json);
const before = (await call('GET', `/api/doctor/${docId}`)).json.data.ratingCount;
r = await call('POST', `/api/doctor/${docId}/reviews`, { token, body: { rating: 5 } });
r = await call('GET', `/api/doctor/${docId}`);
check('rating upsert keeps one review per user', r.json.data.ratingCount === before, r.json.data);
r = await call('POST', `/api/doctor/${docId}/reviews`, { token, body: { rating: 7 } });
check('rating range 400', r.status === 400, r.json);

// ---- Reports ----
r = await call('POST', '/api/reports', { token, form: fileForm({}, [['files', PDF, 'blood.pdf', 'application/pdf'], ['files', PNG, 'xray.png', 'image/png']]) });
check('reports upload', r.status === 201 && r.json.data.length === 2, r.json);
const reportIds = r.json.data.map((f) => f.id);
const signedUrl = r.json.data[0].url;
const dl = await call('GET', new URL(signedUrl, BASE).pathname + new URL(signedUrl, BASE).search, { raw: true });
check('signed private file download', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf');
r = await call('GET', `/api/files/${reportIds[0]}?expires=9999999999&sig=bad`);
check('tampered signature 403', r.status === 403, r.json);
r = await call('GET', `/api/files/${reportIds[0]}`, { token });
check('owner bearer download', r.status === 200);
r = await call('GET', '/api/reports', { token });
check('reports list', r.status === 200 && r.json.data.length === 2, r.json);

// ---- Appointments ----
const base = { doctorId: docId, date: workDay, startTime: slotA.time, symptomIds, otherSymptoms: 'Headache', reportIds: [reportIds[0]], acceptTerms: true };
r = await call('POST', '/api/appointments', { token, body: { ...base, acceptTerms: false } });
check('appointment needs terms', r.status === 400, r.json);
r = await call('POST', '/api/appointments', { token, body: { ...base, forSelf: false } });
check('someone else requires patient details', r.status === 400, r.json);
r = await call('POST', '/api/appointments', { token, body: { ...base, startTime: '03:07' } });
check('non-slot time rejected', r.status === 400, r.json);
r = await call('POST', '/api/appointments', { token, body: { ...base, forSelf: false, patientName: 'Mom', patientPhone: '9876543210' } });
check('create appointment', r.status === 201 && r.json.data.status === 'PENDING_PAYMENT' && r.json.data.symptoms.length === 2 && r.json.data.reports.length === 1 && r.json.data.patient.name === 'Mom', r.json);
const apptId = r.json.data.id;
r = await call('POST', '/api/appointments', { token, body: base });
check('double booking 409', r.status === 409, r.json);
r = await call('GET', `/api/doctor/${docId}/slots?date=${workDay}`);
check('slot shows unavailable', r.json.data.groups.flatMap((g) => g.slots).find((s) => s.time === slotA.time).available === false);
r = await call('POST', `/api/appointments/${apptId}/pay`, { token });
check('pay appointment', r.status === 200 && r.json.data.status === 'CONFIRMED' && r.json.data.payment.status === 'SUCCESS', r.json);
r = await call('POST', `/api/appointments/${apptId}/pay`, { token });
check('pay twice 400', r.status === 400, r.json);
r = await call('GET', '/api/appointments?scope=current', { token });
check('list current appointments', r.status === 200 && r.json.data.length === 1 && r.json.data[0].canCancel, r.json);
r = await call('POST', `/api/appointments/${apptId}/reschedule`, { token, body: { date: workDay, startTime: slotB.time } });
check('reschedule', r.status === 200 && r.json.data.startTime === slotB.time && r.json.data.rescheduleCount === 1, r.json);
r = await call('GET', `/api/doctor/${docId}/slots?date=${workDay}`);
const after = r.json.data.groups.flatMap((g) => g.slots);
check('old slot freed, new slot taken', after.find((s) => s.time === slotA.time).available && !after.find((s) => s.time === slotB.time).available);
r = await call('POST', `/api/appointments/${apptId}/reports`, { token, body: { reportIds: [reportIds[1]] } });
check('attach report', r.status === 200 && r.json.data.reports.length === 2, r.json);
r = await call('POST', `/api/appointments/${apptId}/cancel`, { token, body: { reason: 'Busy' } });
check('cancel', r.status === 200 && r.json.data.status === 'CANCELLED' && !r.json.data.canCancel, r.json);
r = await call('POST', `/api/appointments/${apptId}/cancel`, { token });
check('cancel twice 400', r.status === 400, r.json);
r = await call('GET', '/api/appointments?scope=past', { token });
check('cancelled shows in past', r.status === 200 && r.json.data.some((a) => a.id === apptId), r.json);
r = await call('GET', '/api/payments', { token });
check('payment history', r.status === 200 && r.json.data[0].title === 'Appointment Booking Charge' && r.json.data[0].status === 'SUCCESS', r.json);

// ---- Hospitals ----
r = await call('GET', '/api/hospital');
check('hospital list', r.status === 200 && r.json.data.length >= 4, r.json);
const hospIds = r.json.data.filter((h) => h.name !== 'Web Hosp').map((h) => h.id);
r = await call('GET', '/api/hospital?sort=distance&lat=22.69&lng=75.86');
check('hospital distance', r.status === 200 && r.json.data[0].distanceKm <= r.json.data[1].distanceKm, r.json);
r = await call('GET', '/api/hospital?search=bombay');
check('hospital search', r.status === 200 && r.json.data.length === 1, r.json);
r = await call('GET', '/api/hospital?sort=availability');
check('hospital availability', r.status === 200, r.json);
r = await call('GET', '/api/hospital/all');
check('legacy hospital/all', r.status === 200 && r.json.total >= 4, r.json);
const hosp = (await call('GET', `/api/doctor/${docId}`)).json.data.hospitals[0].id;
r = await call('GET', `/api/hospital/${hosp}`);
check('hospital profile', r.status === 200 && r.json.data.rooms.length === 5 && r.json.data.closedDays.includes('sunday') && r.json.data.doctors.length >= 1 && r.json.data.packages.length === 2, r.json);
const roomId = r.json.data.rooms[0].id;
r = await call('GET', `/api/hospital/${hosp}/rooms?roomType=PRIVATE`);
check('rooms filter', r.status === 200 && r.json.data.length === 1 && r.json.data[0].roomTypeLabel === 'Private', r.json);
r = await call('GET', `/api/hospital/${hosp}/doctors`);
check('hospital doctors', r.status === 200 && r.json.data.some((d) => d.id === docId), r.json);
r = await call('GET', `/api/hospital/compare?ids=${hospIds[0]},${hospIds[1]}`);
check('compare by ids', r.status === 200 && r.json.data.hospitals.length === 2 && r.json.data.hospitals[0].feesPerDay.PRIVATE === 5000, r.json);
r = await call('GET', `/api/hospital/compare?names=MY Hospital,Apple`);
check('compare by names', r.status === 200 && r.json.data.hospitals.length === 2, r.json);
r = await call('GET', `/api/hospital/compare?ids=${hospIds[0]}`);
check('compare needs 2', r.status === 400, r.json);
r = await call('POST', `/api/hospital/${hosp}/reviews`, { token, body: { rating: 4 } });
check('hospital review', r.status === 201, r.json);

// ---- Hospital bookings ----
const otherDoc = (await call('GET', `/api/doctor?hospitalId=${hospIds.find((h) => h !== hosp)}`)).json.data[0]?.id;
if (otherDoc) {
  r = await call('POST', '/api/hospital-bookings', { token, body: { hospitalId: hosp, admissionDate: workDay, doctorId: otherDoc } });
  check('booking rejects doctor not at hospital', r.status === 400, r.json);
}
r = await call('POST', '/api/hospital-bookings', { token, body: { hospitalId: hosp, admissionDate: workDay, symptomIds, doctorId: docId, roomId, reportIds, otherSymptoms: 'Pain' } });
check('create hospital booking', r.status === 201 && r.json.data.status === 'REQUESTED' && r.json.data.room.id === roomId && r.json.data.reports.length === 2, r.json);
const bookingId = r.json.data.id;
r = await call('GET', '/api/hospital-bookings?scope=current', { token });
check('list bookings', r.status === 200 && r.json.data.length === 1, r.json);
r = await call('PATCH', `/api/admin/hospital-bookings/${bookingId}/status`, { body: { status: 'CONFIRMED' } });
check('admin without key 401', r.status === 401, r.json);
r = await call('PATCH', `/api/admin/hospital-bookings/${bookingId}/status`, { headers: { 'x-admin-key': ADMIN_KEY }, body: { status: 'CONFIRMED' } });
check('admin confirm booking', r.status === 200 && r.json.data.status === 'CONFIRMED', r.json);
r = await call('POST', `/api/hospital-bookings/${bookingId}/reschedule`, { token, body: { admissionDate: workDay } });
check('reschedule booking -> REQUESTED', r.status === 200 && r.json.data.status === 'REQUESTED', r.json);
r = await call('POST', `/api/hospital-bookings/${bookingId}/cancel`, { token });
check('cancel booking', r.status === 200 && r.json.data.status === 'CANCELLED', r.json);

// ---- Notifications ----
r = await call('GET', '/api/notifications', { token });
check('notifications', r.status === 200 && r.json.data.length >= 5 && r.json.unreadCount >= 5, { n: r.json.data?.length });
const nId = r.json.data[0].id;
r = await call('GET', `/api/notifications/${nId}`, { token });
check('notification detail marks read', r.status === 200 && r.json.data.isRead, r.json);
r = await call('POST', '/api/notifications/read-all', { token });
r = await call('GET', '/api/notifications/unread-count', { token });
check('read all', r.json.data.count === 0, r.json);

// ---- Chat ----
r = await call('POST', '/api/conversations', { token, body: { doctorId: docId } });
check('open doctor conversation', r.status === 200 && r.json.data.doctor.id === docId, r.json);
const convId = r.json.data.id;
r = await call('POST', '/api/conversations', { token, body: { doctorId: docId } });
check('open is idempotent', r.json.data.id === convId, r.json);
r = await call('POST', `/api/conversations/${convId}/messages`, { token, body: { text: 'Hello doctor' } });
check('send message', r.status === 201, r.json);
r = await call('POST', `/api/admin/conversations/${convId}/messages`, { headers: { 'x-admin-key': ADMIN_KEY }, body: { text: 'Hi, how can I help?', senderType: 'DOCTOR' } });
check('doctor reply via admin', r.status === 201, r.json);
r = await call('GET', '/api/conversations', { token });
check('conversation list unread', r.status === 200 && r.json.data[0].unreadCount === 1 && r.json.data[0].lastMessage === 'Hi, how can I help?', r.json);
r = await call('GET', `/api/conversations/${convId}/messages`, { token });
check('messages', r.status === 200 && r.json.data.length === 2 && r.json.data[0].senderType === 'DOCTOR', r.json);
r = await call('POST', '/api/conversations', { token, body: { type: 'AURA' } });
check('open aura conversation', r.status === 200 && r.json.data.type === 'AURA', r.json);
r = await call('POST', `/api/conversations/${convId}/block`, { token, body: { blocked: true } });
r = await call('POST', `/api/conversations/${convId}/messages`, { token, body: { text: 'x' } });
check('blocked conversation send 403', r.status === 403, r.json);

// ---- Feed ----
r = await call('POST', '/api/posts', { token, form: fileForm({ title: 'Knee pain case', body: 'Details', visibility: 'PUBLIC', tagIds: tagIds.join(',') }, [['images', PNG, 'k.png', 'image/png'], ['files', PDF, 'r.pdf', 'application/pdf']]) });
check('create post', r.status === 201 && r.json.data.images.length === 1 && r.json.data.attachments.length === 1 && r.json.data.tags.length === 2, r.json);
const postId = r.json.data.id;
r = await call('POST', '/api/posts', { token, form: fileForm({ title: '' }, []) });
check('post title required', r.status === 400, r.json);
r = await call('POST', `/api/posts/${postId}/like`, { token });
r = await call('POST', `/api/posts/${postId}/like`, { token });
check('like idempotent', r.status === 200 && r.json.data.likeCount === 1 && r.json.data.likedByMe, r.json);
r = await call('POST', `/api/posts/${postId}/save`, { token });
check('save', r.json.data.savedByMe === true, r.json);
r = await call('POST', `/api/posts/${postId}/comments`, { token, body: { text: 'Nice' } });
check('comment', r.status === 201, r.json);
const commentId = r.json.data.id;
r = await call('POST', `/api/posts/${postId}/comments`, { token, body: { text: 'Reply', parentId: commentId } });
check('reply', r.status === 201 && r.json.data.parentId === commentId, r.json);
r = await call('GET', `/api/posts/${postId}`, { token });
check('post detail w/ comments', r.status === 200 && r.json.data.commentCount === 2 && r.json.data.comments[0].replies.length === 1, r.json);
r = await call('GET', '/api/posts?saved=true', { token });
check('saved filter', r.status === 200 && r.json.data.length === 1, r.json);
r = await call('DELETE', `/api/comments/${commentId}`, { token });
r = await call('GET', `/api/posts/${postId}`, { token });
check('delete comment + replies decrements', r.json.data.commentCount === 0, r.json);
r = await call('DELETE', `/api/posts/${postId}/like`, { token });
check('unlike', r.json.data.likeCount === 0, r.json);
r = await call('DELETE', `/api/posts/${postId}`, { token });
check('delete post', r.status === 200, r.json);

// ---- Assistant / complaints / feedback ----
r = await call('POST', '/api/assistant-requests', { token, body: { type: 'DOCTOR', doctorName: 'Dr X', locationText: 'Palda', latitude: 22.7, longitude: 75.8 } });
check('assistant doctor', r.status === 201 && r.json.data.typeLabel === 'Doctor', r.json);
r = await call('POST', '/api/assistant-requests', { token, body: { type: 'BLOOD_DONATION' } });
check('blood donation requires group', r.status === 400, r.json);
r = await call('POST', '/api/assistant-requests', { token, form: fileForm({ type: 'MEDICINE', medicineName: 'Paracetamol' }, [['attachment', PNG, 'rx.png', 'image/png']]) });
check('assistant medicine with prescription', r.status === 201 && r.json.data.attachment, r.json);
r = await call('POST', '/api/assistant-requests', { token, form: fileForm({ type: 'HOSPITAL', hospitalName: 'H' }, [['attachment', PNG, 'rx.png', 'image/png']]) });
check('attachment not allowed for hospital', r.status === 400, r.json);
r = await call('POST', '/api/assistant-requests', { token, body: { type: 'JOB', qualification: 'B.Sc Nursing', expectedSalary: '20000' } });
check('assistant job', r.status === 201, r.json);
r = await call('GET', '/api/assistant-requests', { token });
check('assistant list', r.status === 200 && r.json.data.length === 3, r.json);
r = await call('POST', '/api/complaints', { token, form: fileForm({ target: 'HOSPITAL', hospitalId: hosp, description: 'Long wait' }, [['evidence', PNG, 'e.png', 'image/png']]) });
check('complaint', r.status === 201 && r.json.data.evidence, r.json);
r = await call('POST', '/api/feedback', { token, body: { subject: 'App', message: 'Great' } });
check('feedback', r.status === 201, r.json);

// ---- Password / phone ----
r = await call('PATCH', '/api/me/password', { token, body: { oldPassword: 'wrong', newPassword: 'newpass12' } });
check('change password wrong old', r.status === 400, r.json);
r = await call('PATCH', '/api/me/password', { token, body: { oldPassword: 'secret12', newPassword: 'newpass12', confirmPassword: 'newpass12' } });
check('change password', r.status === 200, r.json);
r = await call('POST', '/api/otp/send', { body: { phone: phone2, purpose: 'CHANGE_PHONE' } });
const c2 = r.json.data.devCode;
r = await call('POST', '/api/otp/verify', { body: { phone: phone2, purpose: 'CHANGE_PHONE', code: c2 } });
r = await call('PATCH', '/api/me/phone', { token, body: { phone: phone2, verificationToken: r.json.data.verificationToken } });
check('change phone', r.status === 200 && r.json.data.phone === phone2, r.json);
r = await call('POST', '/api/otp/send', { body: { phone: phone2, purpose: 'RESET_PASSWORD' } });
const c3 = r.json.data.devCode;
r = await call('POST', '/api/otp/verify', { body: { phone: phone2, purpose: 'RESET_PASSWORD', code: c3 } });
r = await call('POST', '/api/user/reset-password', { body: { phone: phone2, verificationToken: r.json.data.verificationToken, newPassword: 'reset123' } });
check('reset password', r.status === 200, r.json);
r = await call('GET', '/api/me', { token });
check('reset signs out sessions', r.status === 401, r.json);
r = await call('POST', '/api/user/signin', { body: { phone: phone2, password: 'reset123' } });
check('signin with reset password', r.status === 200, r.json);
r = await call('POST', '/api/otp/send', { body: { phone: '1234567890', purpose: 'RESET_PASSWORD' } });
check('reset otp unknown phone 404', r.status === 404, r.json);

// ---- Web registration form contracts ----
const dphone = '8' + rnd().slice(0, 1) + rnd();
r = await call('POST', '/api/doctor/register', { body: { userType: 'doctor', name: 'Web Doc', phone: dphone } });
check('web doctor register', r.status === 201 && !r.json.data.password, r.json);
r = await call('PATCH', `/api/doctor/update/${r.json.data.id}`, { body: { specialization: 'Cardiology', address: { complete: 'X', city: 'Pune', pincode: 411001 } } });
check('web doctor update', r.status === 200, r.json);
r = await call('POST', '/api/doctor/signin', { body: { phone: dphone, password: '12345678' } });
check('doctor signin no hash leak', r.status === 200 && !('password' in r.json.data), r.json);
r = await call('POST', '/api/hospital/create', { body: { name: 'Web Hosp', email: `h${rnd()}@test.local`, role: 'HOSPITAL' } });
check('web hospital create', r.status === 201, r.json);
r = await call('PATCH', `/api/hospital/update/${r.json.data.id}`, { body: { numberOfBeds: 20, operatingHours: { allDays: true, startTime: '09:00', endTime: '18:00' } } });
check('web hospital update', r.status === 200, r.json);

r = await call('GET', '/api/nope');
check('404 json', r.status === 404, r.json);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('Failures:', failures);
  process.exitCode = 1;
}
