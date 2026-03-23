export const genId = () => Math.random().toString(36).slice(2, 9);

export const dim = (y, m) => new Date(y, m + 1, 0).getDate();
export const fd  = (y, m) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };

export const projOf   = (id, projects) => projects.find(p => p.id === id) || { label: "?", color: "#9ca3af" };
export const teamOf   = (id, team) => team.find(u => u.id === id);
export const stColor  = (sts, id) => sts.find(s => s.id === id)?.c || "#6b7280";

export function getTaskStore(type, stores) {
  const map = {
    pre:           [stores.preItems,      stores.setPreItems],
    prod:          [stores.prodItems,     stores.setProdItems],
    post_reels:    [stores.postReels,     stores.setPostReels],
    post_video:    [stores.postVideo,     stores.setPostVideo],
    post_carousel: [stores.postCarousels, stores.setPostCarousels],
    pub:           [stores.pubItems,      stores.setPubItems],
    admin:         [stores.adminItems,    stores.setAdminItems],
  };
  return map[type] || [[], () => {}];
}
