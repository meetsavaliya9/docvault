import React from "react";

export function getFileTypeConfig(type = "") {
  const normalized = type.toUpperCase().replace(".", "");

  if (["PDF"].includes(normalized)) {
    return {
      label: "PDF",
      bgBadge: "bg-rose-50 text-rose-700 border-rose-200",
      bgIcon: "bg-rose-100/80 text-rose-600",
      iconLetter: "PDF",
    };
  }

  if (["DOC", "DOCX", "WORD"].includes(normalized)) {
    return {
      label: "DOCX",
      bgBadge: "bg-blue-50 text-blue-700 border-blue-200",
      bgIcon: "bg-blue-100/80 text-blue-600",
      iconLetter: "DOC",
    };
  }

  if (["XLS", "XLSX", "CSV", "SHEET"].includes(normalized)) {
    return {
      label: "SHEET",
      bgBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      bgIcon: "bg-emerald-100/80 text-emerald-600",
      iconLetter: "XLS",
    };
  }

  if (["PPT", "PPTX", "PRESENTATION"].includes(normalized)) {
    return {
      label: "SLIDES",
      bgBadge: "bg-orange-50 text-orange-700 border-orange-200",
      bgIcon: "bg-orange-100/80 text-orange-600",
      iconLetter: "PPT",
    };
  }

  if (["JPG", "JPEG", "PNG", "GIF", "SVG", "WEBP"].includes(normalized)) {
    return {
      label: "IMAGE",
      bgBadge: "bg-purple-50 text-purple-700 border-purple-200",
      bgIcon: "bg-purple-100/80 text-purple-600",
      iconLetter: "IMG",
    };
  }

  if (["ZIP", "RAR", "TAR", "7Z"].includes(normalized)) {
    return {
      label: "ARCHIVE",
      bgBadge: "bg-amber-50 text-amber-700 border-amber-200",
      bgIcon: "bg-amber-100/80 text-amber-600",
      iconLetter: "ZIP",
    };
  }

  return {
    label: normalized || "FILE",
    bgBadge: "bg-slate-100 text-slate-700 border-slate-200",
    bgIcon: "bg-slate-100 text-slate-600",
    iconLetter: normalized ? normalized.slice(0, 3) : "DOC",
  };
}

export function FileBadge({ type }) {
  const config = getFileTypeConfig(type);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide border uppercase ${config.bgBadge}`}
    >
      {config.label}
    </span>
  );
}

export function FileIconBox({ type, className = "w-10 h-10" }) {
  const config = getFileTypeConfig(type);
  return (
    <div
      className={`${className} rounded-xl ${config.bgIcon} flex items-center justify-center font-bold text-xs tracking-wider transition-transform group-hover:scale-105 shadow-xs`}
    >
      {config.iconLetter}
    </div>
  );
}
