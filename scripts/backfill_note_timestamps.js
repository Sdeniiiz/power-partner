const db = require('../server/db');

async function backfillNoteTimestamps() {
  console.log('🔄 Eski notlar için tarih ve saat ekleme işlemi başlatılıyor...');

  try {
    // 1. Önce sadece not içeren leadleri alalım
    console.log('📡 İşletmeler alınıyor...');
    const leads = await db.all(`
      SELECT id, call_notes, last_called_at, created_at 
      FROM leads 
      WHERE call_notes IS NOT NULL AND length(trim(call_notes)) > 0
    `);
    console.log(`📋 Toplam ${leads.length} adet not içeren işletme bulundu.`);

    // 2. call_logs tablosundaki kayıtları alalım
    console.log('📡 Arama kayıtları alınıyor...');
    const logs = await db.all(`
      SELECT id, lead_id, caller_name, notes, created_at 
      FROM call_logs 
      ORDER BY id ASC
    `);
    console.log(`📋 Toplam ${logs.length} adet arama kaydı yüklendi.`);

    const logsByLead = new Map();
    for (const log of logs) {
      if (!logsByLead.has(log.lead_id)) {
        logsByLead.set(log.lead_id, []);
      }
      logsByLead.get(log.lead_id).push(log);
    }

    let updatedCount = 0;

    for (const lead of leads) {
      const leadLogs = logsByLead.get(lead.id) || [];
      const lines = lead.call_notes.split('\n').filter(Boolean);
      let leadModified = false;

      const updatedLines = lines.map((line, idx) => {
        // Zaten [Tarih ...] damgası varsa dokunma
        if (line.match(/^([^\[:]+?)\s*\[\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}/)) {
          return line;
        }

        const colonIdx = line.indexOf(':');
        const author = colonIdx > -1 && colonIdx < 35 ? line.slice(0, colonIdx).trim() : 'Operatör';
        const content = colonIdx > -1 && colonIdx < 35 ? line.slice(colonIdx + 1).trim() : line.trim();

        // 1. İlgili call_log'dan tarih çek
        const log = leadLogs[idx] || leadLogs[0];
        let timestampSource = log?.created_at || lead.last_called_at || lead.created_at;

        let dateStr = '';
        let timeStr = '';

        if (timestampSource) {
          const d = new Date(timestampSource);
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
            timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
          }
        }

        // 2. Metin içerisindeki tarihi ara
        if (!dateStr) {
          const embeddedDate = content.match(/\b(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})\b/);
          if (embeddedDate) {
            dateStr = embeddedDate[1];
          }
        }

        if (dateStr) {
          leadModified = true;
          return timeStr ? `${author} [${dateStr} ${timeStr}]: ${content}` : `${author} [${dateStr}]: ${content}`;
        }

        return line;
      });

      if (leadModified) {
        const newNotes = updatedLines.join('\n');
        try {
          await db.run('UPDATE leads SET call_notes = ? WHERE id = ?', newNotes, lead.id);
          updatedCount++;
          if (updatedCount % 50 === 0) {
            console.log(`İlerleme: ${updatedCount} kayıt güncellendi...`);
          }
        } catch (e) {
          console.warn(`Lead ${lead.id} güncellenemedi:`, e.message);
        }
      }
    }

    console.log(`✅ Tamamlandı! Toplam ${updatedCount} adet işletmenin notlarına tarih ve saat damgası başarıyla eklendi.`);
  } catch (err) {
    console.error('❌ Hata oluştu:', err);
  }
}

backfillNoteTimestamps().then(() => process.exit(0));
