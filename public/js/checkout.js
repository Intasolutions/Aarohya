(function(){
  const $ = window.jQuery;
  const issues = $('#checkoutIssues');
  const addrModeRadios = $('input[name="addrMode"]');
  const savedWrap = $('#savedAddrWrap');
  const newWrap = $('#newAddrWrap');
  const placeBtn = $('#placeOrderBtn');
  const form = $('#checkoutForm');

  function setMode(mode){
    const isNew = mode === 'new';
    savedWrap.toggle(!isNew);
    newWrap.toggle(isNew);
  }
  if (window.__forceNewAddress) {
    $('input[name="addrMode"][value="new"]').prop('checked', true);
    setMode('new');
  }

  addrModeRadios.on('change', function(){
    setMode(this.value);
  });

  savedWrap.on('change', 'input[name="addressId"]', function(){
    savedWrap.find('.addr-tile').removeClass('active');
    $(this).closest('.addr-tile').addClass('active');
  });

  function showIssues(list){
    if (!list || !list.length){ issues.removeClass('show').empty(); return; }
    const html = list.map(i => `
      <div class="issue ${i.type || 'warn'}">
        <i class="fa fa-exclamation-circle"></i>
        <div>${i.msg}</div>
      </div>`).join('');
    issues.html(html).addClass('show');
    window.scrollTo({ top: issues.offset().top - 80, behavior: 'smooth' });
  }

  function validate(){
    const errs = [];
    const useNew = $('input[name="addrMode"]:checked').val() === 'new';

    if (!useNew) {
      if (!$('input[name="addressId"]:checked').length) {
        errs.push({type:'warn', msg:'Please select a saved address or choose “New address”.'});
      }
    } else {
      const req = ['name','apartment','building','street','city','state','zip','phone'];
      req.forEach(id=>{
        if (!($(`[name="${id}"]`).val() || '').trim())
          errs.push({type:'error', msg:`${id[0].toUpperCase()+id.slice(1)} is required.`});
      });
      const zip = ($('[name="zip"]').val() || '').trim();
      if (zip && !/^\d{6}$/.test(zip)) errs.push({type:'error', msg:'PIN / ZIP must be 6 digits.'});
    }
    return errs;
  }

  async function createRazorpayOrder() {
    // Replace with your server call; return {orderId, amount, currency}
    // const res = await fetch('/api/payments/razorpay/order', { method:'POST' });
    // return res.json();
    return null;
  }

  form.on('submit', async function(e){
    e.preventDefault();
    showIssues([]);
    placeBtn.addClass('loading').attr('disabled', true);

    const errs = validate();
    if (errs.length){ showIssues(errs); placeBtn.removeClass('loading').attr('disabled', false); return; }

    const payload = $(this).serializeArray().reduce((acc, f)=> (acc[f.name]=f.value, acc), {});
    const method = (payload.paymentMethod || 'cod');

    try{
      if (method === 'razorpay' && window.Razorpay) {
        const rzOrder = await createRazorpayOrder();
        if (!rzOrder) throw new Error('Unable to create payment order. Please try again.');

        const options = {
          key: '<%= paymentKeyId || "" %>',
          order_id: rzOrder.orderId,
          name: 'Your Store',
          description: 'Order Payment',
          handler: async function (response) {
            await fetch('/checkout/place', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ form: payload, razorpay: response })});
            window.location.href = '/orders/thank-you';
          },
          theme: { color: '#fbb710' },
          prefill: { name: payload.name, contact: payload.phone }
        };
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp){
          showIssues([{type:'error', msg: resp.error?.description || 'Payment failed. Please try another method.'}]);
          placeBtn.removeClass('loading').attr('disabled', false);
        });
        rzp.open();
      } else {
        const res = await fetch('/checkout/place', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ form: payload })
        });
        if (!res.ok) throw new Error('Could not place order.');
        window.location.href = '/orders/thank-you';
      }
    } catch(err){
      showIssues([{type:'error', msg: err.message || 'Something went wrong. Please try again.'}]);
      placeBtn.removeClass('loading').attr('disabled', false);
    }
  });
})();
