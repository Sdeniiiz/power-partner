const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Routes
const settingsRoutes = require('./routes/settings');
const leadsRoutes = require('./routes/leads');
const jobsRoutes = require('./routes/jobs');
const teamRoutes = require('./routes/team');
const calendarRoutes = require('./routes/calendar');

app.use('/api/settings', settingsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/calendar', calendarRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'PowerPartner CRM',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production if built
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint bulunamadı' });
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.send('PowerPartner API Sunucusu Çalışıyor. Frontend geliştirme sunucusu için http://localhost:5173 adresini açınız.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 PowerPartner Backend Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
});
