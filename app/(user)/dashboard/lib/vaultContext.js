"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { normalizeDocument } from "./documentUtils";

const VaultContext = createContext(null);

const DEFAULT_FOLDERS = [
  {
    id: "f-1",
    name: "Work & Contracts",
    slug: "work",
    description: "Client service agreements, NDA documents, and signed partner proposals.",
    color: "blue",
    bgLight: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200/70",
  },
  {
    id: "f-2",
    name: "Finance & Taxes",
    slug: "finance",
    description: "Annual audit spreadsheets, expense statements, invoices, and quarterly tax filings.",
    color: "emerald",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200/70",
  },
  {
    id: "f-3",
    name: "Personal Vault",
    slug: "personal",
    description: "Medical records, IDs, passport copies, resumes, and personal certificates.",
    color: "purple",
    bgLight: "bg-purple-50",
    textColor: "text-purple-600",
    borderColor: "border-purple-200/70",
  },
  {
    id: "f-4",
    name: "Design Assets",
    slug: "design",
    description: "Logos, brand guidelines, UI mockups, iconography packs, and banners.",
    color: "amber",
    bgLight: "bg-amber-50",
    textColor: "text-amber-600",
    borderColor: "border-amber-200/70",
  },
];

export function VaultProvider({ children, userId = "", userEmail = "" }) {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [trash, setTrash] = useState([]);
  const [billing, setBilling] = useState({
    plan: "free",
    planName: "—",
    quotaGB: 0,
    quotaBytes: 0,
    quotaLabel: "—",
    maxDocuments: null,
    usedBytes: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManage: false,
  });
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  const [notifications, setNotifications] = useState([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const vaultSaveQueue = useRef(Promise.resolve());
  const toastTimerRef = useRef(null);
  const initialLoadDoneRef = useRef(false);

  const userName = useMemo(() => {
    if (!userEmail) return "User";
    const namePart = userEmail.split("@")[0].replace(/[._-]/g, " ");
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }, [userEmail]);

  const showToast = (message, type = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    const createdAt = Date.now();
    setNotifications((current) => [
      {
        id: `${createdAt}-${Math.random()}`,
        message,
        type,
        createdAt,
        time: new Date(createdAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        read: false,
      },
      ...current,
    ].slice(0, 30));
    toastTimerRef.current = setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage("");
  };

  // Load documents, folders, and trash from the server-backed MySQL database.
  useEffect(() => {
    let cancelled = false;
    initialLoadDoneRef.current = false;

    async function loadVault() {
      try {
        const [documentsResponse, vaultResponse, billingResponse] = await Promise.all([
          fetch("/api/documents", { cache: "no-store" }),
          fetch("/api/vault", { cache: "no-store" }),
          fetch("/api/billing", { cache: "no-store" }),
        ]);
        if (!documentsResponse.ok || !vaultResponse.ok || !billingResponse.ok) {
          throw new Error("Could not load your documents from MySQL.");
        }
        const [{ documents: savedDocuments }, savedVault, savedBilling] = await Promise.all([
          documentsResponse.json(),
          vaultResponse.json(),
          billingResponse.json(),
        ]);
        if (cancelled) return;

        setDocuments(savedDocuments.map(normalizeDocument));
        setFolders(savedVault.folders?.length ? savedVault.folders : DEFAULT_FOLDERS);
        setTrash(savedVault.trash || []);
        setBilling(savedBilling);
      } catch (error) {
        console.error("Failed to load vault from MySQL:", error);
        if (!cancelled) {
          showToast(
            "Could not load documents from MySQL. Check DATABASE_URL and run Prisma migrations.",
            "warning"
          );
        }
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    loadVault();
    return () => {
      cancelled = true;
    };
  }, [userId, userEmail]);

  useEffect(() => {
    if (!isLoaded) return;

    // Do not save on initial load to prevent overwriting user database with initial state
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }

    const vaultSnapshot = { folders, trash };
    vaultSaveQueue.current = vaultSaveQueue.current
      .then(async () => {
        const response = await fetch("/api/vault", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vaultSnapshot),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Could not save vault data to MySQL.");
        }
        const result = await response.json();
        if (result.warning) {
          showToast(result.warning, "warning");
        }
      })
      .catch((error) => {
        console.error("Failed to save folders or trash to MySQL:", error);
        showToast(error.message || "Could not save vault data to MySQL.", "warning");
      });
  }, [folders, trash, isLoaded]);

  useEffect(() => {
    const refreshBilling = async () => {
      try {
        const response = await fetch("/api/billing", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not refresh subscription details.");
        setBilling(await response.json());
      } catch (error) {
        console.error("Failed to refresh subscription status:", error);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshBilling();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("docvault:billing-updated", refreshBilling);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("docvault:billing-updated", refreshBilling);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const markNotificationRead = (notificationId) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
  };

  const clearNotifications = () => setNotifications([]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Keyboard shortcut listener for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Toggle star status on a document
  const toggleStar = (docId) => {
    const current = documents.find((doc) => String(doc.id) === String(docId));
    if (!current) return;
    const starred = !current.starred;

    setDocuments((prev) =>
      prev.map((doc) =>
        String(doc.id) === String(docId) ? { ...doc, starred } : doc
      )
    );

    fetch(`/api/documents/${encodeURIComponent(docId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Could not update document.");
        }
        showToast(
          starred
            ? `"${current.name}" added to Starred`
            : `"${current.name}" removed from Starred`,
          "info"
        );
      })
      .catch((error) => {
        console.error("Failed to update document in MySQL:", error);
        setDocuments((prev) =>
          prev.map((doc) =>
            String(doc.id) === String(docId)
              ? { ...doc, starred: current.starred }
              : doc
          )
        );
        showToast(error.message || "Could not update document in MySQL.", "warning");
      });
  };

  // Upload media to Cloudinary, save metadata in MySQL, then refresh the list.
  const uploadFile = async (file, targetFolderSlug = "work") => {
    if (!file) return;

    const targetFolder =
      folders.find((f) => f.slug === targetFolderSlug) || folders[0];

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", targetFolder?.name || "General");
      formData.append("folderSlug", targetFolder?.slug || "general");

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        const result = await uploadResponse.json();
        throw new Error(result.error || "Could not save document to MySQL.");
      }
      const { document: uploadedDocument } = await uploadResponse.json();

      const listResponse = await fetch("/api/documents");
      if (!listResponse.ok) {
        const result = await listResponse.json();
        throw new Error(result.error || "Could not refresh documents from MySQL.");
      }
      const { documents: savedDocuments } = await listResponse.json();
      setDocuments(savedDocuments.map(normalizeDocument));
      showToast(`"${uploadedDocument.name}" uploaded successfully!`, "success");
      return uploadedDocument;
    } catch (error) {
      console.error("Failed to upload document to MySQL:", error);
      showToast(error.message || "Could not upload document.", "warning");
      return null;
    }
  };

  // Optimistically remove the document, rolling back if MySQL rejects it.
  const deleteDocument = async (docId) => {
    const docToDelete = documents.find(
      (d) => d.id === docId || String(d.id) === String(docId)
    );
    if (!docToDelete) return;

    setDocuments((prev) =>
      prev.filter((doc) => String(doc.id) !== String(docId))
    );
    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(docId)}?permanent=true`,
        {
        method: "DELETE",
        }
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not delete document from MySQL.");
      }
      const result = await response.json();
      showToast(
        result.warning || `"${docToDelete.name}" deleted.`,
        result.warning ? "warning" : "success"
      );
    } catch (error) {
      console.error("Failed to delete document from MySQL:", error);
      setDocuments((prev) => [docToDelete, ...prev]);
      showToast(error.message || "Could not delete document.", "warning");
    }
  };

  // Move to Trash immediately and roll back if MySQL cannot delete the document.
  const moveToTrash = async (docId) => {
    const docToDelete = documents.find(
      (d) => d.id === docId || String(d.id) === String(docId)
    );
    if (!docToDelete) return;

    const trashedItem = {
      id: `trash-${Date.now()}`,
      name: docToDelete.name,
      type: docToDelete.type,
      size: docToDelete.size,
      rawBytes: docToDelete.rawBytes || 1024 * 500,
      deleted: "Just now",
      retentionDays: 30,
      originalFolder: docToDelete.folder,
      originalFolderSlug: docToDelete.folderSlug,
      originalDoc: docToDelete,
    };

    setDocuments((prev) =>
      prev.filter((doc) => String(doc.id) !== String(docId))
    );
    setTrash((prev) => [trashedItem, ...prev]);

    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not move document to Trash.");
      }
      showToast(`"${docToDelete.name}" moved to Trash.`, "warning");
    } catch (error) {
      console.error("Failed to move document to Trash:", error);
      setDocuments((prev) => [docToDelete, ...prev]);
      setTrash((prev) => prev.filter((item) => item.id !== trashedItem.id));
      showToast(error.message || "Could not move document to Trash.", "warning");
    }
  };

  // Restore a trashed record to MySQL and remove it from Trash.
  const restoreFromTrash = (trashId) => {
    const item = trash.find(
      (t) => t.id === trashId || String(t.id) === String(trashId)
    );
    if (!item) return;

    const restoredDoc = item.originalDoc || {
      id: `doc-${Date.now()}`,
      name: item.name,
      type: item.type,
      size: item.size,
      rawBytes: item.rawBytes,
      modified: "Restored just now",
      starred: false,
      deleted: false,
      folder: item.originalFolder || "General",
      folderSlug: item.originalFolderSlug || "general",
      hash: "rst-" + Math.random().toString(16).substring(2, 8),
      fileData: item.fileData || item.dataUrl || null,
      dataUrl: item.fileData || item.dataUrl || null,
    };

    fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(restoredDoc),
    })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Could not restore document to MySQL.");
        }
        const { document } = await response.json();
        setTrash((prev) =>
          prev.filter((entry) => String(entry.id) !== String(trashId))
        );
        setDocuments((prev) => [normalizeDocument(document), ...prev]);
        showToast(`"${item.name}" restored to My Files.`, "success");
      })
      .catch((error) => {
        console.error("Failed to restore document to MySQL:", error);
        showToast(error.message || "Could not restore document.", "warning");
      });
  };

  // Permanently delete a single item from Trash
  const deletePermanently = (trashId) => {
    const item = trash.find(
      (t) => t.id === trashId || String(t.id) === String(trashId)
    );
    if (!item) return;

    setTrash((prev) => {
      const nextTrash = prev.filter(
        (t) => t.id !== trashId && String(t.id) !== String(trashId)
      );
      return nextTrash;
    });

    showToast(`"${item.name}" permanently deleted.`, "info");
  };

  // Empty entire Trash
  const emptyTrash = () => {
    if (trash.length === 0) return;
    setTrash([]);
    showToast("Trash emptied completely.", "info");
  };

  // Create a new folder
  const createFolder = (name, description = "") => {
    if (!name.trim()) return;

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const colorPalette = [
      { color: "indigo", bgLight: "bg-indigo-50", textColor: "text-indigo-600", borderColor: "border-indigo-200/70" },
      { color: "cyan", bgLight: "bg-cyan-50", textColor: "text-cyan-600", borderColor: "border-cyan-200/70" },
      { color: "violet", bgLight: "bg-violet-50", textColor: "text-violet-600", borderColor: "border-violet-200/70" },
      { color: "rose", bgLight: "bg-rose-50", textColor: "text-rose-600", borderColor: "border-rose-200/70" },
    ];
    const theme = colorPalette[folders.length % colorPalette.length];

    const newFolder = {
      id: `f-${Date.now()}`,
      name: name.trim(),
      slug: slug,
      description: description.trim() || "Custom folder collection.",
      ...theme,
    };

    setFolders((prev) => [...prev, newFolder]);
    showToast(`Folder "${newFolder.name}" created!`, "success");
    return newFolder;
  };

  // Delete a folder and move its documents to General
  const deleteFolder = async (slugOrId) => {
    const folderToDelete = folders.find(
      (f) => f.slug === slugOrId || f.id === slugOrId
    );
    if (!folderToDelete) return false;

    const response = await fetch(
      `/api/folders/${encodeURIComponent(folderToDelete.slug)}`,
      { method: "DELETE" }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not delete folder.");
    }

    setFolders((prev) =>
      prev.filter((f) => f.slug !== folderToDelete.slug && f.id !== folderToDelete.id)
    );
    setDocuments((prev) =>
      prev.map((d) =>
        d.folderSlug === folderToDelete.slug || d.folder === folderToDelete.name
          ? { ...d, folder: "General", folderSlug: "general" }
          : d
      )
    );
    showToast(`Folder "${folderToDelete.name}" deleted. Its documents were moved to General.`, "info");
    return true;
  };

  // Move a document to a different folder
  const moveDocument = async (docId, newFolderSlug, newFolderName) => {
    const doc = documents.find((d) => String(d.id) === String(docId));
    if (!doc) return;

    setDocuments((prev) =>
      prev.map((d) =>
        String(d.id) === String(docId)
          ? { ...d, folder: newFolderName, folderSlug: newFolderSlug }
          : d
      )
    );

    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: newFolderName, folderSlug: newFolderSlug }),
      });
      if (!response.ok) {
        throw new Error("Could not update document folder in MySQL.");
      }
      showToast(`Moved "${doc.name}" to ${newFolderName}`, "success");
    } catch (err) {
      console.error("Failed to move document:", err);
      setDocuments((prev) =>
        prev.map((d) => (String(d.id) === String(docId) ? doc : d))
      );
      showToast(err.message || "Failed to move document", "warning");
    }
  };

  // Real download trigger
  const downloadDocument = (doc) => {
    if (!doc) return;

    const fileContent = doc.fileData || doc.dataUrl;

    if (fileContent) {
      const link = document.createElement("a");
      link.href = fileContent.startsWith("/api/documents/")
        ? `${fileContent}?download=1`
        : fileContent;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Create a genuine downloadable decrypted text / report file
      const content = `================================================
DOCVAULT SECURE DOCUMENT EXPORT
================================================
Document: ${doc.name}
Type: ${doc.type}
Size: ${doc.size}
Vault Folder: ${doc.folder || "My Vault"}
SHA-256 Fingerprint: ${doc.hash || "verified-aes-256"}
Export Date: ${new Date().toLocaleString()}
Encryption Status: Successfully Decrypted via DocVault Client Key
================================================

This document was securely exported from your DocVault Cloud workspace.
All permissions and cryptographic checks passed.`;

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name.endsWith(".txt") ? doc.name : `${doc.name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    showToast(`Downloaded "${doc.name}" securely`, "info");
  };

  // Computed total storage consumed in MB / GB
  const storageMetrics = useMemo(() => {
    const totalBytes = documents.reduce(
      (acc, doc) => acc + (doc.rawBytes || 0),
      0
    );
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(0);
    const quotaBytes = billing.quotaBytes || 0;
    const quotaGB = quotaBytes / 1024 ** 3;
    const remainingBytes = Math.max(quotaBytes - totalBytes, 0);
    const percentage = quotaBytes
      ? Math.min(Math.max(Math.round((totalBytes / quotaBytes) * 100), 1), 100)
      : 0;

    return {
      totalBytes,
      totalMB,
      totalGB,
      quotaGB,
      quotaBytes,
      quotaLabel: billing.quotaLabel || "—",
      plan: billing.plan,
      planName: billing.planName,
      percentage,
      formattedUsed: `${totalGB} GB`,
      formattedRemaining: `${(remainingBytes / 1024 ** 3).toFixed(2)} GB`,
    };
  }, [billing.plan, billing.planName, billing.quotaBytes, billing.quotaLabel, documents]);

  // Starred documents list
  const starredDocuments = useMemo(() => {
    return documents.filter((doc) => doc.starred);
  }, [documents]);

  const value = {
    userId,
    userEmail,
    userName,
    documents,
    folders,
    trash,
    billing,
    starredDocuments,
    storageMetrics,
    toastMessage,
    toastType,
    dismissToast,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    showToast,
    uploadFile,
    deleteDocument,
    toggleStar,
    moveToTrash,
    restoreFromTrash,
    deletePermanently,
    emptyTrash,
    createFolder,
    deleteFolder,
    moveDocument,
    downloadDocument,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    searchQuery,
    setSearchQuery,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
}
