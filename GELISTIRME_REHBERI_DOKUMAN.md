# PowerPartner — 3 Temel Özellik Entegrasyon ve Uygulama Rehberi

Bu döküman; **(1) Not Alanı Performansı & Donma Çözümü**, **(2) Admin Arama Paylaştırma & Bildirim Sistemi** ve **(3) Bulutfon VoIP Santral Entegrasyonu** adımlarını başka bir projeye veya sıfırdan bir sisteme nasıl entegre edeceğinizi adım adım, hazır kod bloklarıyla anlatmaktadır.

---

## 📌 1. ADIM: Not Ekleme & Çağrı Durumundaki Donma/Kasma Sorununun Çözümü

### Sorunun Nedeni:
Kullanıcı metin alanına (`<textarea>`) yazı yazarken listenin boyutu (50-200+ kart) yüzünden tarayıcı her harfte ağır bir reflow/repaint işlemi yapar. Ayrıca arka plandaki otomatik senkronizasyon çalışırsa DOM yeniden çizilir ve yazma kesintiye uğrar.

### Yapılacak 3 İşlem:

#### A) Yazma Gecikmesi (Debounce) Mekanizması:
Veritabanına anında yazmak yerine kullanıcı yazmayı bıraktıktan 500ms sonra kaydeden fonksiyonu ekleyin:

```javascript
let noteSaveDebounceTimer = null;

function bizSet(b, debounce = false) {
  const idx = businesses.findIndex(x => x.id === b.id);
  if (idx >= 0) businesses[idx] = b;
  else businesses.push(b);

  if (debounce) {
    if (noteSaveDebounceTimer) clearTimeout(noteSaveDebounceTimer);
    noteSaveDebounceTimer = setTimeout(() => {
      saveBusinessesToStorage(); // veya veritabanı kaydetme fonksiyonunuz
    }, 500);
  } else {
    saveBusinessesToStorage();
  }
}
```

#### B) Kartlardaki Textarea Dinleyicisi (Event Listener):
`change` yerine `input` dinleyicisi ve `debounce = true` kullanın:

```javascript
document.querySelectorAll('.noteBox').forEach(el => {
  // Yazı yazılırken sıfır gecikme (input lag yok):
  el.addEventListener('input', () => {
    const b = businesses.find(x => x.id === el.dataset.id);
    if (b) {
      b.note = el.value;
      bizSet(b, true); // 500ms debounce ile arka planda sessizce kaydeder
    }
  });

  // Kutudan çıkıldığında (blur) anında kalıcı kaydet:
  el.addEventListener('change', () => {
    const b = businesses.find(x => x.id === el.dataset.id);
    if (b) {
      b.note = el.value;
      bizSet(b, false);
    }
  });
});
```

#### C) Kademeli Yükleme (Pagination / 25'li Gösterim):
Tüm işletmeleri tek seferde DOM'a basmak yerine 25'erli paketler halinde çizin:

```javascript
let listDisplayLimit = 25;

function loadMoreList() {
  listDisplayLimit += 25;
  renderListe(false); // false: sayfa yukarı kaymasın
}

function renderListe(resetLimit = true) {
  if (resetLimit) listDisplayLimit = 25;
  
  // ... Filtreleme işlemleri ...
  const active = list.filter(callableToday);
  const visibleActive = active.slice(0, listDisplayLimit);

  let html = visibleActive.map(bizCard).join('');

  if (active.length > listDisplayLimit) {
    html += `
      <button class="btn-load-more" onclick="loadMoreList()" style="width:100%;padding:12px;margin-top:16px;background:var(--panel2);border:1px dashed var(--border);border-radius:10px;cursor:pointer;color:var(--accent);">
        ⬇️ Daha Fazla Göster (Kalan: ${active.length - listDisplayLimit} İşletme)
      </button>
    `;
  }
  box.innerHTML = html;
  attachBizEvents();
}
```

#### D) Arka Plan Senkronizasyonunda Yazı Koruması:
Arka planda çalışan timer (örn. 10 saniyede bir veri çeken fonksiyon), kullanıcı o an yazı yazıyorsa ekranı baştan çizmemelidir:

```javascript
const activeTag = document.activeElement ? document.activeElement.tagName : '';
if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') {
  // Kullanıcı yazı yazarken ekranı bölme ve renderListe çağırma!
} else {
  renderAll();
}
```

---

## 📌 2. ADIM: Admin Günlük Arama Dağıtımı & Personel Bildirim Sistemi (🔔)

### Veri Modeli
İşletme nesnelerine iki alan ekleyin:
- `b.assignedTo`: Atanan personelin adı (Örn: `'Sezai'`)
- `b.assignedDate`: Atanma tarihi (`'YYYY-MM-DD'`)

Bildirim nesnesi yapısı:
```javascript
{
  id: 'notif_' + Date.now(),
  toUser: 'Sezai', // Personel adı veya 'all'
  title: 'Yeni Günlük Arama Listesi',
  message: 'Yönetici bugün size 25 yeni arama atadı!',
  date: '2026-10-09',
  time: '14:30',
  read: false,
  type: 'call_assignment',
  count: 25
}
```

### A) HTML — Üst Başlığa Bildirim Çanı Ekleme:
```html
<div class="notif-wrapper" style="position:relative;display:flex;align-items:center;">
  <button class="btn-notif" id="notifBellBtn" onclick="toggleNotifMenu()" style="position:relative;background:var(--panel2);border:1px solid var(--border);width:38px;height:38px;border-radius:10px;cursor:pointer;color:var(--text);">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
    <span class="notif-badge" id="notifBadge" style="display:none;position:absolute;top:-4px;right:-4px;background:#FF4D5E;color:#fff;font-size:11px;padding:2px 6px;border-radius:10px;font-weight:700;">0</span>
  </button>
  
  <div class="notif-dropdown" id="notifDropdown" style="display:none;position:absolute;top:48px;right:0;width:320px;background:var(--panel);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.6);z-index:1000;">
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-weight:700;font-size:13px;">
      <span>📢 Bildirimler</span>
      <span style="font-size:11px;color:var(--accent2);cursor:pointer;" onclick="markAllNotificationsRead()">Tümünü Oku</span>
    </div>
    <div class="notif-list" id="notifList" style="max-height:300px;overflow-y:auto;"></div>
  </div>
</div>
```

### B) HTML — Admin Dağıtım Çubuğu (Arama Listesi Üstü):
```html
<div class="assign-bar" id="adminAssignBar" style="display:none;background:var(--panel2);border:1px solid var(--border);padding:12px 16px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-weight:700;font-size:13px;color:var(--accent2);">📢 Günlük Arama Dağıtımı:</span>
    <span id="assignFilteredCount" style="background:rgba(56,189,248,0.15);color:#38BDF8;padding:2px 8px;border-radius:6px;font-size:11px;">0 İşletme Listede</span>
  </div>
  <div style="display:flex;gap:8px;align-items:center;">
    <select id="assignTargetUser" style="padding:7px 10px;font-size:12px;background:var(--panel);border:1px solid var(--border);border-radius:8px;color:var(--text);"></select>
    <input type="number" id="assignBatchCount" placeholder="Adet (örn: 25)" style="width:110px;padding:7px 10px;font-size:12px;background:var(--panel);border:1px solid var(--border);border-radius:8px;color:var(--text);" min="1">
    <button class="btn btn-primary" onclick="handleAssignCallsToUser()" style="padding:7px 12px;font-size:12px;">Seçilene Ata & Bildir</button>
    <button class="btn btn-ghost" onclick="handleAutoDistributeCalls()" style="padding:7px 12px;font-size:12px;border:1px solid var(--border);">⚖️ Eşit Paylaştır</button>
  </div>
</div>
```

### C) JavaScript — Bildirim & Dağıtım Motoru:
```javascript
let notifications = [];

function createNotification(toUser, title, message, count = 0) {
  const notif = {
    id: 'notif_' + Date.now(),
    toUser: toUser,
    title: title,
    message: message,
    date: todayStr(),
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    read: false,
    count: count
  };
  notifications.unshift(notif);
  saveNotificationsToStorage();
  renderNotificationBadge();
}

function renderNotificationBadge() {
  const badgeEl = document.getElementById('notifBadge');
  if (!badgeEl) return;
  const user = getCurrentUser();
  if (!user) { badgeEl.style.display = 'none'; return; }

  const myPerson = user.person || user.name;
  const unreadList = notifications.filter(n => !n.read && (user.role === 'admin' || n.toUser === 'all' || n.toUser === myPerson));

  if (unreadList.length > 0) {
    badgeEl.textContent = unreadList.length;
    badgeEl.style.display = 'block';
  } else {
    badgeEl.style.display = 'none';
  }
}

function handleAssignCallsToUser() {
  const targetPerson = document.getElementById('assignTargetUser').value;
  const batchCount = parseInt(document.getElementById('assignBatchCount').value) || 0;
  if (!targetPerson) { alert('Personel seçin!'); return; }

  const candidates = businesses.filter(b => callableToday(b) && !b.assignedTo);
  const toAssign = batchCount > 0 ? candidates.slice(0, batchCount) : candidates;

  toAssign.forEach(b => {
    b.assignedTo = targetPerson;
    b.assignedDate = todayStr();
  });

  saveBusinessesToStorage();
  createNotification(targetPerson, 'Yeni Günlük Arama Listesi', `Yönetici bugün size ${toAssign.length} yeni arama atadı!`, toAssign.length);
  renderListe();
}

function filterMyAssignedCalls() {
  const user = getCurrentUser();
  const myPerson = user.person || user.name;
  document.getElementById('fAssigned').value = myPerson;
  renderListe();
}
```

---

## 📌 3. ADIM: Bulutfon (bulutfon.com) VoIP Santral Entegrasyonu

### Çalışma Mantığı:
1. Kart üzerinde **"📞 Bulutfon Ara"** butonuna basılır.
2. Web uygulaması arka plandaki PHP köprüsüne (`api.php?action=bulutfon_call`) istek gönderir.
3. PHP, Bulutfon REST API'sine (`POST https://api.bulutfon.com/v2/pbx/call-and-bridge`) bağlanır.
4. Santral **önce personelin kulaklığını/dahilisini (örn: 101) çaldırır**. Personel ahizeyi kaldırdığı anda santral müşteriyi arayıp ikisini birbirine bağlar.

### A) PHP — Backend Bulutfon API Köprüsü (`api.php`):
CORS ve API Key güvenliği için aramayı PHP üzerinden tetikleyin:

```php
if (isset($_GET['action']) && $_GET['action'] === 'bulutfon_call') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    $apiKey = $input['apiKey'] ?? '';
    $extension = $input['extension'] ?? '';
    $destination = $input['destination'] ?? '';

    if (!$apiKey || !$extension || !$destination) {
        echo json_encode(['success' => false, 'error' => 'Eksik parametre']);
        exit;
    }

    $ch = curl_init("https://api.bulutfon.com/v2/pbx/call-and-bridge");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'apikey' => $apiKey,
        'extension' => $extension,
        'destination' => $destination
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    echo json_encode(['success' => ($httpCode >= 200 && $httpCode < 300), 'response' => json_decode($resp, true)]);
    exit;
}
```

### B) JavaScript — Frontend Arama Tetikleyicisi (`triggerBulutfonCall`):
```javascript
async function triggerBulutfonCall(phone, bizName) {
  if (!phone) { alert('Telefon numarası bulunamadı!'); return; }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const cfg = getBulutfonConfig(); // { apiKey: '...', masterNumber: '...' }
  const user = getCurrentUser();
  const ext = (user && user.bulutfonExt) ? user.bulutfonExt : (cfg.masterNumber || '');

  // Bulutfon API kurulmuşsa API üzerinden santral araması:
  if (cfg.apiKey && cfg.apiKey.trim().length > 5 && ext) {
    toast(`Santral dahiliniz (${ext}) aranıyor... Açtığınızda müşteri bağlanacak.`);
    try {
      const resp = await fetch('api.php?action=bulutfon_call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cfg.apiKey,
          extension: ext,
          destination: cleanPhone
        })
      });
      const res = await resp.json();
      if (!res.success) {
        // API başarısızsa doğrudan cihaz telefonunu aç
        window.location.href = 'tel:' + cleanPhone;
      }
    } catch(e) {
      window.location.href = 'tel:' + cleanPhone;
    }
  } else {
    // Bulutfon API girilmemişse doğrudan tel: linkiyle softphone/telefon açılır:
    window.location.href = 'tel:' + cleanPhone;
  }
}
```

### C) Kart Üzerindeki Butonlar:
Her işletme kartında arama butonunu şöyle render edin:

```html
<!-- Bulutfon Butonu -->
<button type="button" class="badge bulutfon" onclick="triggerBulutfonCall('05321002030', 'İşletme Adı')" style="background:#0070BA;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-weight:600;">
  📞 Bulutfon Ara
</button>

<!-- Klasik Doğrudan Arama Butonu -->
<a href="tel:05321002030" class="badge phone">📞 0532 100 20 30</a>
```

### D) Personel Profilinde Dahili No (Extension) Yönetimi:
Personel kullanıcı nesnelerine `bulutfonExt` ekleyin:
```javascript
{
  username: 'sezai',
  name: 'Sezai',
  role: 'member',
  bulutfonExt: '101' // Bulutfon dahili numarası
}
```

---

## 📋 Özet Kontrol Listesi (Checklist)

| Madde | Özellik | Dosya | Yapılan İşlem |
|---|---|---|---|
| **1.1** | Debounce Note Save | `js/db.js` | `bizSet(b, true)` ile 500ms gecikmeli arka plan kaydı. |
| **1.2** | Event Listener | `js/app.js` | Textarea için `input` dinleyicisi. |
| **1.3** | Pagination | `js/app.js` | 25'erli kart gösterimi ve "Daha Fazla Göster" butonu. |
| **1.4** | Focus Guard | `js/db.js` | `activeElement === 'TEXTAREA'` ise senkronizasyon render'ı engellendi. |
| **2.1** | Model Genişletme | `api.php` & `js/db.js` | `assignedTo`, `assignedDate` ve `notifications` dizisi. |
| **2.2** | Bildirim Çanı | `app.html` & `css/style.css` | Header'da canlı sayaçlı çan (🔔) ve çekmece menüsü. |
| **2.3** | Admin Dağıtım Çubuğu | `app.html` & `js/app.js` | Personele arama atama ve eşit paylaştırma araçları. |
| **3.1** | API Köprüsü | `api.php` | `call-and-bridge` cURL çağrısı. |
| **3.2** | Tıkla-Ara Fonksiyonu | `js/db.js` | `triggerBulutfonCall(phone, bizName)` akıllı arama. |
| **3.3** | Dahili No | `js/auth.js` | `bulutfonExt: '101'` desteği. |
