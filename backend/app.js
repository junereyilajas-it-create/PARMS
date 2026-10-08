import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import resourceRoutes from './routes/resources.js'
import propertiesUnifiedRoutes from './routes/properties-unified.js'
import mapRoutes from './routes/maps.js'
import clientRoutes from './routes/client.js'
import adminCertRoutes from './routes/admin-certificates.js'
import generatorRoutes from './routes/generator.js'
import statsRoutes from './routes/stats.js'
import usersRoutes from './routes/users.js'
import gisRoutes from './routes/gis.js'
import assessmentsRoutes from './routes/assessments.js'
import assessmentAssignmentsRoutes from './routes/assessment-assignments.js'
import reportsRoutes from './routes/reports.js'
import systemSettingsRoutes from './routes/systemSettings.js'
import supportTicketsRoutes from './routes/supportTickets.js'
dotenv.config({ path: new URL('./.env', import.meta.url) })
const app = express()
app.use(cors({ origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5174'] }))
app.use(express.json())
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api', authRoutes)
app.use('/api', propertiesUnifiedRoutes)
app.use('/api', assessmentsRoutes)
app.use('/api', assessmentAssignmentsRoutes)
app.use('/api', resourceRoutes)
app.use('/api', mapRoutes)
app.use('/api', clientRoutes)
app.use('/api', adminCertRoutes)
app.use('/api', generatorRoutes)
app.use('/api', statsRoutes)
app.use('/api', usersRoutes)
app.use('/api', gisRoutes)
app.use('/api', reportsRoutes)
app.use('/api', systemSettingsRoutes)
app.use('/api', supportTicketsRoutes)
app.use((err, _, res, __) => {
  console.error(err)
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with that unique ID or reference already exists.' })
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'A referenced record does not exist. Check the linked ID.' })
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'This record cannot be deleted while related records exist.' })
  res.status(err.status || 500).json({ message: err.message || 'An unexpected error occurred' })
})
export default app
