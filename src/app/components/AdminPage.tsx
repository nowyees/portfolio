import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthChange, isAdmin, adminLogout } from '../../lib/authService';
import {
    getPortfolioByCategory,
    updateProject,
    addProject,
    deleteProject,
    type Project,
    type CategoryData,
    type MediaItem,
} from '../../lib/portfolioService';
import { uploadImage, isVideoFile, isVideoUrl } from '../../lib/storageService';
import type { User } from 'firebase/auth';

const CATEGORIES = ['fashion', 'product', 'space', 'speculative'];
const ASPECT_OPTIONS = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-[4/3]', 'aspect-[16/10]'];

export default function AdminPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [activeCategory, setActiveCategory] = useState('fashion');
    const [data, setData] = useState<CategoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Auth 체크
    useEffect(() => {
        const unsubscribe = onAuthChange((u) => {
            setUser(u);
            setAuthChecked(true);
            if (!u || !isAdmin(u)) {
                navigate('/');
            }
        });
        return unsubscribe;
    }, [navigate]);

    // 카테고리 데이터 로드
    useEffect(() => {
        if (!authChecked || !user) return;
        loadData();
    }, [activeCategory, authChecked, user]);

    const loadData = async () => {
        setLoading(true);
        const result = await getPortfolioByCategory(activeCategory);
        setData(result);
        setLoading(false);
    };

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 4000);
    };

    const handleThumbnailUpload = async (file: File) => {
        setUploadingImage(true);
        try {
            const url = await uploadImage(file);
            if (editingProject) {
                setEditingProject({ ...editingProject, image: url });
            }
            showNotification('썸네일 업로드 완료');
        } catch (err) {
            showNotification('썸네일 업로드 실패');
        }
        setUploadingImage(false);
    };

    const handleMediaUpload = async (files: FileList) => {
        if (!editingProject) return;
        setUploadingImage(true);
        const newMedia: MediaItem[] = [...(editingProject.media || [])];

        for (const file of Array.from(files)) {
            try {
                const url = await uploadImage(file);
                const type = isVideoFile(file) ? 'video' : 'image';
                newMedia.push({ url, type });
            } catch (err) {
                showNotification(`"${file.name}" 업로드 실패`);
            }
        }

        setEditingProject({ ...editingProject, media: newMedia });
        showNotification(`${files.length}개 미디어 업로드 완료`);
        setUploadingImage(false);
    };

    const removeMedia = (index: number) => {
        if (!editingProject) return;
        const newMedia = [...(editingProject.media || [])];
        newMedia.splice(index, 1);
        setEditingProject({ ...editingProject, media: newMedia });
    };

    const handleSaveProject = async () => {
        if (!editingProject || !data) return;
        setSaving(true);
        try {
            const docId = `project-${editingProject.id}`;
            const exists = data.projects.some(p => p.id === editingProject.id);
            if (exists) {
                await updateProject(activeCategory, docId, editingProject);
            } else {
                await addProject(activeCategory, editingProject);
            }
            showNotification('저장 완료 ✓');
            setEditingProject(null);
            await loadData();
        } catch (err: any) {
            showNotification(`저장 실패: ${err.message || err}`);
            console.error('Save error:', err);
        }
        setSaving(false);
    };

    const handleDeleteProject = async (project: Project) => {
        if (!confirm(`"${project.title}" 프로젝트를 삭제하시겠습니까?`)) return;
        setSaving(true);
        try {
            await deleteProject(activeCategory, `project-${project.id}`);
            showNotification('삭제 완료');
            setEditingProject(null);
            await loadData();
        } catch (err: any) {
            showNotification(`삭제 실패: ${err.message || err}`);
        }
        setSaving(false);
    };

    const handleNewProject = () => {
        const maxId = data?.projects.reduce((max, p) => Math.max(max, p.id), 0) || 0;
        setEditingProject({
            id: maxId + 1,
            title: '',
            year: new Date().getFullYear().toString(),
            desc: '',
            image: '',
            aspect: 'aspect-[3/4]',
            media: [],
            externalLink: '',
            showExternalLink: false,
        });
    };

    const handleLogout = async () => {
        await adminLogout();
        navigate('/');
    };

    if (!authChecked || !user || !isAdmin(user)) {
        return (
            <div className="w-screen h-screen bg-[#f7f6f0] flex items-center justify-center">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[10px] uppercase tracking-widest text-[#111]/40"
                >
                    Authenticating...
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f7f6f0] text-[#111] font-sans">
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleThumbnailUpload(file);
                    e.target.value = '';
                }}
            />
            <input
                ref={mediaFileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleMediaUpload(files);
                    e.target.value = '';
                }}
            />

            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#111] text-[#f7f6f0] px-6 py-3 text-[11px] uppercase tracking-widest max-w-md text-center"
                    >
                        {notification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <nav className="sticky top-0 z-50 bg-[#f7f6f0] border-b border-[#111]/10 px-6 md:px-12 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                    >
                        ← Site
                    </button>
                    <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">Admin Dashboard</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] opacity-30">{user.email}</span>
                    <button
                        onClick={handleLogout}
                        className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">
                {/* Category Tabs */}
                <div className="flex gap-1 mb-8 border-b border-[#111]/10">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setEditingProject(null); }}
                            className={`px-5 py-3 text-[10px] uppercase tracking-widest transition-all border-b-2 -mb-[1px] ${activeCategory === cat
                                ? 'border-[#111] opacity-100'
                                : 'border-transparent opacity-30 hover:opacity-60'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-20 text-center">
                        <span className="text-[10px] uppercase tracking-widest opacity-40">Loading...</span>
                    </div>
                ) : (
                    <>
                        {/* Category Info */}
                        {data && (
                            <div className="mb-8 pb-8 border-b border-[#111]/10">
                                <h2 className="text-[11px] uppercase tracking-widest opacity-40 mb-1">{data.title}</h2>
                                <p className="text-[10px] opacity-30">{data.subtitle} — {data.description}</p>
                            </div>
                        )}

                        {/* Project Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            {data?.projects.map(project => (
                                <motion.div
                                    key={project.id}
                                    layout
                                    className={`group border border-[#111]/10 cursor-pointer transition-all hover:border-[#111]/30 ${editingProject?.id === project.id ? 'ring-2 ring-[#111]' : ''
                                        }`}
                                    onClick={() => setEditingProject({ ...project, media: project.media || [] })}
                                >
                                    <div className="aspect-[4/3] overflow-hidden bg-[#e5e4de] relative">
                                        {project.image ? (
                                            <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-widest opacity-20">
                                                No Image
                                            </div>
                                        )}
                                        {/* Media count badge */}
                                        {project.media && project.media.length > 0 && (
                                            <div className="absolute top-2 right-2 bg-[#111] text-[#f7f6f0] text-[9px] px-2 py-0.5 uppercase tracking-wider">
                                                {project.media.length} media
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <span className="text-[#f7f6f0] text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                Edit
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex justify-between items-baseline">
                                            <h3 className="text-[11px] uppercase tracking-widest">{project.title || 'Untitled'}</h3>
                                            <span className="text-[10px] font-mono opacity-30">{project.year}</span>
                                        </div>
                                        <p className="text-[10px] mt-1 opacity-40">{project.desc}</p>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Add New Project Card */}
                            <motion.div
                                layout
                                onClick={handleNewProject}
                                className="border border-dashed border-[#111]/20 cursor-pointer hover:border-[#111]/40 transition-all flex items-center justify-center min-h-[240px]"
                            >
                                <div className="text-center">
                                    <span className="text-2xl opacity-20 block mb-2">+</span>
                                    <span className="text-[10px] uppercase tracking-widest opacity-30">Add Project</span>
                                </div>
                            </motion.div>
                        </div>

                        {/* Edit Panel */}
                        <AnimatePresence>
                            {editingProject && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="sticky bottom-0 bg-white border-t border-[#111]/10 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] p-6 md:p-8 -mx-6 md:-mx-12"
                                >
                                    <div className="max-w-6xl mx-auto">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-[10px] uppercase tracking-[0.3em] opacity-40">
                                                {data?.projects.some(p => p.id === editingProject.id) ? 'Edit Project' : 'New Project'}
                                            </h3>
                                            <button
                                                onClick={() => setEditingProject(null)}
                                                className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
                                            {/* Thumbnail Preview + Upload */}
                                            <div>
                                                <p className="text-[9px] uppercase tracking-widest mb-2 opacity-40">Thumbnail</p>
                                                <div
                                                    className="aspect-[3/4] bg-[#e5e4de] overflow-hidden cursor-pointer relative group"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    {editingProject.image ? (
                                                        <img src={editingProject.image} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-widest opacity-20">
                                                            Click to upload
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                        <span className="text-[#f7f6f0] text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {uploadingImage ? 'Uploading...' : 'Change'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={editingProject.image}
                                                    onChange={e => setEditingProject({ ...editingProject, image: e.target.value })}
                                                    placeholder="Or paste image URL"
                                                    className="mt-2 w-full px-0 py-1 text-[10px] border-b border-[#111]/10 bg-transparent outline-none"
                                                />
                                            </div>

                                            {/* Fields */}
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] uppercase tracking-widest mb-1 opacity-40">Title</label>
                                                        <input
                                                            type="text"
                                                            value={editingProject.title}
                                                            onChange={e => setEditingProject({ ...editingProject, title: e.target.value })}
                                                            className="w-full px-0 py-2 text-[13px] border-b border-[#111]/10 bg-transparent outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] uppercase tracking-widest mb-1 opacity-40">Year</label>
                                                        <input
                                                            type="text"
                                                            value={editingProject.year}
                                                            onChange={e => setEditingProject({ ...editingProject, year: e.target.value })}
                                                            className="w-full px-0 py-2 text-[13px] border-b border-[#111]/10 bg-transparent outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] uppercase tracking-widest mb-1 opacity-40">Description</label>
                                                    <input
                                                        type="text"
                                                        value={editingProject.desc}
                                                        onChange={e => setEditingProject({ ...editingProject, desc: e.target.value })}
                                                        className="w-full px-0 py-2 text-[13px] border-b border-[#111]/10 bg-transparent outline-none"
                                                    />
                                                </div>
                                                <div className="flex gap-4 items-center">
                                                    <div className="flex-1">
                                                        <label className="block text-[9px] uppercase tracking-widest mb-1 opacity-40">External Link</label>
                                                        <input
                                                            type="text"
                                                            value={editingProject.externalLink || ''}
                                                            onChange={e => setEditingProject({ ...editingProject, externalLink: e.target.value })}
                                                            placeholder="https://..."
                                                            className="w-full px-0 py-2 text-[13px] border-b border-[#111]/10 bg-transparent outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4 cursor-pointer" onClick={() => setEditingProject({ ...editingProject, showExternalLink: !editingProject.showExternalLink })}>
                                                        <div className={`w-4 h-4 border transition-colors ${editingProject.showExternalLink ? 'bg-[#111] border-[#111]' : 'border-[#111]/30'} flex items-center justify-center`}>
                                                            {editingProject.showExternalLink && <span className="text-[#f7f6f0] text-[10px]">✓</span>}
                                                        </div>
                                                        <span className="text-[9px] uppercase tracking-widest opacity-60 select-none">Show Link</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] uppercase tracking-widest mb-1 opacity-40">Aspect Ratio</label>
                                                    <div className="flex gap-2">
                                                        {ASPECT_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => setEditingProject({ ...editingProject, aspect: opt })}
                                                                className={`px-3 py-1 text-[10px] border transition-colors ${editingProject.aspect === opt
                                                                    ? 'border-[#111] bg-[#111] text-[#f7f6f0]'
                                                                    : 'border-[#111]/10 hover:border-[#111]/30'
                                                                    }`}
                                                            >
                                                                {opt.replace('aspect-[', '').replace(']', '')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Media Gallery */}
                                                <div>
                                                    <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">
                                                        Detail Media ({editingProject.media?.length || 0})
                                                    </label>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {editingProject.media?.map((item, idx) => (
                                                            <div key={idx} className="relative w-20 h-20 bg-[#e5e4de] group">
                                                                {item.type === 'video' ? (
                                                                    <div className="w-full h-full flex items-center justify-center text-[9px] uppercase opacity-40">
                                                                        <span>▶ Video</span>
                                                                    </div>
                                                                ) : (
                                                                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                                )}
                                                                <button
                                                                    onClick={() => removeMedia(idx)}
                                                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => mediaFileInputRef.current?.click()}
                                                            className="w-20 h-20 border border-dashed border-[#111]/20 flex items-center justify-center text-[16px] opacity-20 hover:opacity-40 transition-opacity"
                                                            disabled={uploadingImage}
                                                        >
                                                            {uploadingImage ? '...' : '+'}
                                                        </button>
                                                    </div>
                                                    <p className="text-[9px] opacity-20 mt-1">이미지 및 비디오 파일 업로드 가능</p>
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        onClick={handleSaveProject}
                                                        disabled={saving}
                                                        className="px-8 py-3 bg-[#111] text-[#f7f6f0] text-[10px] uppercase tracking-[0.3em] hover:bg-[#333] transition-colors disabled:opacity-50"
                                                    >
                                                        {saving ? 'Saving...' : 'Save'}
                                                    </button>
                                                    {data?.projects.some(p => p.id === editingProject.id) && (
                                                        <button
                                                            onClick={() => handleDeleteProject(editingProject)}
                                                            disabled={saving}
                                                            className="px-8 py-3 border border-red-500/30 text-red-500 text-[10px] uppercase tracking-[0.3em] hover:bg-red-50 transition-colors disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
}
