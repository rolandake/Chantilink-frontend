export const CHANTILINK_LOGO_URL = "/chantilink-logo.png";

export const fmtPdfMoney = (value, currency = "XOF") =>
  `${Number(value || 0).toLocaleString("fr-FR").replace(/\s/g, ".")} ${currency}`;

const loadImageDataUrl = async (src) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Image introuvable: ${src}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const drawRoundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

export const createChantilinkLogoCanvas = async (src = CHANTILINK_LOGO_URL) => {
  const imageDataUrl = await loadImageDataUrl(src);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#1f2937");
  ctx.fillStyle = gradient;
  drawRoundRect(ctx, 0, 0, canvas.width, canvas.height, 34);
  ctx.fill();

  ctx.fillStyle = "#f97316";
  drawRoundRect(ctx, 26, 26, 10, 208, 5);
  ctx.fill();

  const box = 204;
  const scale = Math.min(box / image.width, box / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, 54 + (box - width) / 2, 28 + (box - height) / 2, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 72px Arial";
  ctx.fillText("CHANTILINK", 306, 116);
  ctx.fillStyle = "#f97316";
  ctx.font = "700 24px Arial";
  ctx.fillText("Construction • Devis • Quantitatifs", 310, 162);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "400 22px Arial";
  ctx.fillText("Document généré automatiquement", 310, 202);

  return canvas.toDataURL("image/png", 1);
};

export const drawChantilinkHeader = (doc, {
  logoDataUrl,
  title,
  subtitle,
  dateText = `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
}) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageRight = pageW - 14;
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 74, 22);

  doc.setFillColor(249, 115, 22);
  doc.rect(pageRight, 10, 3, 22, "F");
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(title, pageRight - 4, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(dateText, pageRight - 4, 23, { align: "right" });
  doc.text(subtitle, pageRight - 4, 29, { align: "right" });
};

export const addPdfFooters = (doc, label = "ChantiLink - document de synthèse quantitatif et estimatif") => {
  const pages = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(label, 14, pageH - 8);
    doc.text(`Page ${page}/${pages}`, pageW - 14, pageH - 8, { align: "right" });
  }
};
