/**
 * API Client com suporte integrado a Cookies HttpOnly, FormData e Header CSRF Token
 */

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export const api = {
  // Realiza requisições com headers automáticos (JSON, CSRF e Cookies)
  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    
    // Para FormData, o browser define o Content-Type com o boundary correto automaticamente
    const defaultHeaders = isFormData 
      ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } 
      : { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };

    const config = {
      credentials: 'include', // Envia cookies HttpOnly
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      cache: 'no-store', // Garante que o fetch não use cache do navegador
      ...options
    };

    // Para requisições mutantes, anexa o token CSRF extraído do cookie csrf_token ou localStorage
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (config.method && mutatingMethods.includes(config.method.toUpperCase())) {
      const csrfToken = getCookie('csrf_token') || localStorage.getItem('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    if (config.body && typeof config.body === 'object' && !isFormData) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      
      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        if (!response.ok) {
          const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          throw new Error(`Erro no servidor (${response.status}): ${cleanText.substring(0, 120) || 'Resposta inválida'}`);
        }
        data = { message: text };
      }

      if (!response.ok) {
        // Sessão expirada ou não autenticada
        if (response.status === 401 && !window.location.pathname.includes('login.html')) {
          localStorage.removeItem('user_data');
          window.location.href = '/login.html';
        }
        throw new Error(data.error || data.message || `Erro na requisição (${response.status})`);
      }

      return data;
    } catch (error) {
      console.error(`❌ [API Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
