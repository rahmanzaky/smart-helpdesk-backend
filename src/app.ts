import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import v1Routes from './routes/index.js';
import { validateEnv } from './lib/validateEnv.js';

validateEnv();

const app: Express = express();

// const allowedOrigins = [
//   'http://localhost:3000',
//   'https://myapp.com'
// ];

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true
// }));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
  res.send('hello world');
});
app.use('/api', v1Routes);

export default app;