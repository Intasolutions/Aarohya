// Copy referral
document.getElementById('copyRef')?.addEventListener('click', () => {
  const text = document.getElementById('ref').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyRef');
    const old = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
    setTimeout(() => (btn.innerHTML = old), 1200);
  });
});

// Avatar preview
document.getElementById('avatar')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.querySelector('.pf-avatar img').src = url;
});
