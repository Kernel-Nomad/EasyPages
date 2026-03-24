const params = new URLSearchParams(window.location.search);
const code = params.get('error');
if (code) {
  const el = document.getElementById('error');
  if (el) {
    if (code === 'rate') {
      el.textContent =
        'Demasiados intentos de inicio de sesión. Espere unos minutos e inténtelo de nuevo.';
    }
    el.classList.remove('hidden');
  }
}
