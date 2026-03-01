import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { submitContactForm } from '../../lib/contactService';
import { adminLogin } from '../../lib/authService';
import { isConfigured } from '../../lib/firebase';

interface ContactDialogProps {
    open: boolean;
    onClose: () => void;
    dark?: boolean;
}

export default function ContactDialog({ open, onClose, dark = false }: ContactDialogProps) {
    const navigate = useNavigate();
    const [mode, setMode] = useState<'contact' | 'admin'>('contact');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Admin login fields
    const [adminId, setAdminId] = useState('');
    const [adminPw, setAdminPw] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !message.trim()) {
            setErrorMsg('모든 필드를 입력해주세요.');
            setStatus('error');
            return;
        }

        setStatus('sending');

        if (!isConfigured) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatus('success');
            setTimeout(() => handleClose(), 2000);
            return;
        }

        const result = await submitContactForm({ name, email, message });

        if (result.success) {
            setStatus('success');
            setTimeout(() => handleClose(), 2000);
        } else {
            setErrorMsg(result.error || '전송 실패');
            setStatus('error');
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminId.trim() || !adminPw.trim()) {
            setErrorMsg('아이디와 비밀번호를 입력해주세요.');
            return;
        }
        setAdminLoading(true);
        setErrorMsg('');
        const result = await adminLogin(adminId, adminPw);
        if (result.success) {
            handleClose();
            navigate('/admin');
        } else {
            setErrorMsg(result.error || '로그인 실패');
        }
        setAdminLoading(false);
    };

    const handleClose = () => {
        setName('');
        setEmail('');
        setMessage('');
        setStatus('idle');
        setErrorMsg('');
        setMode('contact');
        setAdminId('');
        setAdminPw('');
        setAdminLoading(false);
        onClose();
    };

    const bg = dark ? '#111' : '#f7f6f0';
    const fg = dark ? '#f7f6f0' : '#111';
    const borderCol = dark ? 'rgba(247,246,240,0.15)' : 'rgba(17,17,17,0.15)';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6 cursor-auto"
                    onClick={handleClose}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                        className="relative w-full max-w-md"
                        style={{ backgroundColor: bg, color: fg }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleClose}
                            className="absolute top-5 right-5 text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            Close
                        </button>

                        <div className="p-8 md:p-10">
                            {mode === 'contact' ? (
                                <>
                                    <h2 className="text-[9px] uppercase tracking-[0.3em] mb-8" style={{ opacity: 0.4 }}>
                                        Get in Touch
                                    </h2>

                                    {status === 'success' ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="py-12 text-center"
                                        >
                                            <p className="text-[11px] uppercase tracking-widest">메시지가 전송되었습니다</p>
                                            <p className="text-[10px] mt-2 opacity-40">Thank you for reaching out</p>
                                        </motion.div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Name</label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors cursor-text"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="Your name"
                                                    disabled={status === 'sending'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Email</label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors cursor-text"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="your@email.com"
                                                    disabled={status === 'sending'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Message</label>
                                                <textarea
                                                    value={message}
                                                    onChange={e => setMessage(e.target.value)}
                                                    rows={4}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors resize-none cursor-text"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="Tell me about your project..."
                                                    disabled={status === 'sending'}
                                                />
                                            </div>

                                            {status === 'error' && (
                                                <p className="text-[10px] text-red-500">{errorMsg}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={status === 'sending'}
                                                className="w-full py-3 text-[10px] uppercase tracking-[0.3em] transition-all duration-300 cursor-pointer"
                                                style={{
                                                    backgroundColor: fg,
                                                    color: bg,
                                                    opacity: status === 'sending' ? 0.5 : 1,
                                                }}
                                            >
                                                {status === 'sending' ? 'Sending...' : 'Send Message'}
                                            </button>

                                            {!isConfigured && (
                                                <p className="text-[9px] text-center opacity-30 mt-2">
                                                    Demo mode — Firebase 설정 후 실제 전송됩니다
                                                </p>
                                            )}
                                        </form>
                                    )}

                                    {/* Hidden Admin access */}
                                    <div className="mt-8 text-center">
                                        <button
                                            onClick={() => { setMode('admin'); setErrorMsg(''); }}
                                            className="text-[8px] uppercase tracking-widest opacity-15 hover:opacity-40 transition-opacity cursor-pointer"
                                        >
                                            Admin
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-[9px] uppercase tracking-[0.3em] mb-8" style={{ opacity: 0.4 }}>
                                        Admin Login
                                    </h2>

                                    <form onSubmit={handleAdminLogin} className="space-y-5">
                                        <div>
                                            <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">ID</label>
                                            <input
                                                type="text"
                                                value={adminId}
                                                onChange={e => setAdminId(e.target.value)}
                                                className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors cursor-text"
                                                style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                placeholder="Admin ID"
                                                disabled={adminLoading}
                                                autoComplete="username"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Password</label>
                                            <input
                                                type="password"
                                                value={adminPw}
                                                onChange={e => setAdminPw(e.target.value)}
                                                className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors cursor-text"
                                                style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                placeholder="••••••••"
                                                disabled={adminLoading}
                                                autoComplete="current-password"
                                            />
                                        </div>

                                        {errorMsg && (
                                            <p className="text-[10px] text-red-500">{errorMsg}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={adminLoading}
                                            className="w-full py-3 text-[10px] uppercase tracking-[0.3em] transition-all duration-300 cursor-pointer"
                                            style={{
                                                backgroundColor: fg,
                                                color: bg,
                                                opacity: adminLoading ? 0.5 : 1,
                                            }}
                                        >
                                            {adminLoading ? 'Logging in...' : 'Login'}
                                        </button>

                                        <div className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => { setMode('contact'); setErrorMsg(''); }}
                                                className="text-[9px] uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity cursor-pointer"
                                            >
                                                ← Back to Contact
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
