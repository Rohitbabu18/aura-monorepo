import express from 'express';
import cors from 'cors';
import path from 'node:path';
import userRoutes from './routes/user.routes.ts';
import doctorRoutes from './routes/doctor.routes.ts';
import hospitalRoutes from './routes/hospital.routes.ts';
import otpRoutes from './routes/otp.routes.ts';
import meRoutes from './routes/me.routes.ts';
import catalogRoutes from './routes/catalog.routes.ts';
import appointmentRoutes from './routes/appointment.routes.ts';
import hospitalBookingRoutes from './routes/hospitalBooking.routes.ts';
import chatRoutes from './routes/chat.routes.ts';
import adminRoutes from './routes/admin.routes.ts';
import { reportRouter, fileRouter } from './routes/file.routes.ts';
import { paymentRouter, notificationRouter } from './routes/misc.routes.ts';
import { postRouter, commentRouter } from './routes/feed.routes.ts';
import { assistantRouter, complaintRouter, feedbackRouter } from './routes/support.routes.ts';
import { UPLOAD_DIR } from './lib/upload.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

// Public uploads (avatars, feed images). Private files are served by /api/files/:id.
app.use('/uploads', express.static(path.join(UPLOAD_DIR, 'public'), { maxAge: '7d', index: false }));

// Provider registration + patient auth (existing)
app.use('/api/hospital', hospitalRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/user', userRoutes);

// Patient app
app.use('/api/otp', otpRoutes);
app.use('/api/me', meRoutes);
app.use('/api', catalogRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/hospital-bookings', hospitalBookingRoutes);
app.use('/api/reports', reportRouter);
app.use('/api/files', fileRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/conversations', chatRoutes);
app.use('/api/posts', postRouter);
app.use('/api/comments', commentRouter);
app.use('/api/assistant-requests', assistantRouter);
app.use('/api/complaints', complaintRouter);
app.use('/api/feedback', feedbackRouter);

// Back office (x-admin-key)
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
