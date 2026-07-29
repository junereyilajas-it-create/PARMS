import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import resourceRoutes from './routes/resources.js'
import aiRoutes from './routes/ai.js'
import mapRoutes from './routes/maps.js'
dotenv.config()
const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api', authRoutes)
app.use('/api', resourceRoutes)
app.use('/api', aiRoutes)
app.use('/api', mapRoutes)
app.use((err, _, res, __) => { console.error(err); res.status(500).json({ message: 'An unexpected error occurred' }) })
export default app
