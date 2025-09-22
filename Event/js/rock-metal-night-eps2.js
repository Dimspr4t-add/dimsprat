const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwqsJrvZdblJFZFSqdN_Iskz0w9cxvXe0x7HEj881wNHz0FLCImITqyLmsmIIEcr8I/exec";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dn4ugx6ar/upload";
const UPLOAD_PRESET = "ReactFreely-rockandmetal";

let ticketName="", ticketPriceOnly=0, drinkPrice=0, qty=1;

const tickets=document.querySelectorAll(".ticket-option");
const qtyEl=document.getElementById("qty");
const minus=document.getElementById("minus");
const plus=document.getElementById("plus");

// Pilih tiket
tickets.forEach(t=>{
  t.addEventListener("click",()=>{
    tickets.forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    ticketName=t.dataset.name;
    ticketPriceOnly=parseInt(t.dataset.ticket);
    drinkPrice=parseInt(t.dataset.drink);
    updateSummary();
  });
});

// Counter tiket
minus.onclick=()=>{if(qty>1){qty--; updateQty();}};
plus.onclick=()=>{if(qty<10){qty++; updateQty();}};
function updateQty(){qtyEl.textContent=qty; updateSummary();}

// Update ringkasan
function updateSummary(){
  let total=(ticketPriceOnly+drinkPrice)*qty;
  let html=`<div id="order-summary">
    <div class="summary-item"><span>Tiket:</span><span>Rp ${ticketPriceOnly.toLocaleString("id-ID")}</span></div>
    <div class="summary-item"><span>Drink:</span><span>Rp ${drinkPrice.toLocaleString("id-ID")}</span></div>
    <div class="summary-item"><span>Jumlah:</span><span>${qty}</span></div>
    <div class="summary-item"><span>Total:</span><span>Rp ${total.toLocaleString("id-ID")}</span></div>
  </div>`;
  document.getElementById("summary3").innerHTML=html;
  document.getElementById("totalBayar").innerText="Rp "+total.toLocaleString("id-ID");
}

// Step navigation
const steps=document.querySelectorAll(".form-step");
const stepper=document.querySelectorAll(".step");
function goToStep(n){steps.forEach(s=>s.classList.remove("active")); steps[n].classList.add("active"); stepper.forEach(s=>s.classList.remove("active")); stepper[n].classList.add("active");}
document.getElementById("next1").onclick=()=>{if(ticketName) goToStep(1); else alert("Pilih tiket terlebih dahulu!");};
document.getElementById("back1").onclick=()=>goToStep(0);
document.getElementById("next2").onclick=()=> {
  if(document.getElementById("nama").value && document.getElementById("email").value && document.getElementById("wa").value){
    goToStep(2);
  } else {alert("Isi semua data wajib!");}
};
document.getElementById("back2").onclick=()=>goToStep(1);

// Terms
document.getElementById("openTerms").onclick=()=>document.getElementById("modalTerms").style.display="flex";
document.getElementById("closeTerms").onclick=()=>document.getElementById("modalTerms").style.display="none";
document.getElementById("terms").onchange=()=>{document.getElementById("submitBtn").disabled=!document.getElementById("terms").checked;};

// Function to copy account number to clipboard
function copyAccountNumber(accountNumber, button) {
  // Create a temporary input element
  const tempInput = document.createElement('input');
  tempInput.value = accountNumber;
  document.body.appendChild(tempInput);
  
  // Select and copy the text
  tempInput.select();
  document.execCommand('copy');
  
  // Remove the temporary input
  document.body.removeChild(tempInput);
  
  // Change button style to show success
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-check"></i>';
  button.style.color = '#4CAF50';
  button.title = 'Tersalin!';
  
  // Revert back after 2 seconds
  setTimeout(() => {
    button.innerHTML = originalHTML;
    button.style.color = '';
    button.title = 'Salin nomor rekening';
  }, 2000);
  
  // Show a small notification
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
  
  // Trigger reflow
  void notification.offsetWidth;
  
  // Show notification
  notification.style.opacity = '1';
  
  // Remove notification after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}

// Submit
// Fungsi untuk menampilkan/menyembunyikan loading
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

document.getElementById("submitBtn").onclick=async ()=>{
  const submitBtn = document.getElementById("submitBtn");
  const originalBtnText = submitBtn.innerHTML;
  
  // Tampilkan loading di tombol
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span>Mengirim...';
  
  // Validasi form
  const nama=document.getElementById("nama").value;
  const email=document.getElementById("email").value;
  const wa=document.getElementById("wa").value;
  const rekomendasi=document.getElementById("rekomendasi").value;
  const pembayaran=document.querySelector("input[name='payment']:checked")?.value;
  const bukti=document.getElementById("bukti").files[0];

  if(!pembayaran){ 
    alert("Pilih metode pembayaran!"); 
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    return; 
  }
  
  if(!bukti){ 
    alert("Upload bukti pembayaran!");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    return; 
  }
  
  // Tampilkan loading overlay
  showLoading(true);

  // Upload ke Cloudinary
  const fd=new FormData();
  fd.append("file", bukti);
  fd.append("upload_preset", UPLOAD_PRESET);

  try{
    const res=await fetch(CLOUDINARY_URL,{method:"POST",body:fd});
    const data=await res.json();
    const buktiURL=data.secure_url;

    if(!buktiURL){ alert("Upload ke Cloudinary gagal!"); return; }

    function copyAccountNumber(accountNumber, button) {
        navigator.clipboard.writeText(accountNumber).then(function() {
            const originalTitle = button.title;
            button.title = 'Tersalin!';
            button.style.color = '#4CAF50';

            setTimeout(() => {
                button.title = originalTitle;
                button.style.color = '';
            }, 2000);
        });
    }

    // Generate kode pesanan
    const kodePesanan="ORDER-" + Date.now().toString(36).toUpperCase();

    // Submit ke Apps Script
    let formData=new FormData();
    formData.append("nama",nama);
    formData.append("email",email);
    formData.append("wa",wa);
    formData.append("jenisTiket",ticketName);
    formData.append("hargaTiket",ticketPriceOnly);
    formData.append("hargaMinuman",drinkPrice);
    formData.append("jumlahTiket",qty);
    formData.append("totalHarga",(ticketPriceOnly+drinkPrice)*qty);
    formData.append("metodePembayaran",pembayaran);
    formData.append("catatan",rekomendasi);
    formData.append("buktiPembayaran",buktiURL); // selalu terkirim
    formData.append("kodePesanan",kodePesanan);

    const resp=await fetch(SCRIPT_URL,{method:"POST",body:formData});
    const json=await resp.json();

    if(json.status==="success"){
      const modal=document.getElementById("modalConfirm");
      document.getElementById("kodePesanan").innerText=
      "Nama: "+nama+" dengan kode pesanan "+kodePesanan;
      modal.style.display="flex";
    } else { alert("❌ Gagal: "+json.message); }

  } catch(err){ 
    console.error("Error:", err);
    alert("Terjadi kesalahan: " + (err.message || "Tidak dapat memproses pembayaran")); 
  } finally {
    // Sembunyikan loading dan reset tombol
    showLoading(false);
    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Kirim Pesanan";
    }
  }
}

// Modal close
document.getElementById("modalClose").onclick=()=>location.reload();
window.onclick=(e)=>{if(e.target==document.getElementById("modalConfirm")) location.reload();};