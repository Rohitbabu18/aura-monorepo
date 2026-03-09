import express from 'express';
import userRoutes from './routes/user.routes.ts';
import hospitalRoutes from './routes/hospital.routes.ts';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/hospital', hospitalRoutes);
app.use('/api/user', userRoutes);


export default app;
