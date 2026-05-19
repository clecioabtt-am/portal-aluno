function formatarNotaBR(v){
  if(v===null||v===undefined||v==='') return '-';
  const n = Number(v);
  if(Number.isNaN(n)) return v;
  return n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});}

const menuBtn = document.querySelector('.menuBtn');
const nav = document.querySelector('.nav');
menuBtn?.addEventListener('click', () => nav.classList.toggle('open'));
document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
const reveal = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
