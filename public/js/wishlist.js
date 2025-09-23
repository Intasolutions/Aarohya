// Sorting (client-side, non-destructive)
(function(){
  const grid = document.getElementById('wlGrid');
  const sortSel = document.getElementById('wlSort');
  if(!grid || !sortSel) return;
  sortSel.addEventListener('change', () => {
    const cards = [...grid.children];
    const mode = sortSel.value;
    const sorted = cards.sort((a,b) => {
      const pa = +a.dataset.price || 0, pb = +b.dataset.price || 0;
      const na = (a.dataset.name||'').toLowerCase(), nb = (b.dataset.name||'').toLowerCase();
      if(mode==='priceLow') return pa - pb;
      if(mode==='priceHigh') return pb - pa;
      if(mode==='name') return na.localeCompare(nb);
      return 0; // newest: keep server order
    });
    sorted.forEach(el => grid.appendChild(el));
  });
})();

// Minimal toast
function toast(msg, ok=true){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position='fixed'; t.style.bottom='24px'; t.style.left='50%'; t.style.transform='translateX(-50%)';
  t.style.padding='12px 16px'; t.style.borderRadius='12px';
  t.style.background = ok ? 'linear-gradient(135deg,#2ecc71,#7dffa5)' : 'linear-gradient(135deg,#ff6b6b,#ff9b9b)';
  t.style.color='#0b0e12'; t.style.fontWeight='700'; t.style.boxShadow='0 10px 30px rgba(0,0,0,.35)';
  t.style.zIndex=9999; t.style.backdropFilter='blur(6px)';
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 1800);
}

// Remove from wishlist
async function removeItem(id, card){
  try{
    const res = await fetch('/wishlist/remove/' + id, { method:'POST', headers:{'X-Requested-With':'fetch'} });
    const data = await res.json();
    if(data.success){
      card.remove();
      toast('Removed from wishlist');
      // If grid is empty, reload to show empty state/pager update
      const grid = document.getElementById('wlGrid');
      if(grid && grid.children.length===0) location.reload();
    }else{
      toast(data.message || 'Failed to remove', false);
    }
  }catch(e){ toast('Error removing item', false); }
}

// Move to cart then remove from wishlist
async function moveToCart(id, card){
  try{
    // Adjust this endpoint to your cart route if different:
    const add = await fetch('/cart/add/' + id, { method:'POST', headers:{'X-Requested-With':'fetch'} });
    const addData = await add.json();
    if(!add.ok || addData.success===false) return toast(addData.message || 'Could not add to cart', false);

    // Now remove from wishlist
    await removeItem(id, card);
    toast('Moved to cart');
  }catch(e){ toast('Error moving to cart', false); }
}

// Bind buttons
document.addEventListener('click', (e)=>{
  const rmBtn = e.target.closest('.js-remove');
  const mvBtn = e.target.closest('.js-move-cart');
  if(rmBtn){
    const card = rmBtn.closest('.wl-card');
    const id = rmBtn.dataset.id;
    removeItem(id, card);
  }
  if(mvBtn){
    const card = mvBtn.closest('.wl-card');
    const id = mvBtn.dataset.id;
    moveToCart(id, card);
  }
});
