"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import {
  SearchIcon,
  XIcon,
  FilesIcon,
  FolderIcon,
  StarIcon,
  TrashIcon,
  DashboardIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";

export default function CommandPalette() {
  const router = useRouter();
  const {
    documents,
    folders,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    searchQuery,
    setSearchQuery,
  } = useVault();

  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      const timer = setTimeout(() => {
        setQuery(searchQuery || "");
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCommandPaletteOpen, searchQuery]);

  if (!isCommandPaletteOpen) return null;

  const filteredDocs = query.trim()
    ? documents.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.type.toLowerCase().includes(query.toLowerCase()) ||
          d.folder.toLowerCase().includes(query.toLowerCase())
      )
    : documents.slice(0, 5);

  const filteredFolders = query.trim()
    ? folders.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.description.toLowerCase().includes(query.toLowerCase())
      )
    : folders.slice(0, 4);

  const handleSelectDoc = (doc) => {
    setIsCommandPaletteOpen(false);
    router.push("/dashboard/files");
  };

  const handleSelectFolder = (folder) => {
    setIsCommandPaletteOpen(false);
    router.push(`/dashboard/folders/${folder.slug}`);
  };

  return (
    <div
      onClick={() => setIsCommandPaletteOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <SearchIcon className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a file name, type (PDF, DOCX), or folder..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 flex-1">
          {/* Documents Section */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span>Documents ({filteredDocs.length})</span>
              <span className="text-[10px] text-blue-600 font-semibold">Instant Vault Search</span>
            </div>

            <div className="space-y-1 mt-1">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIconBox type={doc.type} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate">
                        {doc.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {doc.folder} • {doc.size}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <FileBadge type={doc.type} />
                    <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600" />
                  </div>
                </div>
              ))}

              {filteredDocs.length === 0 && (
                <p className="px-3 py-4 text-xs text-slate-400 text-center">
                  No documents found matching &quot;{query}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Folders ({filteredFolders.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group border border-slate-100"
                  >
                    <div className={`w-8 h-8 rounded-lg ${folder.bgLight} ${folder.textColor} flex items-center justify-center font-bold shrink-0`}>
                      <FolderIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate">
                        {folder.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {folder.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Page Jump Navigation */}
          <div className="pt-2 border-t border-slate-100">
            <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Quick Shortcuts
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {[
                { name: "Dashboard", href: "/dashboard", icon: DashboardIcon },
                { name: "All Files", href: "/dashboard/files", icon: FilesIcon },
                { name: "Folders", href: "/dashboard/folders", icon: FolderIcon },
                { name: "Starred", href: "/dashboard/starred", icon: StarIcon },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsCommandPaletteOpen(false)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Search documents, types, or shortcuts</span>
          <span className="font-semibold text-slate-600">Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
}
