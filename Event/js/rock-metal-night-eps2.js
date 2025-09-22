const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwqsJrvZdblJFZFSqdN_Iskz0w9cxvXe0x7HEj881wNHz0FLCImITqyLmsmIIEcr8I/exec";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dn4ugx6ar/upload";
const UPLOAD_PRESET = "ReactFreely-rockandmetal";

let ticketName = "", ticketPriceOnly = 0, drinkPrice = 0, qty = 1;

const tickets = document.querySelectorAll(".ticket-option");
const qtyEl = document.getElementById("qty");
const minus = document.getElementById("minus");
const plus = document.getElementById("plus");

// Pilih tiket
tickets.forEach(t => {
  t.addEventListener("click", () => {
    tickets.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    ticketName = t.dataset.name;
    ticketPriceOnly = parseInt(t.dataset.ticket);
    drinkPrice = parseInt(t.dataset.drink);
    updateSummary();
  });
});

// Counter tiket
minus.onclick = () => { if (qty > 1) { qty--; updateQty(); } };
plus.onclick = () => { if (qty < 10) { qty++; updateQty(); } };
function updateQty() { qtyEl.textContent = qty; updateSummary(); }

// Update ringkasan
function updateSummary() {
  let total = (ticketPriceOnly + drinkPrice) * qty;
  let html = `<div id="order-summary">
    <div class="summary-item"><span>Tiket:</span><span>Rp ${ticketPriceOnly.toLocaleString("id-ID")}</span></div>
    <div class="summary-item"><span>Drink:</span><span>Rp ${drinkPrice.toLocaleString("id-ID")}</span></div>
    <div class="summary-item"><span>Jumlah:</span><span>${qty}</span></div>
    <div class="summary-item"><span>Total:</span><span>Rp ${total.toLocaleString("id-ID")}</span></div>
  </div>`;
  document.getElementById("summary3").innerHTML = html;
  document.getElementById("totalBayar").innerText = "Rp " + total.toLocaleString("id-ID");
}

// Step navigation
const steps = document.querySelectorAll(".form-step");
const stepper = document.querySelectorAll(".step");
function goToStep(n) {
  steps.forEach(s => s.classList.remove("active"));
  steps[n].classList.add("active");
  stepper.forEach(s => s.classList.remove("active"));
  stepper[n].classList.add("active");
}
document.getElementById("next1").onclick = () => { if (ticketName) goToStep(1); else alert("Pilih tiket terlebih dahulu!"); };
document.getElementById("back1").onclick = () => goToStep(0);
document.getElementById("next2").onclick = () => {
  if (document.getElementById("nama").value && document.getElementById("email").value && document.getElementById("wa").value) {
    goToStep(2);
  } else { alert("Isi semua data wajib!"); }
};
document.getElementById("back2").onclick = () => goToStep(1);

// Terms
document.getElementById("openTerms").onclick = () => document.getElementById("modalTerms").style.display = "flex";
document.getElementById("closeTerms").onclick = () => document.getElementById("modalTerms").style.display = "none";
document.getElementById("terms").onchange = () => { document.getElementById("submitBtn").disabled = !document.getElementById("terms").checked; };

// Copy account number
function copyAccountNumber(accountNumber, button) {
  navigator.clipboard.writeText(accountNumber).then(function () {
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i>';
    button.style.color = '#4CAF50';
    button.title = 'Tersalin!';

    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.color = '';
      button.title = 'Salin nomor rekening';
    }, 2000);

    const notification = document.createElement('div');
    notification.textContent = 'Nomor rekening disalin!';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    document.body.appendChild(notification);
    void notification.offsetWidth;
    notification.style.opacity = '1';
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => { document.body.removeChild(notification); }, 300);
    }, 2000);
  });
}

// Loading overlay
function showLoading(show = true) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (show) {
    loadingOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  } else {
    loadingOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Submit
document.getElementById("submitBtn").onclick = async () => {
  const submitBtn = document.getElementById("submitBtn");
  const originalBtnText = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span>Mengirim...';

  const nama = document.getElementById("nama").value;
  const email = document.getElementById("email").value;
  const wa = document.getElementById("wa").value;
  const rekomendasi = document.getElementById("rekomendasi").value;
  const komunitas = document.querySelector("input[name='Komunitas']:checked")?.value || "";
  const pembayaran = document.querySelector("input[name='payment']:checked")?.value;
  const bukti = document.getElementById("bukti").files[0];

  if (!pembayaran) {
    alert("Pilih metode pembayaran!");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    return;
  }

  if (!bukti) {
    alert("Upload bukti pembayaran!");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    return;
  }

  showLoading(true);

  try {
    const fd = new FormData();
    fd.append("file", bukti);
    fd.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
    const data = await res.json();
    const buktiURL = data.secure_url;

    if (!buktiURL) { alert("Upload ke Cloudinary gagal!"); return; }

    // Generate kode pesanan
    const kodePesanan = "ORDER-" + Date.now().toString(36).toUpperCase();

    // Submit ke Apps Script
    let formData = new FormData();
    formData.append("nama", nama);
    formData.append("email", email);
    formData.append("wa", wa);
    formData.append("jenisTiket", ticketName);
    formData.append("hargaTiket", ticketPriceOnly);
    formData.append("hargaMinuman", drinkPrice);
    formData.append("jumlahTiket", qty);
    formData.append("totalHarga", (ticketPriceOnly + drinkPrice) * qty);
    formData.append("metodePembayaran", pembayaran);
    formData.append("catatan", rekomendasi);
    formData.append("komunitas", komunitas);
    formData.append("buktiPembayaran", buktiURL);
    formData.append("kodePesanan", kodePesanan);

    const resp = await fetch(SCRIPT_URL, { method: "POST", body: formData });
    const json = await resp.json();

    if (json.status === "success") {
      const modal = document.getElementById("modalConfirm");
      document.getElementById("kodePesanan").innerText =
        "Nama: " + nama + " dengan kode pesanan " + kodePesanan;
      modal.style.display = "flex";
    } else { alert("❌ Gagal: " + json.message); }

  } catch (err) {
    console.error("Error:", err);
    alert("Terjadi kesalahan: " + (err.message || "Tidak dapat memproses pembayaran"));
  } finally {
    showLoading(false);
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Kirim Pesanan";
  }
};

// Modal close
document.getElementById("modalClose").onclick = () => location.reload();
window.onclick = (e) => { if (e.target == document.getElementById("modalConfirm")) location.reload(); };
