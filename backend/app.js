import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import resourceRoutes from './routes/resources.js'
import aiRoutes from './routes/ai.js'
import mapRoutes from './routes/maps.js'
dotenv.config({ path: new URL('./.env', import.meta.url) })
const app = express()
app.use(cors({ origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5174'] }))
app.use(express.json())
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api', authRoutes)
app.use('/api', resourceRoutes)
app.use('/api', aiRoutes)
app.use('/api', mapRoutes)
app.use((err, _, res, __) => {
  console.error(err)
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with that unique ID or reference already exists.' })
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'A referenced record does not exist. Check the linked ID.' })
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'This record cannot be deleted while related records exist.' })
  res.status(err.status || 500).json({ message: err.message || 'An unexpected error occurred' })
})
export default app
