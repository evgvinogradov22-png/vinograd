export function isR2Url(url) {
  if (!url) return false;
  if (url.startsWith("http")) {
    return url.includes("cloudflarestorage.com") || url.includes("r2.dev") || url.includes(".pub.r2.") ||
      (url.includes("/vinogradov/") && !url.includes("yandex") && !url.includes("google") && !url.includes("drive") && !url.includes("disk") && !url.includes("dropbox"));
  }
  return true;
}

export function cleanR2Url(url) {
  if (!url) return "";
  const parts = url.split("https://");
  if (parts.length <= 1) return url;
  return "https://" + parts[parts.length - 1];
}

export function r2key(url) {
  if (!url) return null;
  const clean = url.startsWith("http") ? cleanR2Url(url) : url;
  if (!isR2Url(clean)) return null;
  if (!clean.startsWith("http")) return clean;
  const m = clean.match(/\/vinogradov\/([^?#]+)/);
  return m ? "vinogradov/" + m[1] : null;
}

export function fileHref(url, key, name) {
  const cleanUrl = cleanR2Url(url || "");
  const k = key || r2key(cleanUrl);
  if (k) return "/api/download?key=" + encodeURIComponent(k) + "&name=" + encodeURIComponent(name || "file");
  return cleanUrl || "#";
}

export function triggerDownload(key, name) {
  if (!key) return;
  window.open("/api/download?key=" + encodeURIComponent(key) + "&name=" + encodeURIComponent(name || "file"), "_blank");
}

export async function xhrUpload(file, onProgress) {
  const presignRes = await fetch("/api/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type || "application/octet-stream" })
  });
  if (!presignRes.ok) throw new Error("Ошибка получения URL: " + presignRes.status);
  const { presignedUrl, url, key } = await presignRes.json();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) onProgress(Math.round(ev.loaded / ev.total * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ url, key });
      else reject(new Error("Ошибка загрузки: " + xhr.status));
    };
    xhr.onerror = () => reject(new Error("Ошибка сети"));
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}
