//Add products
const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("productImage");
const preview = document.getElementById("preview");

dropArea.addEventListener("click", () => fileInput.click());
dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("dragover");
});
dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragover"));
dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  fileInput.files = e.dataTransfer.files;
  handleFiles(fileInput.files);
});
fileInput.addEventListener("change", () => handleFiles(fileInput.files));

function handleFiles(files) {
  preview.innerHTML = "";
  [...files].forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.createElement("div");
      thumb.className = "preview-thumb";
      thumb.innerHTML = `
        <img src="${e.target.result}" alt="">
        <button type="button" class="remove-btn">&times;</button>
      `;
      thumb.querySelector(".remove-btn").onclick = () => {
        thumb.remove();
        removeFile(index);
      };
      preview.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

function removeFile(index) {
  const dt = new DataTransfer();
  [...fileInput.files].forEach((file, i) => {
    if (i !== index) dt.items.add(file);
  });
  fileInput.files = dt.files;
}


document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".product-scroll-wrapper").forEach(wrapper => {
    const scrollContainer = wrapper.querySelector(".product-scroll");
    const nextBtn = wrapper.querySelector(".next-btn");
    const prevBtn = wrapper.querySelector(".prev-btn");
    if (!scrollContainer || !nextBtn || !prevBtn) return;

    const step = () => Math.ceil(scrollContainer.clientWidth * 0.9);

    const canScroll = () => scrollContainer.scrollWidth > scrollContainer.clientWidth;
    const atStart = () => scrollContainer.scrollLeft <= 0;
    const atEnd = () =>
      scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 1;

    const updateDisabled = () => {
      if (!canScroll()) {
        nextBtn.disabled = true;
        prevBtn.disabled = true;
        return;
      }
      prevBtn.disabled = atStart();
      nextBtn.disabled = atEnd();
    };

    const smoothScrollBy = dx => {
      // Fallback if smooth not supported
      if (typeof scrollContainer.scrollBy === "function") {
        try {
          scrollContainer.scrollBy({ left: dx, behavior: "smooth" });
        } catch {
          scrollContainer.scrollLeft += dx;
        }
      } else {
        scrollContainer.scrollLeft += dx;
      }
    };

    nextBtn.addEventListener("click", e => {
      e.preventDefault();
      smoothScrollBy(step());
    });

    prevBtn.addEventListener("click", e => {
      e.preventDefault();
      smoothScrollBy(-step());
    });

    scrollContainer.addEventListener("scroll", updateDisabled);
    window.addEventListener("load", updateDisabled);
    window.addEventListener("resize", updateDisabled);

    updateDisabled();
  });
});




//header
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const overlay = document.getElementById('sidebar-overlay');

// Open sidebar
menuToggle.addEventListener('click', () => {
  sidebar.classList.add('show');
  overlay.classList.add('active');
});

// Close sidebar
sidebarClose.addEventListener('click', () => {
  sidebar.classList.remove('show');
  overlay.classList.remove('active');
});

// Close when clicking outside (overlay)
overlay.addEventListener('click', () => {
  sidebar.classList.remove('show');
  overlay.classList.remove('active');
});


const targetDate = new Date().getTime() + (24 * 60 * 60 * 1000); // +1 day

const countdown = setInterval(() => {
  let now = new Date().getTime();
  let distance = targetDate - now;

  if (distance < 0) {
    clearInterval(countdown);
    document.getElementById("countdown").innerHTML = "<h4>Offer Ended</h4>";
    return;
  }

  let days = Math.floor(distance / (1000 * 60 * 60 * 24));
  let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  let seconds = Math.floor((distance % (1000 * 60)) / 1000);

  document.getElementById("days").innerText = days.toString().padStart(2, '0');
  document.getElementById("hours").innerText = hours.toString().padStart(2, '0');
  document.getElementById("minutes").innerText = minutes.toString().padStart(2, '0');
  document.getElementById("seconds").innerText = seconds.toString().padStart(2, '0');
}, 1000);

