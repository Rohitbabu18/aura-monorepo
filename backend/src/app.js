import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes.ts';
import doctorRoutes from './routes/doctor.routes.ts';
import hospitalRoutes from './routes/hospital.routes.ts';

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

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/hospital', hospitalRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/user', userRoutes);


export default app;
