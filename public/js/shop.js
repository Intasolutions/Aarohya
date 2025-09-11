

// Wait until DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const mainImage = document.getElementById("mainImage");
  const thumbs = document.querySelectorAll(".thumbnails img");

  if (mainImage && thumbs.length) {
    thumbs.forEach(img => {
      img.addEventListener("click", () => {
        mainImage.src = img.src; // change main image
        thumbs.forEach(t => t.classList.remove("active"));
        img.classList.add("active");
      });
    });
  }



  // ======================
  // Tabs switch
  // ======================
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");
  if (tabs.length && contents.length) {
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        contents.forEach(c => c.classList.add("hidden"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.target).classList.remove("hidden");
      });
    });
  }

  // ======================
  // Quantity buttons
  // ======================
  const qtyInput = document.getElementById("qty");
  const incBtn = document.getElementById("increaseBtn");
  const decBtn = document.getElementById("decreaseBtn");

  if (qtyInput && incBtn && decBtn) {
    incBtn.addEventListener("click", () => {
      qtyInput.value = parseInt(qtyInput.value) + 1;
    });
    decBtn.addEventListener("click", () => {
      if (qtyInput.value > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
    });
  }
});

