import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import v1Routes from './routes/index.js';

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
  origin: true,
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