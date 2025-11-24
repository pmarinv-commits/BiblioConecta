(function bootstrapSessionManager(){
  const ROLE_PORTALS = {
    alumno: '/portal_alumno_static.html'
  };
  const STORAGE_KEYS = {
    token: 'token',
    profile: 'sessionUser',
    role: 'sessionRole'
  };

  function decodeRoleFromToken(token){
    if(!token || typeof token !== 'string') return null;
    try {
      const base64Url = token.split('.')[1];
      if(!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const payload = JSON.parse(atob(padded));
      return payload?.role || null;
    } catch (error) {
      console.warn('No se pudo decodificar el token JWT', error);
      return null;
    }
  }

  function resolvePortal(role){
    if(role && ROLE_PORTALS[role]) return ROLE_PORTALS[role];
    return ROLE_PORTALS.alumno;
  }

  function persistSession(token, user){
    if(token) localStorage.setItem(STORAGE_KEYS.token, token);
    if(user){
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(user));
      if(user.role) localStorage.setItem(STORAGE_KEYS.role, user.role);
    }
  }

  function completeLogin(payload = {}){
    const token = payload.token;
    if(!token) return;
    persistSession(token, payload.user);
    const roleFromPayload = payload.user?.role || decodeRoleFromToken(token);
    if(roleFromPayload) localStorage.setItem(STORAGE_KEYS.role, roleFromPayload);
    window.location.href = resolvePortal(roleFromPayload);
  }

  window.biblioconectaSession = {
    completeLogin,
    decodeRoleFromToken,
    resolvePortal
  };
})();

(function initLandingHandlers(){
  const visitorCatalog = document.getElementById('visitorCatalog');
  if (visitorCatalog) visitorCatalog.addEventListener('click', ()=> window.location.href='/catalogo.html');

  const ctaCatalog = document.getElementById('ctaCatalog');
  if (ctaCatalog) ctaCatalog.addEventListener('click', ()=> window.location.href='/catalogo.html');

  const loginForm = document.getElementById('heroLoginForm');
  const feedback = document.getElementById('loginFeedback');
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (feedback) feedback.classList.add('d-none');
      const email = document.getElementById('heroEmail').value.trim();
      const password = document.getElementById('heroPassword').value;
      if (!email || !password) {
        if (feedback) {
          feedback.textContent = 'Complete ambos campos.';
          feedback.classList.remove('d-none');
        } else {
          alert('Complete ambos campos.');
        }
        return;
      }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error('Credenciales inválidas');
        const payload = await res.json();
        if(window.biblioconectaSession?.completeLogin){
          window.biblioconectaSession.completeLogin(payload);
        } else {
          localStorage.setItem('token', payload.token);
          window.location.href = '/portal_alumno_static.html';
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = 'Correo o contraseña inválidos.';
          feedback.classList.remove('d-none');
        } else {
          alert('Correo o contraseña inválidos.');
        }
      }
    });
  }

  const enterAdmin = document.getElementById('enterAdmin');
  if (enterAdmin) enterAdmin.addEventListener('click', ()=> window.location.href='/admin/login');
})();

(function initCatalogRequestModal(){
  const modalEl = document.getElementById('physicalRequestModal');
  if (!modalEl) return;
  const form = document.getElementById('requestModalForm');
  const alertBox = document.getElementById('requestModalAlert');
  const submitBtn = document.getElementById('requestSubmitBtn');
  const bookTitleEl = document.getElementById('requestBookTitle');
  const bookTypeEl = document.getElementById('requestBookType');
  const bookIdInput = document.getElementById('requestBookId');
  const nameInput = document.getElementById('requesterNameInput');
  const emailInput = document.getElementById('requesterEmailInput');
  const modalInstance = window.bootstrap ? new bootstrap.Modal(modalEl) : null;

  function showError(message){
    if(!alertBox) return;
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
  }

  window.catalogRequestUI = {
    open(book){
      if (!bookIdInput) return;
      form?.reset();
      if(alertBox) alertBox.classList.add('d-none');
      bookTitleEl.textContent = book.titulo || 'Libro seleccionado';
      bookTypeEl.textContent = `ID #${book.id} · ${book.tipo || 'físico'}`;
      bookIdInput.value = book.id;
      if(modalInstance) modalInstance.show();
    }
  };

  form?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    if(alertBox) alertBox.classList.add('d-none');
    if(submitBtn) submitBtn.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if(!res.ok || !body.ok){
        throw new Error(body.error || 'No se pudo registrar la solicitud');
      }
      if(modalInstance) modalInstance.hide();
      form.reset();
      alert('Solicitud enviada. Te contactaremos pronto.');
    } catch (error) {
      showError(error.message || 'Error desconocido');
    } finally {
      if(submitBtn) submitBtn.disabled = false;
    }
  });
})();
