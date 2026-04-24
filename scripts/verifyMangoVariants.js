// Quick verify: show variants of first 2 mango products
const axios = require('axios');
async function verify() {
  const login = await axios.post('http://13.127.15.87:8080/api/admin-auth/login', {
    email: 'admin@epi.com', password: '@Saoirse123',
  });
  const token = login.data.data.accessToken;
  const api = axios.create({
    baseURL: 'http://13.127.15.87:8080/api',
    headers: { Authorization: 'Bearer ' + token },
  });

  const res = await api.get('/products', { params: { limit: 20, page: 1 } });
  const items = res.data.data || res.data.products || [];
  const mangoes = items.filter(function(p) {
    return p.category && p.category.mainCategoryName === 'Mango' ||
           p.name && p.name.toLowerCase().indexOf('mango') !== -1;
  }).slice(0, 2);

  mangoes.forEach(function(product) {
    console.log('\n── ' + product.name + ' ──');
    console.log('hasVariants:', product.hasVariants, '| variants:', product.variants ? product.variants.length : 0);
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(function(v, i) {
        var attrs = v.attributes ? v.attributes.map(function(a) { return a.name + ':' + a.value; }).join(' | ') : '(none)';
        console.log('  V' + (i + 1) + ' ₹' + v.price + '/₹' + v.salePrice + ' stock:' + v.stock + ' | ' + attrs);
      });
    }
  });
}
verify().catch(function(e) { console.error(e.response ? e.response.data : e.message); });
