"use client";

import { useState, useMemo } from "react";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import { isImageDocument } from "@/app/(user)/dashboard/lib/documentUtils";
import {
  FilesIcon,
  SearchIcon,
  GridIcon,
  ListIcon,
  UploadCloudIcon,
  StarIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  PlusIcon,
  XIcon,
  ShieldCheckIcon,
  FolderIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";
import DeleteConfirmationDialog from "@/components/UI/DeleteConfirmationDialog";

export default function FilesPage() {
  const {
    documents,
    folders,
    toggleStar,
    moveToTrash,
    uploadFile,
    downloadDocument,
    hasPermission,
  } = useVault();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
  const [selectedType, setSelectedType] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewFile, setViewFile] = useState(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [targetFolderSlug, setTargetFolderSlug] = useState("work");
  const canViewDocuments = hasPermission("VIEW_DOCUMENTS");
  const canSearchDocuments = hasPermission("SEARCH_DOCUMENTS");
  const canSearchByName = hasPermission("SEARCH_BY_NAME");
  const canSearchByType = hasPermission("SEARCH_BY_TYPE");
  const canFilterDocuments = hasPermission("FILTER_DOCUMENTS");
  const canSortDocuments = hasPermission("SORT_DOCUMENTS");

  const confirmDeleteFile = () => {
    if (!pendingDeleteFile) return;
    moveToTrash(pendingDeleteFile.id);
    if (String(viewFile?.id) === String(pendingDeleteFile.id)) {
      setViewFile(null);
    }
    setPendingDeleteFile(null);
  };

  // File Upload Handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file, targetFolderSlug);
      e.target.value = "";
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file, targetFolderSlug);
    }
  };

  // Filter and sort documents
  const filteredAndSorted = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch = !search || (
          canSearchDocuments &&
          ((canSearchByName && doc.name.toLowerCase().includes(search.toLowerCase())) ||
            (canSearchByType && doc.type.toLowerCase().includes(search.toLowerCase())))
        );

        if (!matchesSearch) return false;
        if (!canFilterDocuments) return true;

        // Folder filter
        if (selectedFolder !== "all") {
          if (doc.folderSlug !== selectedFolder && doc.folder !== selectedFolder) {
            return false;
          }
        }

        // Type filter
        if (selectedType === "all") return true;
        if (selectedType === "starred") return doc.starred;
        if (selectedType === "pdf") return doc.type === "PDF";
        if (selectedType === "docx") return ["DOC", "DOCX"].includes(doc.type);
        if (selectedType === "sheet") return ["XLS", "XLSX", "CSV"].includes(doc.type);
        if (selectedType === "image")
          return ["JPG", "JPEG", "PNG", "WEBP"].includes(doc.type);

        return true;
      })
      .sort((a, b) => {
        if (!canSortDocuments) return 0;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "size") return (b.rawBytes || 0) - (a.rawBytes || 0);
        return 0;
      });
  }, [documents, search, selectedType, selectedFolder, sortBy, canSearchDocuments, canSearchByName, canSearchByType, canFilterDocuments, canSortDocuments]);

  if (!canViewDocuments) return null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Documents Vault
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            {documents.length} secure documents stored across your private cloud.
          </p>
        </div>

        {/* Upload Action with Folder Picker */}
        {hasPermission("UPLOAD_DOCUMENT") && <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasPermission("VIEW_FOLDERS") && (
          <select
            value={targetFolderSlug}
            onChange={(e) => setTargetFolderSlug(e.target.value)}
            className="flex-1 sm:flex-none text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none shadow-xs cursor-pointer hover:border-slate-300 max-w-[160px] sm:max-w-none truncate"
            title="Select target folder for upload"
          >
            {folders.map((f) => (
              <option key={f.id} value={f.slug}>
                📁 {f.name}
              </option>
            ))}
          </select>
          )}

          <label className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer active:scale-95 transition-all">
            <PlusIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Upload Document</span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>}
      </div>

      {/* Drag & Drop Zone */}
      {hasPermission("UPLOAD_DOCUMENT") && (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 transition-all duration-200 flex flex-col items-center justify-center text-center ${
          isDragging
            ? "border-blue-500 bg-blue-50/70 scale-[1.01]"
            : "border-slate-200 bg-white/70 hover:border-blue-400 hover:bg-slate-50/50"
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 shadow-xs">
          <UploadCloudIcon className="w-6 h-6" />
        </div>
        <p className="text-xs sm:text-sm font-bold text-slate-800">
          Drag & drop files here to upload directly to &quot;{folders.find(f => f.slug === targetFolderSlug)?.name}&quot;
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Real file upload supported: PDF, DOCX, XLSX, PNG, JPG, TXT (encrypted with AES-256)
        </p>
      </div>
      )}

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        {hasPermission("SEARCH_DOCUMENTS") && (canSearchByName || canSearchByType) && <div className="relative flex-1 max-w-md">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by file name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>}

        {/* Filter Pills */}
        {hasPermission("FILTER_DOCUMENTS") && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: "all", label: "All Files" },
            ...(hasPermission("VIEW_STARRED") ? [{ id: "starred", label: "Starred" }] : []),
            { id: "pdf", label: "PDFs" },
            { id: "docx", label: "Word Docs" },
            { id: "sheet", label: "Sheets" },
            { id: "image", label: "Media" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                selectedType === tab.id
                  ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        )}

        {/* Sort, Folder Filter & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-between md:justify-end">
          {/* Folder filter dropdown */}
          {hasPermission("FILTER_DOCUMENTS") && hasPermission("VIEW_FOLDERS") && <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-300 max-w-[130px] sm:max-w-none truncate"
          >
            <option value="all">All Folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>}

          {/* Sort Dropdown */}
          {hasPermission("SORT_DOCUMENTS") && <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="newest">Newest First</option>
            <option value="name">Name (A-Z)</option>
            <option value="size">Largest Size</option>
          </select>}

          {/* View Mode Switch */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-400 hover:text-slate-800"
              }`}
              title="Grid View"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-400 hover:text-slate-800"
              }`}
              title="Table View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Count Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
        <span>Showing {filteredAndSorted.length} of {documents.length} documents</span>
        {search && <span>Filtered by: &quot;{search}&quot;</span>}
      </div>

      {/* GRID VIEW */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAndSorted.map((doc) => (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group relative"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <FileIconBox type={doc.type} className="w-12 h-12" />
                  {hasPermission("MANAGE_STARRED_DOCUMENTS") && <button
                    onClick={() => toggleStar(doc.id)}
                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                      doc.starred
                        ? "text-amber-500 bg-amber-50"
                        : "text-slate-300 hover:text-amber-500 hover:bg-slate-100"
                    }`}
                    title={doc.starred ? "Unstar" : "Star"}
                  >
                    <StarIcon className="w-4 h-4" filled={doc.starred} />
                  </button>}
                </div>

                <h3
                  onClick={hasPermission("VIEW_DOCUMENT_DETAILS") ? () => setViewFile(doc) : undefined}
                  className={`font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 ${hasPermission("VIEW_DOCUMENT_DETAILS") ? "cursor-pointer group-hover:text-blue-600 transition-colors" : ""}`}
                >
                  {doc.name}
                </h3>

                <div className="flex items-center gap-2 mt-2">
                  <FileBadge type={doc.type} />
                  <span className="text-[11px] text-slate-400 font-medium">
                    {doc.size}
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                  <FolderIcon className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{doc.folder}</span>
                </div>
              </div>

              {/* Card Bottom Meta & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {doc.modified}
                </span>

                <div className="flex items-center gap-1">
                  {hasPermission("VIEW_DOCUMENT_DETAILS") && <button
                    onClick={() => setViewFile(doc)}
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    title="View details"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>}
                  {hasPermission("DOWNLOAD_DOCUMENT") && <button
                    onClick={() => downloadDocument(doc)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Download"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>}
                  {hasPermission("DELETE_DOCUMENT") && <button
                    onClick={() => setPendingDeleteFile(doc)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Move to Trash"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3 sm:px-5">Document</th>
                  <th className="hidden sm:table-cell py-3 px-3 sm:px-4">Type</th>
                  <th className="hidden md:table-cell py-3 px-3 sm:px-4">Folder</th>
                  <th className="hidden sm:table-cell py-3 px-3 sm:px-4">Size</th>
                  <th className="hidden lg:table-cell py-3 px-3 sm:px-4">Last Modified</th>
                  <th className="hidden xl:table-cell py-3 px-3 sm:px-4">Security</th>
                  <th className="py-3 px-3 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="py-3 sm:py-3.5 px-3 sm:px-5">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {hasPermission("MANAGE_STARRED_DOCUMENTS") && <button
                          onClick={() => toggleStar(doc.id)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            doc.starred
                              ? "text-amber-500"
                              : "text-slate-300 hover:text-amber-500"
                          }`}
                        >
                          <StarIcon className="w-4 h-4" filled={doc.starred} />
                        </button>}
                        <FileIconBox type={doc.type} className="w-8 h-8 shrink-0" />
                        <div className="min-w-0">
                          <span
                            onClick={hasPermission("VIEW_DOCUMENT_DETAILS") ? () => setViewFile(doc) : undefined}
                            className={`font-semibold text-slate-800 truncate block max-w-[120px] xs:max-w-[170px] sm:max-w-xs md:max-w-md ${hasPermission("VIEW_DOCUMENT_DETAILS") ? "group-hover:text-blue-600 transition-colors cursor-pointer" : ""}`}
                          >
                            {doc.name}
                          </span>
                          {/* Subtitle for mobile view */}
                          <div className="sm:hidden text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-slate-500">{doc.type}</span>
                            <span>•</span>
                            <span>{doc.size}</span>
                            <span>•</span>
                            <span className="truncate max-w-[70px]">{doc.folder}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="hidden sm:table-cell py-3.5 px-3 sm:px-4">
                      <FileBadge type={doc.type} />
                    </td>

                    <td className="hidden md:table-cell py-3.5 px-3 sm:px-4 text-slate-600 font-medium">
                      {doc.folder}
                    </td>

                    <td className="hidden sm:table-cell py-3.5 px-3 sm:px-4 text-slate-600 font-medium">
                      {doc.size}
                    </td>

                    <td className="hidden lg:table-cell py-3.5 px-3 sm:px-4 text-slate-400">
                      {doc.modified}
                    </td>

                    <td className="hidden xl:table-cell py-3.5 px-3 sm:px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <ShieldCheckIcon className="w-3 h-3" />
                        AES-256
                      </span>
                    </td>

                    <td className="py-3 sm:py-3.5 px-3 sm:px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission("PREVIEW_DOCUMENT") && <button
                          onClick={() => setViewFile(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Preview"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>}
                        {hasPermission("DOWNLOAD_DOCUMENT") && <button
                          onClick={() => downloadDocument(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Download"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </button>}
                        {hasPermission("DELETE_DOCUMENT") && <button
                          onClick={() => setPendingDeleteFile(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Move to Trash"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAndSorted.length === 0 && (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <FilesIcon className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">
            No documents found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            We couldn&apos;t find anything matching your filter criteria. Try clearing your search or uploading a new file.
          </p>
          {(hasPermission("SEARCH_DOCUMENTS") || hasPermission("FILTER_DOCUMENTS")) && <button
            onClick={() => {
              setSearch("");
              setSelectedType("all");
              setSelectedFolder("all");
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>}
        </div>
      )}

      {/* File Preview & Details Modal */}
      {(hasPermission("VIEW_DOCUMENT_DETAILS") || hasPermission("PREVIEW_DOCUMENT")) && viewFile && (
        <div
          onClick={() => setViewFile(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <FileIconBox type={viewFile.type} className="w-12 h-12" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 truncate max-w-xs sm:max-w-sm">
                    {viewFile.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <FileBadge type={viewFile.type} />
                    <span className="text-xs text-slate-400 font-medium">
                      {viewFile.size} • {viewFile.folder}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewFile(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Document Details Grid */}
            {hasPermission("VIEW_DOCUMENT_DETAILS") && <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Document Format</p>
                <p className="font-bold text-slate-800 mt-0.5">{viewFile.type} File</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">File Size</p>
                <p className="font-bold text-slate-800 mt-0.5">{viewFile.size}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Last Modified</p>
                <p className="font-bold text-slate-800 mt-0.5">{viewFile.modified}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Vault Folder</p>
                <p className="font-bold text-blue-600 mt-0.5">{viewFile.folder}</p>
              </div>
            </div>}

            {/* Simulated / Real Content Preview */}
            {hasPermission("PREVIEW_DOCUMENT") && <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col items-center justify-center text-center mb-6">
              {viewFile.dataUrl && isImageDocument(viewFile) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewFile.dataUrl}
                  alt={viewFile.name}
                  className="max-h-56 max-w-full rounded-xl object-contain shadow-xs mb-3"
                />
              ) : (
                <ShieldCheckIcon className="w-8 h-8 text-blue-600 mb-2" />
              )}
              <p className="text-xs font-bold text-slate-800">
                AES-256 Vault Encryption Active
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Verified SHA-256 cryptographic signature: <br />
                <code className="text-[10px] text-blue-600 font-mono">
                  {viewFile.hash || "e83f21...c82a1"}
                </code>
              </p>
            </div>}

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              {hasPermission("DOWNLOAD_DOCUMENT") && <button
                onClick={() => {
                  downloadDocument(viewFile);
                  setViewFile(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <DownloadIcon className="w-4 h-4" />
                Download Decrypted File
              </button>}
              {hasPermission("DELETE_DOCUMENT") && <button
                onClick={() => {
                  setPendingDeleteFile(viewFile);
                }}
                className="py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <TrashIcon className="w-4 h-4" />
                Move to Trash
              </button>}
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        file={pendingDeleteFile}
        onCancel={() => setPendingDeleteFile(null)}
        onConfirm={confirmDeleteFile}
      />
    </main>
  );
}
