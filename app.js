const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uuid = () => crypto.randomUUID(), now = () => new Date(Date.now() + 252e5).toISOString().replace('Z', '+07:00');
const fmt = i => new Date(i).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500) }

// ===== Penyimpanan lokal (IndexedDB) =====
const DB = new Promise((ok, no) => { const r = indexedDB.open('bukutamu', 1); r.onupgradeneeded = () => { ['tamu', 'foto', 'log'].forEach(s => r.result.createObjectStore(s, { keyPath: 'id' })); r.result.createObjectStore('set', { keyPath: 'k' }) }; r.onsuccess = () => ok(r.result); r.onerror = no });
const tx = async (s, m, f) => { const d = await DB; return new Promise((ok, no) => { const t = d.transaction(s, m), r = f(t.objectStore(s)); t.oncomplete = () => ok(r.result); t.onerror = () => no(t.error) }) };
const all = s => tx(s, 'readonly', o => o.getAll()), get = (s, k) => tx(s, 'readonly', o => o.get(k)), put = (s, v) => tx(s, 'readwrite', o => o.put(v)), del = (s, k) => tx(s, 'readwrite', o => o.delete(k));

let data = [], pendingFoto = null, shot = null, stream = null, face = 'environment', sel = new Set(), kl = [], noClose = false;
async function load() { data = (await all('tamu')).sort((a, b) => b.waktu_masuk.localeCompare(a.waktu_masuk)); render(); banner() }

// ===== Tampilan daftar =====
function row(t, k) { return `<div class="r${t.dihapus_pada ? ' x' : ''}" data-id="${t.id}">${k && t.dihapus_pada ? `<input type="checkbox" class="ck"${sel.has(t.id) ? ' checked' : ''}>` : ''}<div class="m"><b>${esc(t.nama)}</b><span>${esc(t.kecamatan || t.instansi || t.kategori)}</span>${t.jumlah > 1 ? `<span class="chip">${t.jumlah} orang</span>` : ''}</div><time>${fmt(t.waktu_masuk)}</time>${k ? `<div class="a">${t.dihapus_pada ? '<button data-a="pulih">Pulihkan</button>' : '<button data-a="edit">Edit</button><button data-a="hapus" class="d">Hapus</button>'}</div>` : ''}</div>` }
function render() {
    const hr = now().slice(0, 10), ac = data.filter(t => !t.dihapus_pada); $('#st').innerHTML = `<small>${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small><div class="n"><div><b>${ac.filter(t => t.waktu_masuk.startsWith(hr)).length}</b><span>Tamu hari ini</span></div><div><b>${ac.filter(t => t.waktu_masuk.startsWith(hr.slice(0, 7))).length}</b><span>Tamu bulan ini</span></div></div>`;
    const q = $('#q').value.toLowerCase(), d = $('#d').value;
    const a = data.filter(t => !t.dihapus_pada && (!d || t.waktu_masuk.startsWith(d)) && t.nama.toLowerCase().includes(q));
    $('#l1').innerHTML = a.map(t => row(t)).join('') || `<p class="e">Belum ada tamu${d ? ' pada tanggal ini' : ''}. Tekan + untuk mencatat tamu.</p>`;
    const q2 = $('#q2').value.toLowerCase(), sd = $('#td').checked, d1 = $('#d1').value, d2 = $('#d2').value, b = data.filter(t => !!t.dihapus_pada === sd && t.nama.toLowerCase().includes(q2) && (!d1 || t.waktu_masuk.slice(0, 10) >= d1) && (!d2 || t.waktu_masuk.slice(0, 10) <= d2)); kl = b;[...sel].forEach(i => { if (!b.some(t => t.id === i)) sel.delete(i) });
    $('#l2').innerHTML = (sd ? b : b.slice(0, 100)).map(t => row(t, 1)).join('') || '<p class="e">Data tidak ditemukan.</p>';
    $('#ca').hidden = !sd || !b.length; $('#cat').textContent = `Centang semua (${b.length} data)`; $('#cka').checked = sd && b.length > 0 && sel.size === b.length; $('#bulk').hidden = !sd || !sel.size; $('#bn').textContent = sel.size + ' dipilih'; document.body.classList.toggle('sel', !$('#bulk').hidden);
    renderLapor()
}
const sheet = h => { $('#shc').innerHTML = h; $('#sh').hidden = false; const x = $('#bx'); if (x) x.onclick = close };
const close = () => { $('#sh').hidden = true; noClose = false };
$('#sh').onclick = e => { if (e.target.id === 'sh' && !noClose) close() };
async function detail(id) {
    const t = data.find(x => x.id === id), f = t.ada_foto ? await get('foto', id) : null;
    sheet(`<h3>${esc(t.nama)}</h3>${f ? `<img class="ph" alt="Foto tamu" src="${URL.createObjectURL(f.blob)}">` : ''}<dl>${[['Waktu masuk', fmt(t.waktu_masuk)], ['Kategori', t.kategori], ['Instansi', t.instansi], ['Kecamatan', t.kecamatan], ['No. HP', t.no_hp], ['Bagian dituju', t.bagian], ['Keperluan', t.keperluan], ['Catatan', t.catatan], ['Jumlah orang', t.jumlah]].filter(x => x[1]).map(x => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl><button class="b2" id="bx" style="width:100%">Tutup</button>`)
}
document.addEventListener('click', async e => {
    const r = e.target.closest('.r'); if (!r) return; const id = r.dataset.id, a = e.target.dataset.a, t = data.find(x => x.id === id);
    if (e.target.classList.contains('ck')) { e.target.checked ? sel.add(id) : sel.delete(id); return render() }
    if (!a) return detail(id);
    if (a === 'edit') return form(id);
    if (a === 'hapus') { sheet(`<h3>Hapus data tamu?</h3><p>${esc(t.nama)} akan disembunyikan dari daftar. Data masih tersimpan dan bisa dipulihkan.</p><div class="row"><button class="b2" id="bx">Batal</button><button class="b" id="ok" style="background:var(--r)">Hapus</button></div>`); $('#ok').onclick = () => mark(t, now()); }
    if (a === 'pulih') mark(t, '')
});
async function mark(t, v) { const n = now(); await put('log', { id: uuid(), waktu: n, aksi: v ? 'hapus' : 'pulih', tamu_id: t.id, sebelum: JSON.stringify(t) }); t.dihapus_pada = v; t.diubah_pada = n; await put('tamu', t); close(); toast(v ? 'Data dihapus.' : 'Data dipulihkan.'); load() }

// ===== Form tambah / edit =====
const opt = (a, v) => (v&&!a.includes(v)?[...a, v]:a).map(x =>`<option${x === v ?' selected':''}>${esc(x)}</option>`).join('');
function form(id) {
    const t = id ? data.find(x => x.id === id) : {}, e = !!id; pendingFoto = null;
    sheet(`<h3>${e ? 'Edit data tamu' : 'Tambah tamu'}</h3>
 <label>Nama *<input id="f_nama" list="dl" value="${esc(t.nama)}" autocomplete="off"></label><datalist id="dl">${[...new Set(data.filter(x => !x.dihapus_pada).map(x => x.nama))].slice(0, 300).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
 <label>Kategori tamu *<select id="f_kat">${opt(KAT, t.kategori)}</select></label>
 <label id="w_ins">Nama instansi<input id="f_ins" value="${esc(t.instansi)}"></label>
 <label>Kecamatan asal<select id="f_kec"><option value="">Pilih kecamatan</option>${opt(KEC, t.kecamatan)}</select></label>
 <label>No. HP (opsional)<input id="f_hp" inputmode="tel" value="${esc(t.no_hp)}"></label>
 <label>Bagian yang dituju<select id="f_bag">${opt(BAG, t.bagian)}</select></label>
 <label>Keperluan<select id="f_kep">${opt(KEP, t.keperluan)}</select></label>
 <label>Catatan (opsional)<input id="f_cat" value="${esc(t.catatan)}"></label>
 <label>Jumlah orang<input id="f_jml" type="number" min="1" value="${t.jumlah || 1}"></label>
 ${e ? '' : '<div id="fotoBox" style="margin-bottom:14px"><button class="b2" id="bf" style="width:100%">Ambil foto (opsional)</button></div>'}
 <div class="row"><button class="b2" id="bx">Batal</button><button class="b" id="bs">Simpan</button></div>`);
    const sync = () => { $('#w_ins').hidden = $('#f_kat').value === KAT[0] }; $('#f_kat').onchange = sync; sync();
    if (!e) $('#bf').onclick = camOpen;
    if (!e) $('#f_nama').onchange = () => { const p = data.find(x => !x.dihapus_pada && x.nama.toLowerCase() === $('#f_nama').value.trim().toLowerCase()); if (p) { $('#f_kat').value = p.kategori; $('#f_ins').value = p.instansi; $('#f_kec').value = p.kecamatan; $('#f_hp').value = p.no_hp; sync() } };
    $('#bs').onclick = () => save(id)
}
async function save(id) {
    const v = k => $('#f_' + k).value.trim(), o = { nama: v('nama'), kategori: v('kat'), instansi: v('ins'), kecamatan: v('kec'), no_hp: v('hp'), bagian: v('bag'), keperluan: v('kep'), catatan: v('cat'), jumlah: Math.max(1, +v('jml') || 1) };
    if (!o.nama) return toast('Isi nama tamu.');
    if (o.kategori === KAT[0]) { o.instansi = ''; if (!o.kecamatan) return toast('Pilih kecamatan asal.') }
    const n = now(); let t;
    if (id) { t = data.find(x => x.id === id); await put('log', { id: uuid(), waktu: n, aksi: 'edit', tamu_id: id, sebelum: JSON.stringify(t) }); Object.assign(t, o, { diubah_pada: n }) }
    else { t = { id: uuid(), ...o, waktu_masuk: n, dibuat_pada: n, diubah_pada: n, dihapus_pada: '', ada_foto: pendingFoto ? 1 : 0 }; if (pendingFoto) await put('foto', { id: t.id, blob: pendingFoto }) }
    await put('tamu', t); pendingFoto = null; close(); toast('Data tersimpan.'); load()
}
$('#fab').onclick = () => form();

// ===== Kamera langsung (tanpa galeri) =====
async function camStart() { camStop(); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: face } }, audio: false }); $('#cv').srcObject = stream } catch { camClose(); toast('Kamera tidak bisa dibuka. Cek izin kamera. Tamu tetap bisa disimpan tanpa foto.') } }
function camStop() { stream && stream.getTracks().forEach(t => t.stop()); stream = null }
function camClose() { camStop(); $('#cam').hidden = true }
function camOpen() { $('#cam').hidden = false; camMode(0); camStart() }
function camMode(done) { $('#cv').hidden = !!done; $('#cp').hidden = !done; $('#c1').hidden = !!done; $('#c2').hidden = !done }
$('#flip').onclick = () => { face = face === 'environment' ? 'user' : 'environment'; camStart() };
$('#cx').onclick = camClose; $('#redo').onclick = () => { shot = null; camMode(0) };
$('#snap').onclick = () => { const v = $('#cv'); if (!v.videoWidth) return; const c = document.createElement('canvas'), s = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight)); c.width = v.videoWidth * s; c.height = v.videoHeight * s; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); c.toBlob(b => { shot = b; $('#cp').src = URL.createObjectURL(b); camMode(1) }, 'image/jpeg', .75) };
$('#use').onclick = () => { pendingFoto = shot; const u = URL.createObjectURL(shot); camClose(); $('#fotoBox').innerHTML = `<img class="th" alt="Foto siap" src="${u}"><button class="b2" id="bf">Ambil ulang</button>`; $('#bf').onclick = camOpen };

// ===== Laporan, export, backup =====
const tgl = d => d ? new Date(d + 'T00:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const rng = () => data.filter(t => !t.dihapus_pada && t.waktu_masuk.slice(0, 10) >= $('#lf').value && t.waktu_masuk.slice(0, 10) <= $('#lu').value).reverse();
function renderLapor() {
    const a = rng(); $('#cn').textContent = a.length + ' kunjungan';
    $('#kop').innerHTML = `<h2>LAPORAN BUKU TAMU</h2><div>${INSTANSI} ${UNIT}</div><div>Periode: ${tgl($('#lf').value)} sampai ${tgl($('#lu').value)}</div><div>Total kunjungan: ${a.length}</div>`;
    $('#rt').innerHTML = `<thead><tr><th>No</th><th>Waktu masuk</th><th>Nama Tamu</th><th>Kategori Tamu</th><th>Kecamatan Asal</th><th>Bagian Dituju</th><th>Keperluan</th><th>Jumlah</th></tr></thead><tbody>${a.map((t, i) => `<tr><td>${i + 1}</td><td>${fmt(t.waktu_masuk)}</td><td>${esc(t.nama)}</td><td>${esc(t.kategori)}</td><td>${esc(t.kecamatan)}</td><td>${esc(t.bagian)}</td><td>${esc(t.keperluan)}</td><td>${t.jumlah}</td></tr>`).join('')}</tbody>`
}
const xl = () => typeof XLSX !== 'undefined' || (toast('Library Excel belum termuat. Buka aplikasi sekali dengan internet.'), false);
const out = (sh, name) => { const wb = XLSX.utils.book_new(); sh.forEach(([n, r, h]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r, h ? { header: h } : undefined), n)); XLSX.writeFile(wb, name) };
$('#xr').onclick = () => {
    if (!xl()) return; const a = rng(), H = ['No', 'Waktu masuk', 'Nama', 'Kategori', 'Instansi', 'Kecamatan', 'No. HP', 'Bagian dituju', 'Keperluan', 'Catatan', 'Jumlah orang'];
    const rows = a.map((t, i) => [i + 1, fmt(t.waktu_masuk), t.nama, t.kategori, t.instansi, t.kecamatan, t.no_hp, t.bagian, t.keperluan, t.catatan, t.jumlah]);
    const ws = XLSX.utils.aoa_to_sheet([['LAPORAN BUKU TAMU'], [INSTANSI + ' ' + UNIT], ['Periode: ' + tgl($('#lf').value) + ' sampai ' + tgl($('#lu').value)], ['Total kunjungan: ' + a.length], [], H, ...rows]);
    ws['!merges'] = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: H.length - 1 } })); ws['!cols'] = [5, 18, 24, 26, 22, 16, 16, 26, 24, 24, 12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, `Laporan_Tamu_${$('#lf').value}_${$('#lu').value}.xlsx`)
};
$('#xb').onclick = async () => {
    if (!xl()) return;
    const C = ['id', 'nama', 'kategori', 'instansi', 'kecamatan', 'no_hp', 'bagian', 'keperluan', 'catatan', 'jumlah', 'waktu_masuk', 'dibuat_pada', 'diubah_pada', 'dihapus_pada', 'ada_foto'];
    const rows = [...data].reverse().map(t => Object.fromEntries(C.map(k => [k, k === 'ada_foto' ? (t.ada_foto ? 'ya' : 'tidak') : k === 'jumlah' ? t.jumlah : String(t[k] ?? '')])));
    const lg = (await all('log')).map(l => ({ id: l.id, waktu: l.waktu, aksi: l.aksi, tamu_id: l.tamu_id, sebelum: l.sebelum, jumlah: l.jumlah ?? '' }));
    out([['Data', rows, C], ['Log', lg, ['id', 'waktu', 'aksi', 'tamu_id', 'sebelum', 'jumlah']], ['Meta', [{ format: 'bukutamu-v1', diekspor: now(), versi_app: '1.0', jumlah_baris: rows.length }]]], `Backup_BukuTamu_${now().slice(0, 10)}.xlsx`); await put('set', { k: 'lb', t: now() }); banner()
};
$('#pr').onclick = () => { const t = document.title; document.title = 'Laporan Buku Tamu ' + $('#lf').value + ' sampai ' + $('#lu').value; print(); document.title = t };
$('#lf').onchange = $('#lu').onchange = renderLapor;

// ===== Navigasi, kunci PIN, awal =====
const TABS = ['data', 'kelola', 'lapor'];
document.querySelectorAll('#nav a[data-p]').forEach(a => a.onclick = () => { const o = TABS.findIndex(p => !$('#p-' + p).hidden), w = TABS.indexOf(a.dataset.p); if (o === w) return; const el = $('#p-' + a.dataset.p); el.classList.remove('sl-l', 'sl-r'); el.classList.add(w > o ? 'sl-r' : 'sl-l'); document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x === a)); TABS.forEach(p => $('#p-' + p).hidden = p !== a.dataset.p); $('#fab').hidden = a.dataset.p === 'lapor'; $('#bulk').style.display = a.dataset.p === 'kelola' ? '' : 'none' });
['q', 'd', 'q2', 'td'].forEach(i => $('#' + i).oninput = render);
const hash = async p => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bt1' + p)))].map(b => b.toString(16).padStart(2, '0')).join('');
async function lockInit() {
    const p = await get('set', 'pin'); $('#lt').textContent = p ? 'Masukkan PIN' : 'Buat PIN baru'; $('#ls').textContent = p ? '' : 'Minimal 4 angka. Catat PIN di tempat aman.'; $('#pin').value = ''; $('#lock').hidden = false;
    $('#pb').onclick = async () => { const v = $('#pin').value; if (v.length < 4) return toast('PIN minimal 4 angka.'); const h = await hash(v); if (!p) await put('set', { k: 'pin', h }); else if (p.h !== h) return toast('PIN salah.'); $('#lock').hidden = true; load(); if (!p) newRec() }
}
$('#cka').onchange = e => { sel.clear(); if (e.target.checked) kl.forEach(t => sel.add(t.id)); render() };
$('#bp').onclick = async () => { const n = now(), c = sel.size; for (const i of sel) { const t = data.find(x => x.id === i); await put('log', { id: uuid(), waktu: n, aksi: 'pulih', tamu_id: i, sebelum: JSON.stringify(t) }); t.dihapus_pada = ''; t.diubah_pada = n; await put('tamu', t) } sel.clear(); toast(c + ' data dipulihkan.'); load() };
$('#bm').onclick = () => {
    sheet(`<h3>Hapus permanen ${sel.size} data?</h3><p>Data, foto, dan salinan lamanya di riwayat akan dimusnahkan dan tidak bisa dikembalikan. Pastikan backup sudah ada.</p><button class="b2" id="bk" style="width:100%;margin-bottom:12px">Backup dulu (Excel)</button><label>Masukkan PIN untuk melanjutkan<input id="cp2" type="password" inputmode="numeric" maxlength="8"></label><div class="row"><button class="b2" id="bx">Batal</button><button class="b" id="ok" style="background:var(--r)">Hapus permanen</button></div>`);
    $('#bk').onclick = () => $('#xb').click();
    $('#ok').onclick = async () => { const p = await get('set', 'pin'); if (await hash($('#cp2').value) !== p.h) return toast('PIN salah.'); await purge([...sel]) }
};
async function purge(ids) {
    const S = new Set(ids); for (const i of ids) { await del('tamu', i); await del('foto', i) }
    for (const l of await all('log')) if (S.has(l.tamu_id) && l.sebelum) { l.sebelum = ''; await put('log', l) }
    await put('log', { id: uuid(), waktu: now(), aksi: 'musnah', tamu_id: '', sebelum: '', jumlah: ids.length });
    sel.clear(); close(); toast(ids.length + ' data dimusnahkan.'); load()
}
const rcode = () => { const a = crypto.getRandomValues(new Uint8Array(12)), A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [0, 4, 8].map(s => [...a.slice(s, s + 4)].map(x => A[x % 32]).join('')).join('-') };
async function newRec() { const c = rcode(); await put('set', { k: 'rec', h: await hash(c) }); sheet(`<h3>Kode pemulihan</h3><p>Catat kode ini dan simpan di tempat aman. Kode dipakai untuk mengatur ulang PIN jika lupa, dan tidak akan ditampilkan lagi.</p><p style="font:700 1.4rem/1.3 ui-monospace,monospace;letter-spacing:.06em;text-align:center">${c}</p><button class="b2" id="cc" style="width:100%;margin-bottom:8px">Salin kode</button><button class="b" id="bx" style="width:100%">Sudah saya catat</button>`); noClose = true; $('#cc').onclick = async () => { try { await navigator.clipboard.writeText(c); toast('Kode disalin. Tempel ke tempat penyimpanan yang aman.') } catch { toast('Gagal menyalin. Catat kode secara manual.') } } }
$('#upin').onclick = () => {
    sheet(`<h3>Ubah PIN</h3><label>PIN lama<input id="p0" type="password" inputmode="numeric" maxlength="8"></label><label>PIN baru (minimal 4 angka)<input id="p1" type="password" inputmode="numeric" maxlength="8"></label><label>Ulangi PIN baru<input id="p2" type="password" inputmode="numeric" maxlength="8"></label><div class="row"><button class="b2" id="bx">Batal</button><button class="b" id="ok">Simpan PIN</button></div>`);
    $('#ok').onclick = async () => { const p = await get('set', 'pin'); if (await hash($('#p0').value) !== p.h) return toast('PIN lama salah.'); const a = $('#p1').value; if (a.length < 4 || a !== $('#p2').value) return toast('PIN baru minimal 4 angka dan harus sama.'); await put('set', { k: 'pin', h: await hash(a) }); await newRec() }
};
$('#lupa').onclick = () => { $('#lr').hidden = false };
$('#rb').onclick = async () => { const r = await get('set', 'rec'); if (!r || await hash($('#rc').value.trim().toUpperCase()) !== r.h) return toast('Kode pemulihan salah atau belum pernah dibuat.'); const a = $('#np').value; if (a.length < 4) return toast('PIN baru minimal 4 angka.'); await put('set', { k: 'pin', h: await hash(a) }); $('#lock').hidden = true; $('#lr').hidden = true; load(); newRec() };
$('#xi').onclick = () => $('#fi').click();
$('#fi').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !xl()) return;
    try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), J = n => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }) : null, rows = J('Data'), m = J('Meta');
        if (!rows || !m || !m[0] || m[0].format !== 'bukutamu-v1' || +m[0].jumlah_baris !== rows.length) return toast('File ini bukan backup Buku Tamu yang valid atau sudah diubah.');
        const have = new Set(data.map(t => t.id)); let ok = 0, sk = 0, bad = 0; const S = x => String(x ?? '');
        for (const r of rows) {
            if (!r.id || !r.nama || !r.waktu_masuk) { bad++; continue } if (have.has(S(r.id))) { sk++; continue }
            await put('tamu', { id: S(r.id), nama: S(r.nama), kategori: S(r.kategori), instansi: S(r.instansi), kecamatan: S(r.kecamatan), no_hp: S(r.no_hp), bagian: S(r.bagian), keperluan: S(r.keperluan), catatan: S(r.catatan), jumlah: Math.max(1, +r.jumlah || 1), waktu_masuk: S(r.waktu_masuk), dibuat_pada: S(r.dibuat_pada), diubah_pada: S(r.diubah_pada), dihapus_pada: S(r.dihapus_pada), ada_foto: 0 }); ok++
        }
        const hl = new Set((await all('log')).map(l => l.id)); for (const l of J('Log') || []) if (l.id && !hl.has(l.id)) await put('log', l);
        await load(); sheet(`<h3>Impor selesai</h3><dl><dt>Data baru masuk</dt><dd>${ok}</dd><dt>Sudah ada (dilewati)</dt><dd>${sk}</dd><dt>Gagal (data tidak lengkap)</dt><dd>${bad}</dd></dl><p>Foto tidak ikut dipulihkan.</p><button class="b" id="bx" style="width:100%">Selesai</button>`)
    } catch { toast('File tidak bisa dibaca.') }
};
async function banner() {
    const b = await get('set', 'lb'), el = $('#bn2'), n = b ? Math.floor((Date.now() - new Date(b.t)) / 864e5) : -1;
    $('#lb2').textContent = b ? 'Backup terakhir: ' + (n < 1 ? 'hari ini' : n + ' hari lalu') : 'Belum pernah dibackup';
    if (!data.length || (b && n < 7)) { el.hidden = true; return }
    el.innerHTML = `<span>${b ? `Backup terakhir ${n} hari lalu.` : 'Data belum pernah dibackup.'} Backup sekarang supaya data aman.</span><button class="b" id="bnb">Backup</button>`; el.hidden = false; $('#bnb').onclick = () => $('#xb').click()
}
async function riwayat() {
    const L = (await all('log')).sort((a, b) => a.waktu.localeCompare(b.waktu)), F = ['nama', 'kategori', 'instansi', 'kecamatan', 'no_hp', 'bagian', 'keperluan', 'catatan', 'jumlah'], P = l => { try { return JSON.parse(l.sebelum) } catch { return null } }, o = [];
    L.forEach((l, i) => {
        if (l.aksi === 'musnah') return o.push([l.waktu, `${l.jumlah} data dimusnahkan permanen`]);
        const b = P(l), A = { edit: 'Diubah', hapus: 'Dihapus', pulih: 'Dipulihkan' }[l.aksi] || l.aksi;
        if (!b) return o.push([l.waktu, `${A}: (data sudah dimusnahkan)`]);
        if (l.aksi !== 'edit') return o.push([l.waktu, `${A}: ${esc(b.nama)}`]);
        const nx = L.slice(i + 1).find(x => x.tamu_id === l.tamu_id && P(x)), a = nx ? P(nx) : data.find(x => x.id === l.tamu_id),
            d = a ? F.filter(k => String(b[k] ?? '') !== String(a[k] ?? '')).map(k => `${k}: ${esc(b[k] || '-')} → ${esc(a[k] || '-')}`) : [];
        o.push([l.waktu, `Diubah: ${esc(b.nama)}${d.length ? '<br><small>' + d.join('<br>') + '</small>' : ''}`])
    });
    sheet(`<h3>Riwayat perubahan</h3>${o.reverse().slice(0, 100).map(x => `<div style="padding:8px 0;border-bottom:1px solid var(--l)"><time>${fmt(x[0])}</time><div>${x[1]}</div></div>`).join('') || '<p class="e">Belum ada perubahan.</p>'}<button class="b2" id="bx" style="width:100%;margin-top:12px">Tutup</button>`)
}
$('#xh').onclick = riwayat;
const tema = v => { try { v ? localStorage.setItem('tema', v) : localStorage.removeItem('tema') } catch { } v ? document.documentElement.dataset.t = v : delete document.documentElement.dataset.t; document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.t === (v || ''))) };
try { tema(localStorage.getItem('tema') || '') } catch { }
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => tema(b.dataset.t));
$('#gear').onclick = e => { e.stopPropagation(); $('#menu').hidden = !$('#menu').hidden };
$('#menu').onclick = e => { if (e.target.closest('#menu>button')) $('#menu').hidden = true };
document.addEventListener('click', e => { if (!e.target.closest('#menu')) $('#menu').hidden = true });
$('#ver').textContent = 'Versi 13. Animasi ' + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'dimatikan oleh pengaturan HP' : 'aktif');
let sx = 0, sy = 0, sg = false, dg = false;
const cur = () => document.querySelector('main>section:not([hidden])'), rs = c => { if (c) { c.style.transform = ''; c.style.opacity = '' } };
document.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; dg = false; sg = e.touches.length === 1 && !e.target.closest('.tw,input,select,textarea,#menu,#top,#nav') && $('#sh').hidden && $('#cam').hidden && $('#lock').hidden }, { passive: true });
document.addEventListener('touchmove', e => { if (!sg) return; const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (!dg && (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.6)) return; dg = true; const c = cur(); if (c) { c.style.transition = 'none'; c.style.transform = `translateX(${dx * .5}px)`; c.style.opacity = 1 - Math.min(1, Math.abs(dx) / 300) * .6 } }, { passive: true });
document.addEventListener('touchend', e => {
    if (!sg) return; sg = false; const dx = e.changedTouches[0].clientX - sx, c = cur();
    if (c && dg) { c.style.transition = 'transform .2s,opacity .2s'; rs(c); setTimeout(() => c.style.transition = '', 250) }
    if (!dg || Math.abs(dx) < 70) return;
    const n = [...document.querySelectorAll('#nav a')], j = n.findIndex(a => a.classList.contains('on')) + (dx < 0 ? 1 : -1); if (n[j]) { n[j].click(); scrollTo(0, 0) }
}, { passive: true });
document.addEventListener('touchcancel', () => { sg = false; const c = cur(); if (c) { c.style.transition = ''; rs(c) } }, { passive: true });
$('#d1').addEventListener('input', () => { if (!$('#d2').value) $('#d2').value = $('#d1').value; render() });
$('#d2').addEventListener('input', () => { if (!$('#d1').value) $('#d1').value = $('#d2').value; render() });
$('#dc').onclick = () => { $('#d1').value = $('#d2').value = ''; render() };
$('#kunci2').onclick = lockInit;
$('#kunci').onclick = lockInit;
const today = now().slice(0, 10); $('#d').value = today; $('#lu').value = today; $('#lf').value = today.slice(0, 8) + '01';
navigator.storage && navigator.storage.persist && navigator.storage.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
lockInit();
