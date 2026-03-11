// Storage API wrapper - works with backend SQLite
const storage = {
  async get(key) {
    try {
      const res = await fetch(`/api/data/${encodeURIComponent(key)}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  async set(key, value) {
    try {
      const res = await fetch(`/api/data/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      return await res.json();
    } catch (e) {
      console.error('Storage set error:', e);
      return null;
    }
  },

  async delete(key) {
    try {
      const res = await fetch(`/api/data/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('Storage delete error:', e);
      return null;
    }
  }
};

export default storage;
