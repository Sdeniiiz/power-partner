const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function restore(backupFileName = 'restore_point_latest.json') {
  const backupPath = path.join(__dirname, '..', 'backups', backupFileName);
  if (!fs.existsSync(backupPath)) {
    console.error('Yedek dosyası bulunamadı:', backupPath);
    process.exit(1);
  }

  console.log(`Geri yükleme başlatılıyor: ${backupPath}`);
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  for (const [table, rows] of Object.entries(data.tables)) {
    if (!rows || rows.length === 0) continue;
    console.log(`Tablo geri yükleniyor: ${table} (${rows.length} kayıt)...`);
    
    // Tabloyu temizle
    await client.execute(`DELETE FROM ${table}`);

    // Kolonları belirle ve ekle
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => row[k]);
      await client.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        args: values
      });
    }
  }

  console.log('✓ Tüm veriler yedek noktasına başarıyla geri yüklendi!');
}

const targetFile = process.argv[2] || 'restore_point_latest.json';
restore(targetFile).catch(err => {
  console.error('Geri yükleme hatası:', err);
  process.exit(1);
});
