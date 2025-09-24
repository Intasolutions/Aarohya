// public/js/checkout.js
(function () {
  const form = document.getElementById('checkoutForm');
  const issues = document.getElementById('checkoutIssues');
  const placeBtn = document.getElementById('placeOrderBtn');

  if (!form) return;

  function showIssues(list) {
    if (!issues) return;
    if (!list || !list.length) { issues.classList.remove('show'); issues.innerHTML = ''; return; }
    issues.innerHTML = list.map(i => (
      `<div class="issue ${i.type || 'warn'}">
         <i class="fa fa-exclamation-circle"></i>
         <div>${i.msg}</div>
       </div>`
    )).join('');
    issues.classList.add('show');
    window.scrollTo({ top: issues.offsetTop - 80, behavior: 'smooth' });
  }

  function getPayload() {
    const fd = new FormData(form);
    const paymentMethod = (fd.get('paymentMethod') || 'cod').toLowerCase();
    const addrMode = fd.get('addrMode') || 'saved';

    const payload = {
      paymentMethod,
      note: (fd.get('note') || '').trim()
    };

    if (addrMode === 'new') {
      payload.addressBody = {
        addressType: fd.get('addressType'),
        name: fd.get('name'),
        apartment: fd.get('apartment'),
        building: fd.get('building'),
        street: fd.get('street'),
        landmark: fd.get('landmark') || '',
        city: fd.get('city'),
        state: fd.get('state'),
        country: fd.get('country') || 'India',
        zip: fd.get('zip'),
        phone: fd.get('phone'),
        altPhone: fd.get('altPhone') || ''
      };
    } else {
      payload.addressId = fd.get('addressId');
    }
    return payload;
  }

  async function placeCOD(payload) {
    const res = await fetch('/checkout/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not place order.');
    }
    window.location.href = data.redirectUrl || '/orders';
  }

  async function payWithRazorpay(payload) {
    // 1) Create DB order + Razorpay Order
    const res = await fetch('/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.razorpay) {
      throw new Error(data.message || 'Unable to create payment order. Please try again.');
    }
    const { keyId, orderId, amount, currency, orderDbId, name, description, prefill } = data.razorpay;

    if (typeof Razorpay === 'undefined') throw new Error('Payment library not loaded.');

    // 2) Open Razorpay
    const options = {
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name: name || 'Aarohya',
      description: description || 'Order Payment',
      prefill: prefill || {},
      handler: async function (resp) {
        // 3) Verify on server
        const verifyRes = await fetch('/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            orderDbId
          })
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyData.success) {
          window.location.href = '/order/failure' + (orderDbId ? ('?orderId=' + orderDbId) : '');
          return;
        }
        window.location.href = verifyData.redirectUrl || '/orders';
      },
      theme: { color: '#fbb710' }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      showIssues([{ type: 'error', msg: resp.error?.description || 'Payment failed. Please try again or choose COD.' }]);
      placeBtn?.classList.remove('loading');
      if (placeBtn) placeBtn.disabled = false;
    });
    rzp.open();
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showIssues([]);
    if (placeBtn) { placeBtn.classList.add('loading'); placeBtn.disabled = true; }

    try {
      const payload = getPayload();
      if (payload.paymentMethod === 'razorpay') {
        await payWithRazorpay(payload);
      } else {
        await placeCOD(payload);
      }
    } catch (err) {
      showIssues([{ type: 'error', msg: err.message || 'Something went wrong. Please try again.' }]);
      if (placeBtn) { placeBtn.classList.remove('loading'); placeBtn.disabled = false; }
    }
  });
})();
