

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


// shop list

  // Sidebar toggle
  const sidebar = document.getElementById("shopSidebar");
  const openSidebarBtn = document.getElementById("fixedFilterBtn");
  const closeSidebarBtn = document.getElementById("closeSidebar");
  const mobileCloseSidebarBtn = document.getElementById("mobileCloseSidebar");

  openSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    openSidebarBtn.style.display = "none";
  });

  closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("active");
    openSidebarBtn.style.display = "flex";
  });

  mobileCloseSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("active");
    openSidebarBtn.style.display = "flex";
  });

  // Price slider logic
  const rangeInput = document.querySelectorAll(".range-input input");
  const priceInput = document.querySelectorAll(".price-input input");
  const range = document.querySelector(".slider .progress");
  let priceGap = 10;

  priceInput.forEach((input) => {
    input.addEventListener("input", (e) => {
      let minPrice = parseInt(priceInput[0].value);
      let maxPrice = parseInt(priceInput[1].value);

      if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max && minPrice >= rangeInput[0].min) {
        if (e.target.className === "input-min") {
          rangeInput[0].value = minPrice;
          range.style.left = ((minPrice / rangeInput[0].max) * 100) + "%";
        } else {
          rangeInput[1].value = maxPrice;
          range.style.right = 100 - (maxPrice / rangeInput[1].max) * 100 + "%";
        }
      }
    });
  });

  rangeInput.forEach((input) => {
    input.addEventListener("input", (e) => {
      let minVal = parseInt(rangeInput[0].value);
      let maxVal = parseInt(rangeInput[1].value);

      if (maxVal - minVal < priceGap) {
        if (e.target.className === "range-min") {
          rangeInput[0].value = maxVal - priceGap;
        } else {
          rangeInput[1].value = minVal + priceGap;
        }
      } else {
        priceInput[0].value = minVal;
        priceInput[1].value = maxVal;
        range.style.left = ((minVal / rangeInput[0].max) * 100) + "%";
        range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
      }
    });
  });
